/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  CodexAccountState,
  CodexModel,
  CodexRateLimits,
  CodexResetLimitsResult,
} from '@qwen-code/sdk/daemon';
import { CodexAppServer } from './codex-app-server.js';

export class CodexService {
  readonly appServer: CodexAppServer;
  readonly cwd: string;
  private state: CodexAccountState = {
    connected: false,
    account: null,
    login: null,
    models: [],
    limits: null,
    error: null,
    updatedAt: null,
  };
  private refreshing: Promise<CodexAccountState> | undefined;
  private loginStarting: Promise<CodexAccountState> | undefined;
  private resetting:
    | { key: string; result: Promise<CodexResetLimitsResult> }
    | undefined;
  private loggingOut = false;
  private listeners = new Set<(state: CodexAccountState) => void>();
  private logoutListeners = new Set<() => Promise<void> | void>();

  constructor(
    readonly homeDir = join(
      process.env['QWEN_HOME'] || join(homedir(), '.qwen'),
      'codex',
    ),
  ) {
    this.cwd = join(homeDir, 'service');
    this.appServer = new CodexAppServer(homeDir, this.cwd);
    this.appServer.onNotification((method, params) => {
      if (this.loggingOut) return;
      if (method === 'account/login/completed') {
        if (params['loginId'] !== this.state.login?.loginId) return;
        this.state.login = null;
        this.state.error =
          params['success'] === true
            ? null
            : typeof params['error'] === 'string'
              ? params['error']
              : 'Вход через ChatGPT не завершён';
        this.emit();
        if (params['success'] === true) void this.refresh();
      } else if (method === 'account/rateLimits/updated') {
        // The notification may contain only one bucket. Read the full snapshot.
        void this.refresh();
      } else if (method === 'account/updated' || method === 'turn/completed') {
        void this.refresh();
      }
    });
    this.appServer.onDisconnect((error) => {
      this.state.connected = false;
      this.state.login = null;
      this.state.error = error.message;
      this.emit();
    });
  }

  snapshot(): CodexAccountState {
    return structuredClone(this.state);
  }

  subscribe(listener: (state: CodexAccountState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onLogout(listener: () => Promise<void> | void): () => void {
    this.logoutListeners.add(listener);
    return () => this.logoutListeners.delete(listener);
  }

  private emit(): void {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }

  async refresh(): Promise<CodexAccountState> {
    if (this.loggingOut) return this.snapshot();
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.readAccount();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = undefined;
    }
  }

  private async readAccount(): Promise<CodexAccountState> {
    try {
      const result = await this.appServer.request<{
        account: CodexAccountState['account'] | { type: string } | null;
      }>('account/read', { refreshToken: true });
      this.state.connected = true;
      const account = result.account as CodexAccountState['account'];
      this.state.account =
        account?.type === 'chatgpt'
          ? {
              type: 'chatgpt',
              email: account.email,
              planType: account.planType,
            }
          : null;
      if (this.state.account) {
        const [models, limits] = await Promise.allSettled([
          this.readModels(),
          this.appServer.request<CodexRateLimits>('account/rateLimits/read'),
        ]);
        if (models.status === 'fulfilled') this.state.models = models.value;
        if (limits.status === 'fulfilled') this.state.limits = limits.value;
        const failure = [models, limits].find(
          (value) => value.status === 'rejected',
        );
        this.state.error =
          failure?.status === 'rejected'
            ? String(
                failure.reason instanceof Error
                  ? failure.reason.message
                  : 'Не удалось обновить данные Codex',
              )
            : null;
      } else {
        this.state.models = [];
        this.state.limits = null;
        this.state.error = null;
      }
      this.state.updatedAt = Date.now();
    } catch (error) {
      this.state.connected = false;
      this.state.error =
        error instanceof Error ? error.message : 'Codex недоступен';
    }
    this.emit();
    return this.snapshot();
  }

  private async readModels(): Promise<CodexModel[]> {
    const models: CodexModel[] = [];
    let cursor: string | null = null;
    do {
      const page: { data: CodexModel[]; nextCursor: string | null } =
        await this.appServer.request('model/list', {
          limit: 100,
          includeHidden: false,
          ...(cursor ? { cursor } : {}),
        });
      models.push(...page.data.filter((model) => !model.hidden));
      cursor = page.nextCursor;
    } while (cursor);
    return models;
  }

  async models(): Promise<CodexModel[]> {
    const state = await this.refresh();
    if (!state.account) return [];
    return state.models;
  }

  async limits(): Promise<CodexRateLimits | null> {
    return (await this.refresh()).limits;
  }

  async resetLimits(idempotencyKey: string): Promise<CodexResetLimitsResult> {
    if (this.loggingOut) throw new Error('Codex is signing out');
    if (this.resetting) {
      if (this.resetting.key !== idempotencyKey)
        throw new Error('Сброс лимитов уже выполняется.');
      return this.resetting.result;
    }
    const result = this.consumeReset(idempotencyKey);
    this.resetting = { key: idempotencyKey, result };
    try {
      return await result;
    } finally {
      this.resetting = undefined;
    }
  }

  private async consumeReset(
    idempotencyKey: string,
  ): Promise<CodexResetLimitsResult> {
    const account = await this.refresh();
    if (this.loggingOut) throw new Error('Codex is signing out');
    if (!account.connected || !account.account)
      throw new Error('Войдите через ChatGPT, чтобы сбросить лимиты.');
    const { outcome } = await this.appServer.request<
      Pick<CodexResetLimitsResult, 'outcome'>
    >('account/rateLimitResetCredit/consume', { idempotencyKey });
    if (this.refreshing) await this.refreshing;
    return { outcome, state: await this.refresh() };
  }

  async startLogin(): Promise<CodexAccountState> {
    if (this.loggingOut) throw new Error('Codex is signing out');
    if (this.loginStarting) return this.loginStarting;
    if (this.state.login) return this.snapshot();
    this.loginStarting = this.beginLogin();
    try {
      return await this.loginStarting;
    } finally {
      this.loginStarting = undefined;
    }
  }

  private async beginLogin(): Promise<CodexAccountState> {
    const result = await this.appServer.request<{
      type: string;
      loginId: string;
      authUrl: string;
    }>('account/login/start', { type: 'chatgpt' });
    if (result.type !== 'chatgpt')
      throw new Error('Unexpected Codex login method');
    const url = new URL(result.authUrl);
    if (
      url.protocol !== 'https:' ||
      !['auth.openai.com', 'auth0.openai.com'].includes(url.hostname)
    )
      throw new Error('Invalid ChatGPT authorization URL');
    this.state.login = { loginId: result.loginId, authUrl: result.authUrl };
    this.state.error = null;
    this.state.connected = true;
    this.emit();
    return this.snapshot();
  }

  async cancelLogin(): Promise<CodexAccountState> {
    if (this.loginStarting) await this.loginStarting;
    const login = this.state.login;
    if (login)
      await this.appServer.request('account/login/cancel', {
        loginId: login.loginId,
      });
    this.state.login = null;
    this.state.error = null;
    this.emit();
    return this.snapshot();
  }

  async logout(): Promise<CodexAccountState> {
    if (this.loggingOut) throw new Error('Codex is signing out');
    this.loggingOut = true;
    try {
      if (this.resetting) await this.resetting.result.catch(() => {});
      if (this.refreshing) await this.refreshing;
      await this.cancelLogin();
      await Promise.allSettled(
        [...this.logoutListeners].map((listener) => listener()),
      );
      await this.appServer.request('account/logout');
      this.appServer.close();
      this.state = {
        connected: false,
        account: null,
        login: null,
        models: [],
        limits: null,
        error: null,
        updatedAt: Date.now(),
      };
      this.emit();
      return this.snapshot();
    } finally {
      this.loggingOut = false;
    }
  }
}

let service: CodexService | undefined;
export function getCodexService(): CodexService {
  return (service ??= new CodexService());
}
