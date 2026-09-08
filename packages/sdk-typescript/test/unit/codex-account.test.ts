/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { DaemonClient } from '../../src/daemon/DaemonClient.js';
import type { DaemonTransport } from '../../src/daemon/DaemonTransport.js';

describe('process-global Codex account routes', () => {
  it('sends the same reset idempotency key through authenticated REST after an ambiguous failure', async () => {
    const result = { outcome: 'alreadyRedeemed', state: { updatedAt: 5 } };
    const restFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Network connection interrupted'))
      .mockResolvedValueOnce(Response.json(result));
    const acpFetch = vi.fn();
    const client = new DaemonClient({
      baseUrl: 'http://daemon',
      token: 'test-token',
      transport: { restFetch, fetch: acpFetch } as unknown as DaemonTransport,
    });
    const key = '59012d46-ac40-4bb2-bf72-ce0950ba467b';
    await expect(client.resetCodexLimits(key)).rejects.toThrow(
      'Network connection interrupted',
    );
    expect(restFetch).toHaveBeenCalledOnce();
    await expect(client.resetCodexLimits(key)).resolves.toEqual(result);
    expect(acpFetch).not.toHaveBeenCalled();
    expect(restFetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of restFetch.mock.calls) {
      expect(url).toBe('http://daemon/codex/limits/reset');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ idempotencyKey: key });
      expect(new Headers(init.headers).get('Authorization')).toBe(
        'Bearer test-token',
      );
    }
  });

  it('uses authenticated REST even when the session transport is ACP', async () => {
    const restFetch = vi
      .fn()
      .mockImplementation(async () => new Response('{}', { status: 200 }));
    const acpFetch = vi
      .fn()
      .mockRejectedValue(new Error('Account request was sent through ACP'));
    const transport = {
      restFetch,
      fetch: acpFetch,
    } as unknown as DaemonTransport;
    const client = new DaemonClient({
      baseUrl: 'http://localhost:4999',
      token: 'test-daemon-token',
      transport,
    });
    await client.codexAccount();
    await client.codexModels();
    await client.codexLimits();
    await client.startCodexLogin();
    await client.cancelCodexLogin();
    await client.logoutCodex();
    expect(acpFetch).not.toHaveBeenCalled();
    expect(
      restFetch.mock.calls.map(([url]) => new URL(String(url)).pathname),
    ).toEqual([
      '/codex/account',
      '/codex/models',
      '/codex/limits',
      '/codex/login/start',
      '/codex/login/cancel',
      '/codex/logout',
    ]);
    for (const [, init] of restFetch.mock.calls) {
      expect(
        new Headers((init as RequestInit).headers).get('Authorization'),
      ).toBe('Bearer test-daemon-token');
    }
  });
  it('parses account snapshots through the real SSE parser and reports disconnects', async () => {
    const state = {
      connected: true,
      account: null,
      login: null,
      models: [],
      limits: null,
      error: null,
      updatedAt: 1,
    };
    const event = { v: 1, id: 1, type: 'codex_account', state };
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify(event)}\n\n`,
    );
    const restFetch = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes.slice(0, 12));
              controller.enqueue(bytes.slice(12));
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    );
    const acpFetch = vi
      .fn()
      .mockRejectedValue(new Error('Account stream reached ACP'));
    const client = new DaemonClient({
      baseUrl: 'http://daemon',
      token: 'test-token',
      transport: { restFetch, fetch: acpFetch } as unknown as DaemonTransport,
    });
    const onEvent = vi.fn();
    const onError = vi.fn();
    const stop = client.subscribeCodexEvents({ onEvent, onError });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({
      type: 'codex_account',
      state,
    });
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      message: 'Codex account stream disconnected',
    });
    expect(acpFetch).not.toHaveBeenCalled();
    const [url, init] = restFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://daemon/codex/events');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer test-token',
    );
    stop();
  });

  it('cancels a waiting account stream without treating cleanup as a disconnect', async () => {
    const cancel = vi.fn();
    const restFetch = vi.fn(
      async () =>
        new Response(new ReadableStream({ cancel }), {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    );
    const client = new DaemonClient({
      baseUrl: 'http://daemon',
      fetch: restFetch,
    });
    const onError = vi.fn();
    const stop = client.subscribeCodexEvents({ onEvent: vi.fn(), onError });
    await vi.waitFor(() => expect(restFetch).toHaveBeenCalledOnce());
    stop();
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
    expect(onError).not.toHaveBeenCalled();
  });
});
