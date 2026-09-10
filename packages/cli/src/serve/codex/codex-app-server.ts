/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

export const CODEX_VERSION = '0.153.4';
type Params = Record<string, unknown>;
type NotificationListener = (method: string, params: Params) => void;
type RequestHandler = (
  method: string,
  params: Params,
) => unknown | Promise<unknown>;

export function codexEnvironment(homeDir: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(CODEX_|OPENAI_|CHATGPT_|QWEN_)/.test(key) ||
      ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE'].includes(key)
    )
      delete env[key];
  }
  env['CODEX_HOME'] = homeDir;
  return env;
}

export class CodexAppServer {
  private child: ChildProcessWithoutNullStreams | undefined;
  private starting: Promise<void> | undefined;
  private nextId = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private notifications = new Set<NotificationListener>();
  private handlers = new Set<RequestHandler>();
  private disconnectListeners = new Set<(error: Error) => void>();

  constructor(
    readonly homeDir: string,
    readonly cwd: string,
  ) {}

  onNotification(listener: NotificationListener): () => void {
    this.notifications.add(listener);
    return () => this.notifications.delete(listener);
  }

  onRequest(handler: RequestHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onDisconnect(listener: (error: Error) => void): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  async request<T>(method: string, params: unknown = {}): Promise<T> {
    await this.start();
    return this.send<T>(method, params);
  }

  private async start(): Promise<void> {
    if (this.starting) return this.starting;
    if (this.child) return;
    this.starting = this.launch();
    try {
      await this.starting;
    } finally {
      this.starting = undefined;
    }
  }

  private async launch(): Promise<void> {
    mkdirSync(this.homeDir, { recursive: true, mode: 0o700 });
    mkdirSync(this.cwd, { recursive: true, mode: 0o700 });
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve('@openai/codex/package.json');
    const metadata = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      version: string;
    };
    if (metadata.version !== CODEX_VERSION)
      throw new Error(`HomeCode requires Codex ${CODEX_VERSION}`);
    const args = [
      join(dirname(packagePath), 'bin', 'codex.js'),
      'app-server',
      '--listen',
      'stdio://',
    ];
    for (const config of [
      'cli_auth_credentials_store="file"',
      'forced_login_method="chatgpt"',
      'features.apps=false',
      'features.plugins=false',
      'features.hooks=false',
      'features.memories=false',
      'features.remote_plugin=false',
      'orchestrator.mcp.enabled=false',
      'mcp_servers={}',
    ])
      args.push('-c', config);
    const child = spawn(process.execPath, args, {
      cwd: this.cwd,
      env: codexEnvironment(this.homeDir),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child = child;
    const pipeFailed = () =>
      this.failed(
        child,
        new Error(
          'Codex pipe disconnected; accepted requests were not retried',
        ),
      );
    child.stdin.on('error', pipeFailed);
    child.stdout.on('error', pipeFailed);
    child.stderr.on('error', pipeFailed);
    // Do not forward runtime logs: they may include authentication details.
    child.stderr.resume();
    const lines = createInterface({ input: child.stdout });
    lines.on('error', pipeFailed);
    lines.on('line', (line) => {
      try {
        const message: unknown = JSON.parse(line);
        if (!message || typeof message !== 'object')
          throw new Error('Invalid Codex frame');
        void this.receive(message as Params, child).catch(() => {
          this.failed(child, new Error('Codex protocol handler failed'));
        });
      } catch {
        this.failed(child, new Error('Invalid Codex protocol frame'));
      }
    });
    child.on('error', () =>
      this.failed(child, new Error('Codex runtime could not start')),
    );
    child.on('exit', (code, signal) => {
      lines.close();
      this.failed(
        child,
        new Error(
          `Codex disconnected (${signal ?? code ?? 'unknown'}); accepted requests were not retried`,
        ),
      );
    });
    try {
      await this.send('initialize', {
        clientInfo: { name: 'homecode', title: 'HomeCode', version: '2.1.12' },
        capabilities: { experimentalApi: true },
      });
      this.write({ method: 'initialized', params: {} });
    } catch (error) {
      this.failed(
        child,
        error instanceof Error
          ? error
          : new Error('Codex initialization failed'),
      );
      throw error;
    }
  }

  private send<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(`Codex ${method} timed out; the request was not retried`),
        );
      }, 120_000);
      timer.unref();
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        this.write({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private write(message: unknown): void {
    if (!this.child?.stdin.writable) throw new Error('Codex is disconnected');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private async receive(
    message: Params,
    child: ChildProcessWithoutNullStreams,
  ): Promise<void> {
    if (this.child !== child) return;
    const method = message['method'];
    if (typeof method === 'string') {
      const params = (message['params'] ?? {}) as Params;
      if (message['id'] !== undefined) {
        try {
          for (const handler of this.handlers) {
            const result = await handler(method, params);
            if (result !== undefined) {
              if (this.child === child)
                this.write({ id: message['id'], result });
              return;
            }
          }
          if (this.child === child)
            this.write({
              id: message['id'],
              error: { code: -32601, message: 'Unsupported HomeCode request' },
            });
        } catch {
          if (this.child === child)
            this.write({
              id: message['id'],
              error: { code: -32603, message: 'HomeCode tool request failed' },
            });
        }
      } else {
        for (const listener of this.notifications) listener(method, params);
      }
      return;
    }
    if (typeof message['id'] !== 'number') return;
    const pending = this.pending.get(message['id']);
    if (!pending) return;
    this.pending.delete(message['id']);
    clearTimeout(pending.timer);
    const error = message['error'] as { message?: string } | undefined;
    if (error)
      pending.reject(new Error(error.message ?? 'Codex request failed'));
    else pending.resolve(message['result']);
  }

  private failed(child: ChildProcessWithoutNullStreams, error: Error): void {
    if (this.child !== child) return;
    this.child = undefined;
    child.kill();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const listener of this.disconnectListeners) listener(error);
  }

  close(): void {
    if (this.child) this.failed(this.child, new Error('Codex runtime stopped'));
  }
}
