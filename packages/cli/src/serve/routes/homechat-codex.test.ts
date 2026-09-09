/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodexService } from '../codex/codex-service.js';
import { HomeChatStateStore, type HomeChatOptions } from './homechat-state.js';
import {
  HomeChatCodex,
  HOMECHAT_CODEX_PROVIDER,
  type HomeChatCodexEvent,
} from './homechat-codex.js';

const OPTIONS: HomeChatOptions = {
  chatModel: { providerId: HOMECHAT_CODEX_PROVIDER, key: 'codex-test' },
  thinking: true,
  effort: 'xhigh',
  optimizationMode: 'speed',
};
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'homechat-codex-'));
  directories.push(directory);
  const store = new HomeChatStateStore(directory);
  let notify: (
    method: string,
    params: Record<string, unknown>,
  ) => void = () => {};
  let disconnect: (error: Error) => void = () => {};
  let serverRequest: (
    method: string,
    params: Record<string, unknown>,
  ) => unknown = () => undefined;
  const request = vi.fn(
    async (
      method: string,
      _params?: unknown,
    ): Promise<Record<string, unknown>> => {
      if (method === 'thread/start' || method === 'thread/resume')
        return { thread: { id: 'thread-chat' }, instructionSources: [] };
      if (method === 'turn/start')
        return { turn: { id: 'turn-chat', status: 'inProgress' } };
      return {};
    },
  );
  const service = {
    cwd: '/neutral/homechat',
    models: async () => [
      {
        model: 'codex-test',
        displayName: 'Codex Test',
        supportedReasoningEfforts: [
          { reasoningEffort: 'none' },
          { reasoningEffort: 'xhigh' },
        ],
        defaultReasoningEffort: 'xhigh',
      },
    ],
    refresh: vi.fn(async () => ({})),
    onLogout: () => () => {},
    appServer: {
      request,
      onNotification: (listener: typeof notify) => {
        notify = listener;
        return () => {};
      },
      onRequest: (listener: typeof serverRequest) => {
        serverRequest = listener;
        return () => {};
      },
      onDisconnect: (listener: typeof disconnect) => {
        disconnect = listener;
        return () => {};
      },
    },
  } as unknown as CodexService;
  const manager = new HomeChatCodex(store, () => service);
  const input = {
    chatId: 'homechat-test',
    messageId: 'message-test',
    content: 'Search public web',
    options: OPTIONS,
  };
  const events: HomeChatCodexEvent[] = [];
  const controller = new AbortController();
  const start = () =>
    manager.stream(input, (event) => events.push(event), controller.signal);
  const started = () =>
    vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith('turn/start', expect.anything()),
    );
  const complete = () =>
    notify('turn/completed', {
      threadId: 'thread-chat',
      turn: { id: 'turn-chat', status: 'completed', items: [] },
    });
  return {
    store,
    service,
    manager,
    request,
    input,
    events,
    controller,
    start,
    started,
    complete,
    notify: (method: string, params: Record<string, unknown>) =>
      notify(method, params),
    disconnect: (error: Error) => disconnect(error),
    serverRequest: (method: string, params: Record<string, unknown>) =>
      serverRequest(method, params),
  };
}

describe('Codex HomeChat protocol and persistence', () => {
  it.each([
    ['start', ['/homecode/codex/AGENTS.md']],
    ['start', undefined],
    ['resume', ['/homecode/codex/AGENTS.md']],
    ['resume', undefined],
  ])(
    'does not send a model turn when %s lacks confirmed empty instruction sources (%j)',
    async (operation, instructionSources) => {
      const f = fixture();
      if (operation === 'resume') {
        const first = f.start();
        await f.started();
        f.complete();
        await first;
      }
      f.request.mockClear();
      f.request.mockResolvedValueOnce({
        thread: { id: 'thread-chat' },
        instructionSources,
      });
      await f.manager.stream(
        { ...f.input, messageId: 'isolation-message' },
        () => {},
        new AbortController().signal,
      );
      expect(f.request).toHaveBeenCalledExactlyOnceWith(
        `thread/${operation}`,
        expect.anything(),
      );
      expect(f.manager.get(f.input.chatId)).toMatchObject({
        threadId: 'thread-chat',
        messages: expect.arrayContaining([
          expect.objectContaining({
            messageId: 'isolation-message',
            status: 'error',
            responseBlocks: [
              expect.objectContaining({
                type: 'error',
                data: {
                  message: expect.stringContaining('локальные инструкции'),
                },
              }),
            ],
          }),
        ]),
      });
    },
  );

  it('recovers source links with the answer after a disconnect without replaying the turn', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    f.disconnect(new Error('Codex process exited'));
    await stream;
    f.request.mockResolvedValueOnce({
      thread: {
        turns: [
          {
            id: 'turn-chat',
            status: 'completed',
            items: [
              {
                id: 'search',
                type: 'webSearch',
                results: [
                  { url: 'https://example.com', title: 'Source' },
                  { url: 'file:///secret' },
                ],
              },
              { id: 'answer', type: 'agentMessage', text: 'Recovered answer' },
            ],
          },
        ],
      },
    });
    const recovered = await f.manager.recover(f.input.chatId);
    expect(recovered?.messages[0]).toMatchObject({
      status: 'completed',
      responseBlocks: [
        {
          id: 'search',
          type: 'source',
          data: [
            {
              content: '',
              metadata: { title: 'Source', url: 'https://example.com/' },
            },
          ],
        },
        { id: 'answer', type: 'text', data: 'Recovered answer' },
      ],
    });
    expect(
      f.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });

  it('deletes the native thread before removing its local history', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    f.complete();
    await stream;
    f.request.mockImplementation(async (method) => {
      if (method === 'thread/delete')
        expect(f.manager.get(f.input.chatId)).toBeDefined();
      return {};
    });
    await f.manager.delete(f.input.chatId);
    expect(f.request).toHaveBeenLastCalledWith('thread/delete', {
      threadId: 'thread-chat',
    });
    expect(f.manager.get(f.input.chatId)).toBeUndefined();
  });

  it('preserves local history when native thread deletion fails', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    f.complete();
    await stream;
    f.request.mockRejectedValueOnce(new Error('Native history unavailable'));
    await expect(f.manager.delete(f.input.chatId)).rejects.toThrow(
      'Native history unavailable',
    );
    expect(f.store.read().codexChats?.[f.input.chatId]?.threadId).toBe(
      'thread-chat',
    );
  });

  it('stops an admitted request while catalog validation is pending without starting a model turn', async () => {
    const f = fixture();
    const models = await f.service.models();
    let release = () => {};
    vi.spyOn(f.service, 'models').mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(models);
      }),
    );
    const stream = f.start();
    const stopped = f.manager.stop(f.input.chatId);
    release();
    await Promise.all([stream, stopped]);
    expect(f.request).not.toHaveBeenCalled();
    expect(f.manager.get(f.input.chatId)?.messages[0]?.status).toBe('stopped');
  });

  it('ignores a previous turn completion while a subsequent turn is active', async () => {
    const f = fixture();
    const first = f.start();
    await f.started();
    f.complete();
    await first;
    f.request.mockImplementation(async (method) =>
      method === 'thread/resume'
        ? { thread: { id: 'thread-chat' }, instructionSources: [] }
        : { turn: { id: 'turn-next', status: 'inProgress' } },
    );
    const next = f.manager.stream(
      { ...f.input, messageId: 'next-message', content: 'Next query' },
      () => {},
      new AbortController().signal,
    );
    await vi.waitFor(() =>
      expect(f.manager.get(f.input.chatId)?.messages.at(-1)?.turnId).toBe(
        'turn-next',
      ),
    );
    f.complete();
    expect(f.manager.get(f.input.chatId)?.messages.at(-1)?.status).toBe(
      'answering',
    );
    f.notify('turn/completed', {
      threadId: 'thread-chat',
      turn: { id: 'turn-next', status: 'completed', items: [] },
    });
    await next;
  });

  it('sends empty environment roots and tools with only conversation input and model catalog effort', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    expect(f.request).toHaveBeenCalledWith(
      'thread/start',
      expect.objectContaining({
        cwd: '/neutral/homechat',
        runtimeWorkspaceRoots: [],
        environments: [],
        dynamicTools: [],
        selectedCapabilityRoots: [],
        config: expect.objectContaining({
          include_environment_context: false,
          project_doc_max_bytes: 0,
          'features.shell_tool': false,
          'features.skip_host_skill_discovery': true,
          'features.computer_use': false,
          'agents.enabled': false,
          'features.multi_agent_v2': false,
          'features.code_mode': {
            enabled: false,
            excluded_tool_namespaces: ['clock'],
            direct_only_tool_namespaces: ['web'],
          },
          'orchestrator.skills.enabled': false,
          'orchestrator.mcp.enabled': false,
          'skills.bundled.enabled': false,
          'skills.include_instructions': false,
          'tools.experimental_request_user_input.enabled': false,
          web_search: 'live',
        }),
      }),
    );
    expect(f.request).toHaveBeenCalledWith(
      'turn/start',
      expect.objectContaining({
        input: [{ type: 'text', text: 'Search public web', text_elements: [] }],
        clientUserMessageId: 'message-test',
        environments: [],
        runtimeWorkspaceRoots: [],
        additionalContext: {},
        effort: 'xhigh',
      }),
    );
    f.notify('item/agentMessage/delta', {
      threadId: 'thread-chat',
      itemId: 'answer',
      delta: 'Hello ',
    });
    f.notify('item/agentMessage/delta', {
      threadId: 'thread-chat',
      itemId: 'answer',
      delta: 'world',
    });
    f.complete();
    await stream;
    expect(f.manager.get(f.input.chatId)?.messages[0]).toMatchObject({
      status: 'completed',
      responseBlocks: [{ id: 'answer', data: 'Hello world' }],
    });
    const reopened = new HomeChatCodex(f.store, () => {
      throw new Error('No runtime for history');
    });
    expect(reopened.get(f.input.chatId)?.threadId).toBe('thread-chat');
    expect(reopened.list()).toHaveLength(1);
  });

  it('reattaches using the accepted message id without sending another model turn', async () => {
    const f = fixture();
    const first = f.start();
    await f.started();
    f.notify('item/agentMessage/delta', {
      threadId: 'thread-chat',
      itemId: 'answer',
      delta: 'Partial',
    });
    f.controller.abort();
    await first;
    const replay: HomeChatCodexEvent[] = [];
    const second = f.manager.stream(
      f.input,
      (event) => replay.push(event),
      new AbortController().signal,
    );
    expect(replay[0]).toMatchObject({ block: { data: 'Partial' } });
    f.complete();
    await second;
    await f.manager.stream(f.input, () => {}, new AbortController().signal);
    expect(
      f.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });

  it('rejects unsupported effort before any thread or turn request', async () => {
    const f = fixture();
    const events: HomeChatCodexEvent[] = [];
    await f.manager.stream(
      { ...f.input, options: { ...OPTIONS, effort: 'high' } },
      (event) => events.push(event),
      new AbortController().signal,
    );
    expect(events.at(-1)).toMatchObject({
      type: 'error',
      data: expect.stringContaining('reasoning'),
    });
    expect(f.request).not.toHaveBeenCalled();
  });

  it('rejects local requests only for HomeChat-owned threads and interrupts the active turn', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    expect(
      f.serverRequest('item/tool/call', { threadId: 'harness-thread' }),
    ).toBeUndefined();
    expect(
      f.serverRequest('item/tool/call', { threadId: 'thread-chat' }),
    ).toMatchObject({ success: false });
    await stream;
    expect(f.request).toHaveBeenCalledWith('turn/interrupt', {
      threadId: 'thread-chat',
      turnId: 'turn-chat',
    });
    expect(f.manager.get(f.input.chatId)?.messages[0]?.status).toBe('stopped');
  });

  it('retains an interrupted request after process loss and never repeats it', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    f.disconnect(new Error('Codex process exited'));
    await stream;
    const reopened = new HomeChatCodex(f.store, () => f.service);
    await reopened.stream(f.input, () => {}, new AbortController().signal);
    expect(reopened.get(f.input.chatId)?.messages[0]?.status).toBe('error');
    expect(
      f.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });

  it('keeps public source links and rejects local source URLs', async () => {
    const f = fixture();
    const stream = f.start();
    await f.started();
    f.notify('item/completed', {
      threadId: 'thread-chat',
      item: {
        id: 'search',
        type: 'webSearch',
        results: [
          { url: 'https://example.com', title: 'Source' },
          { url: 'file:///secret' },
        ],
      },
    });
    f.complete();
    await stream;
    expect(f.manager.get(f.input.chatId)?.messages[0]?.responseBlocks).toEqual([
      {
        id: 'search',
        type: 'source',
        data: [
          {
            content: '',
            metadata: { title: 'Source', url: 'https://example.com/' },
          },
        ],
      },
    ]);
  });
});

it('sends selected document contents and inline images to Codex, retaining refs for idempotent reconnect', async () => {
  const f = fixture();
  const attachments = [
    {
      id: 'attachment-doc',
      name: 'probe.txt',
      mimeType: 'text/plain',
      size: 12,
    },
    {
      id: 'attachment-image',
      name: 'probe.png',
      mimeType: 'image/png',
      size: 1,
    },
  ];
  const input = {
    ...f.input,
    attachments,
    files: [
      { ...attachments[0]!, text: 'violet-attach-42' },
      { ...attachments[1]!, imageUrl: 'data:image/png;base64,eA==' },
    ],
  };
  const stream = f.manager.stream(input, () => {}, f.controller.signal);
  await f.started();
  expect(f.request).toHaveBeenCalledWith(
    'turn/start',
    expect.objectContaining({
      input: [
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('violet-attach-42'),
        }),
        { type: 'image', url: 'data:image/png;base64,eA==' },
      ],
    }),
  );
  f.complete();
  await stream;
  expect(f.manager.get(f.input.chatId)?.messages[0]?.attachments).toEqual(
    attachments,
  );
  await f.manager.stream(input, () => {}, f.controller.signal);
  expect(
    f.request.mock.calls.filter(([method]) => method === 'turn/start'),
  ).toHaveLength(1);
  await expect(
    f.manager.stream(
      { ...input, attachments: [] },
      () => {},
      f.controller.signal,
    ),
  ).rejects.toThrow('уже использован');
});
