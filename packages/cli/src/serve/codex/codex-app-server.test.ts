/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { CodexAppServer, codexEnvironment } from './codex-app-server.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const spawn = vi.fn();
  return { ...actual, spawn, default: { ...actual, spawn } };
});
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  mkdirSync: vi.fn(),
}));

function runtime() {
  const writes: Array<Record<string, unknown>> = [];
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
    stdin: new Writable({
      write(chunk, _encoding, done) {
        const message = JSON.parse(String(chunk)) as Record<string, unknown>;
        writes.push(message);
        if (message['method'] === 'initialize')
          queueMicrotask(() => {
            child.stdout.write(
              `${JSON.stringify({ id: message['id'], result: {} })}\n`,
            );
          });
        done();
      },
    }),
  });
  vi.mocked(spawn).mockReturnValue(
    child as unknown as ReturnType<typeof spawn>,
  );
  const server = new CodexAppServer(
    '/tmp/homecode-transport-test',
    '/tmp/homecode-transport-test/service',
  );
  return { server, child, writes };
}

afterEach(() => vi.restoreAllMocks());

describe('Codex stdio transport', () => {
  it('isolates credentials and process configuration from the current client', () => {
    vi.stubEnv('CODEX_HOME', '/other-client');
    vi.stubEnv('OPENAI_API_KEY', 'not-a-real-secret');
    vi.stubEnv('CODEX_INTERNAL_ORIGINATOR_OVERRIDE', 'other-client');
    vi.stubEnv('NODE_OPTIONS', '--require other-client');
    const env = codexEnvironment('/homecode/codex');
    expect(env['CODEX_HOME']).toBe('/homecode/codex');
    expect(env['OPENAI_API_KEY']).toBeUndefined();
    expect(env['CODEX_INTERNAL_ORIGINATOR_OVERRIDE']).toBeUndefined();
    expect(env['NODE_OPTIONS']).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it('correlates interleaved replies after one initialization', async () => {
    const { server, child, writes } = runtime();
    const first = server.request('account/read');
    const second = server.request('model/list');
    await vi.waitFor(() => expect(writes).toHaveLength(4));
    const requests = writes.filter(
      (message) =>
        typeof message['id'] === 'number' && message['method'] !== 'initialize',
    );
    for (const request of requests.reverse())
      child.stdout.write(
        `${JSON.stringify({ id: request['id'], result: request['method'] })}\n`,
      );
    expect(await first).toBe('account/read');
    expect(await second).toBe('model/list');
    expect(
      writes.filter((message) => message['method'] === 'initialize'),
    ).toHaveLength(1);
    server.close();
  });

  it('fails a pending accepted request on process death without retrying', async () => {
    const { server, child, writes } = runtime();
    const request = server.request('turn/start');
    const rejected = request.catch((error: Error) => error.message);
    await vi.waitFor(() => expect(writes).toHaveLength(3));
    child.emit('exit', 1, null);
    expect(await rejected).toContain('accepted requests were not retried');
    expect(
      writes.filter((message) => message['method'] === 'turn/start'),
    ).toHaveLength(1);
  });

  it('contains a broken pipe within Codex instead of crashing the daemon', async () => {
    const { server, child, writes } = runtime();
    const rejected = server
      .request('turn/start')
      .catch((error: Error) => error.message);
    await vi.waitFor(() => expect(writes).toHaveLength(3));
    child.stdin.emit('error', new Error('write EPIPE'));
    expect(await rejected).toContain('Codex pipe disconnected');
    expect(child.kill).toHaveBeenCalledOnce();
  });
});
