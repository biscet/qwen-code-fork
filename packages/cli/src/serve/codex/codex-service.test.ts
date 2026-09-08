/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { CodexService } from './codex-service.js';
import type { CodexModel, CodexRateLimits } from '@qwen-code/sdk/daemon';

const model: CodexModel = {
  id: 'test-model',
  model: 'test-model',
  displayName: 'Test model',
  description: '',
  hidden: false,
  supportedReasoningEfforts: [
    { reasoningEffort: 'ultra', description: 'Thorough' },
  ],
  defaultReasoningEffort: 'ultra',
  inputModalities: ['text'],
  isDefault: true,
};
const account = {
  type: 'chatgpt',
  email: 'test@example.com',
  planType: 'plus',
};
const limits: CodexRateLimits = {
  rateLimits: {
    limitId: 'codex',
    limitName: null,
    primary: null,
    secondary: null,
  },
  rateLimitsByLimitId: null,
  rateLimitResetCredits: null,
};

describe('Codex account service', () => {
  it.each(['reset', 'alreadyRedeemed', 'nothingToReset', 'noCredit'] as const)(
    'returns %s and refreshes usage after the exact official reset operation',
    async (outcome) => {
      const service = new CodexService('/tmp/homecode-codex-service-test');
      let consumed = false;
      const request = vi
        .spyOn(service.appServer, 'request')
        .mockImplementation(async (method) => {
          if (method === 'account/read') return { account };
          if (method === 'model/list')
            return { data: [model], nextCursor: null };
          if (method === 'account/rateLimitResetCredit/consume') {
            consumed = true;
            return { outcome };
          }
          return {
            ...limits,
            rateLimitResetCredits: {
              availableCount: consumed ? 1 : 2,
              credits: null,
            },
          };
        });
      const result = await service.resetLimits('same-logical-attempt');
      expect(result.outcome).toBe(outcome);
      expect(result.state.limits?.rateLimitResetCredits?.availableCount).toBe(
        1,
      );
      expect(request).toHaveBeenCalledWith(
        'account/rateLimitResetCredit/consume',
        {
          idempotencyKey: 'same-logical-attempt',
        },
      );
      expect(
        request.mock.calls.filter(
          ([method]) => method === 'account/rateLimits/read',
        ),
      ).toHaveLength(2);
    },
  );

  it('retains a confirmed reset result when refreshing the new limits fails', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    let consumed = false;
    vi.spyOn(service.appServer, 'request').mockImplementation(
      async (method) => {
        if (method === 'account/read') return { account };
        if (method === 'model/list') return { data: [model], nextCursor: null };
        if (method === 'account/rateLimitResetCredit/consume') {
          consumed = true;
          return { outcome: 'reset' };
        }
        if (consumed) throw new Error('Usage refresh failed');
        return limits;
      },
    );
    expect(await service.resetLimits('confirmed')).toMatchObject({
      outcome: 'reset',
      state: { limits, error: 'Usage refresh failed' },
    });
  });

  it('coalesces the same attempt, rejects competing attempts and waits before logout', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    let settle!: (value: { outcome: 'reset' }) => void;
    const consume = new Promise<{ outcome: 'reset' }>((resolve) => {
      settle = resolve;
    });
    const request = vi
      .spyOn(service.appServer, 'request')
      .mockImplementation(async (method) => {
        if (method === 'account/read') return { account };
        if (method === 'model/list') return { data: [model], nextCursor: null };
        if (method === 'account/rateLimitResetCredit/consume') return consume;
        return limits;
      });
    vi.spyOn(service.appServer, 'close').mockImplementation(() => {});
    const first = service.resetLimits('one');
    const duplicate = service.resetLimits('one');
    await expect(service.resetLimits('two')).rejects.toThrow('уже выполняется');
    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        'account/rateLimitResetCredit/consume',
        { idempotencyKey: 'one' },
      ),
    );
    const logout = service.logout();
    await expect(service.resetLimits('one')).rejects.toThrow('signing out');
    expect(request).not.toHaveBeenCalledWith('account/logout');
    settle({ outcome: 'reset' });
    expect(await first).toEqual(await duplicate);
    await logout;
    expect(
      request.mock.calls.filter(
        ([method]) => method === 'account/rateLimitResetCredit/consume',
      ),
    ).toHaveLength(1);
    expect(service.snapshot().account).toBeNull();
  });

  it('does not consume a reset while signed out', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    const request = vi
      .spyOn(service.appServer, 'request')
      .mockResolvedValue({ account: null });
    await expect(service.resetLimits('signed-out')).rejects.toThrow('Войдите');
    expect(request).not.toHaveBeenCalledWith(
      'account/rateLimitResetCredit/consume',
      expect.anything(),
    );
  });

  it('does not retry an ambiguous reset and forwards the same key on explicit retry', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    const consume = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({ outcome: 'alreadyRedeemed' });
    vi.spyOn(service.appServer, 'request').mockImplementation(
      async (method, params) => {
        if (method === 'account/read') return { account };
        if (method === 'model/list') return { data: [model], nextCursor: null };
        if (method === 'account/rateLimitResetCredit/consume')
          return consume(params);
        return limits;
      },
    );
    await expect(service.resetLimits('uncertain-attempt')).rejects.toThrow(
      'Connection lost',
    );
    expect(consume).toHaveBeenCalledTimes(1);
    expect((await service.resetLimits('uncertain-attempt')).outcome).toBe(
      'alreadyRedeemed',
    );
    expect(consume.mock.calls).toEqual([
      [{ idempotencyKey: 'uncertain-attempt' }],
      [{ idempotencyKey: 'uncertain-attempt' }],
    ]);
  });

  it('does not request models or usage while signed out', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    const request = vi
      .spyOn(service.appServer, 'request')
      .mockResolvedValue({ account: null });
    expect(await service.refresh()).toMatchObject({
      connected: true,
      account: null,
      models: [],
      limits: null,
    });
    expect(request).toHaveBeenCalledExactlyOnceWith('account/read', {
      refreshToken: true,
    });
  });

  it('retains unknown quotas and reads every model page without changing defaults', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    const request = vi
      .spyOn(service.appServer, 'request')
      .mockImplementation(async (method, params) => {
        if (method === 'account/read')
          return {
            account: { ...account, accessToken: 'must-not-leave-service' },
          };
        if (method === 'account/rateLimits/read') return limits;
        if ((params as { cursor?: string })?.cursor)
          return {
            data: [{ ...model, id: 'second', model: 'second' }],
            nextCursor: null,
          };
        return {
          data: [model, { ...model, id: 'hidden', hidden: true }],
          nextCursor: 'page-2',
        };
      });
    const state = await service.refresh();
    expect(state.account).toEqual(account);
    expect(state.limits).toEqual(limits);
    expect(state.models.map((entry) => entry.id)).toEqual([
      'test-model',
      'second',
    ]);
    expect(state.models[0]?.supportedReasoningEfforts[0]?.reasoningEffort).toBe(
      'ultra',
    );
    expect(
      request.mock.calls.every(([method]) =>
        ['account/read', 'model/list', 'account/rateLimits/read'].includes(
          method,
        ),
      ),
    ).toBe(true);
  });

  it('coalesces concurrent login starts and cancels the returned login id', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    const request = vi.spyOn(service.appServer, 'request').mockResolvedValue({
      type: 'chatgpt',
      loginId: 'own-login',
      authUrl: 'https://auth.openai.com/authorize',
    });
    const [first, second] = await Promise.all([
      service.startLogin(),
      service.startLogin(),
    ]);
    expect(first.login).toEqual(second.login);
    expect(request).toHaveBeenCalledTimes(1);
    await service.cancelLogin();
    expect(request).toHaveBeenLastCalledWith('account/login/cancel', {
      loginId: 'own-login',
    });
    expect(service.snapshot().login).toBeNull();
  });

  it('clears a disconnected error after a successful signed-out read', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    vi.spyOn(service.appServer, 'request')
      .mockRejectedValueOnce(new Error('Disconnected previously'))
      .mockResolvedValueOnce({ account: null });
    expect((await service.refresh()).error).toBe('Disconnected previously');
    expect(await service.refresh()).toMatchObject({
      connected: true,
      account: null,
      error: null,
    });
  });

  it('retains last usage on refresh failure and reports that failure', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    let fail = false;
    vi.spyOn(service.appServer, 'request').mockImplementation(
      async (method) => {
        if (method === 'account/read') return { account };
        if (method === 'model/list') return { data: [model], nextCursor: null };
        if (fail) throw new Error('Usage unavailable');
        return limits;
      },
    );
    await service.refresh();
    fail = true;
    expect(await service.refresh()).toMatchObject({
      limits,
      error: 'Usage unavailable',
    });
  });

  it('terminates active consumers before logout and only clears account metadata', async () => {
    const service = new CodexService('/tmp/homecode-codex-service-test');
    const order: string[] = [];
    vi.spyOn(service.appServer, 'request').mockImplementation(
      async (method) => {
        order.push(method);
        return {};
      },
    );
    vi.spyOn(service.appServer, 'close').mockImplementation(() => {
      order.push('close');
    });
    service.onLogout(async () => {
      order.push('interrupt');
    });
    expect(await service.logout()).toMatchObject({
      account: null,
      limits: null,
      login: null,
      models: [],
    });
    expect(order).toEqual(['interrupt', 'account/logout', 'close']);
  });
});
