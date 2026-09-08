/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HomeChatStateStore } from './homechat-state.js';
import { registerHomeChatRoutes } from './homechat.js';
import { HOMECHAT_CODEX_PROVIDER } from './homechat-codex.js';

vi.mock('../codex/codex-service.js', () => ({
  getCodexService: () => ({ models: async () => [] }),
}));

const CHAT_ID = 'homechat-018f0ec4-31c4-4f2f-9c1f-5f47e6be37f1';
const MESSAGE_ID = '018f0ec4-31c4-4f2f-9c1f-5f47e6be37f2';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const directories: string[] = [];
function createStore() {
  const directory = mkdtempSync(join(tmpdir(), 'homechat-test-'));
  directories.push(directory);
  return new HomeChatStateStore(directory);
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function mount(fetchImpl: typeof fetch, stateStore = createStore()) {
  const app = express();
  app.use(express.json());
  const mutate = (): RequestHandler => (_req, _res, next) => next();
  registerHomeChatRoutes(app, {
    mutate,
    fetchImpl,
    backendUrl: 'http://vane.test',
    stateStore,
  });
  return app;
}

describe('HomeChat routes', () => {
  it('uses authenticated server Vane for desktop catalog, selection, streaming and history', async () => {
    vi.stubEnv('QWEN_CODE_DESKTOP', '1');
    vi.stubEnv('LOCAL_QWEN_API_KEY', 'desktop-server-test-key');
    const providers = {
      providers: [
        {
          id: 'home-ai-openai-llm7',
          name: 'LLM7',
          chatModels: [
            { key: 'codestral-latest', name: 'Codestral · LLM7 · бесплатно' },
            { key: 'gpt-oss', name: 'GPT-OSS · LLM7 · бесплатно' },
          ],
          embeddingModels: [{ key: 'embedding' }],
        },
      ],
    };
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/providers')) return jsonResponse(providers);
      if (url.endsWith('/api/chat')) {
        return new Response('{"type":"messageEnd"}\n');
      }
      return jsonResponse({ chats: [{ id: CHAT_ID }], messages: [] });
    });
    const app = express();
    app.use(express.json());
    registerHomeChatRoutes(app, {
      mutate: () => (_req, _res, next) => next(),
      fetchImpl,
      stateStore: createStore(),
    });
    const catalog = await request(app).get('/homechat/models');
    expect(
      catalog.body.models.map((model: { key: string }) => model.key),
    ).toEqual(['codestral-latest', 'gpt-oss']);
    for (const key of ['codestral-latest', 'gpt-oss']) {
      const options = {
        chatModel: { providerId: 'home-ai-openai-llm7', key },
        thinking: false,
        effort: 'medium',
        optimizationMode: 'speed',
      };
      expect(
        (await request(app).put('/homechat/options').send(options)).status,
      ).toBe(200);
      const response = await request(app).post('/homechat/chat').send({
        messageId: MESSAGE_ID,
        chatId: CHAT_ID,
        content: 'Что нового?',
        history: [],
        options,
      });
      expect(response.status).toBe(200);
      expect(response.text).toContain('messageEnd');
    }
    expect((await request(app).get('/homechat/chats')).status).toBe(200);
    expect((await request(app).get(`/homechat/chats/${CHAT_ID}`)).status).toBe(
      200,
    );
    expect(
      (
        await request(app)
          .patch(`/homechat/chats/${CHAT_ID}`)
          .send({ pinned: true })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/homechat/chats/${CHAT_ID}`)).status,
    ).toBe(200);
    for (const [input, init] of fetchImpl.mock.calls) {
      expect(String(input)).toMatch(
        /^https:\/\/biscet-server\.local:9454\/homechat\/api\//,
      );
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer desktop-server-test-key',
      );
      expect(init?.redirect).toBe('error');
      if (String(input).endsWith('/api/chat')) {
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('Content-Type')).toBe(
          'application/json',
        );
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ sources: ['web'], files: [] });
        expect(body).not.toHaveProperty('workspace');
        expect(body).not.toHaveProperty('tools');
      }
    }
  });

  it('does not fall back to local Vane when desktop server credentials are missing', async () => {
    vi.stubEnv('QWEN_CODE_DESKTOP', '1');
    vi.stubEnv('LOCAL_QWEN_API_KEY', undefined);
    const fetchImpl = vi.fn<typeof fetch>();
    const app = express();
    registerHomeChatRoutes(app, {
      mutate: () => (_req, _res, next) => next(),
      fetchImpl,
      stateStore: createStore(),
    });
    const response = await request(app).get('/homechat/models');
    expect(response.body.models).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses a newly saved server key without restarting the desktop daemon', async () => {
    vi.stubEnv('QWEN_CODE_DESKTOP', '1');
    vi.stubEnv('LOCAL_QWEN_API_KEY', 'stale-boot-test-key');
    let savedKey = 'first-saved-test-key';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(PROVIDERS));
    const app = express();
    registerHomeChatRoutes(app, {
      mutate: () => (_req, _res, next) => next(),
      fetchImpl,
      stateStore: createStore(),
      getBackendApiKey: () => savedKey,
    });
    await request(app).get('/homechat/models');
    savedKey = 'updated-saved-test-key';
    await request(app).get('/homechat/models');
    expect(
      fetchImpl.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('Authorization'),
      ),
    ).toEqual(['Bearer first-saved-test-key', 'Bearer updated-saved-test-key']);
  });

  it('keeps Codex history and organization available independently of Vane and account login', async () => {
    const store = createStore();
    store.update((state) => {
      state.codexChats = {
        [CHAT_ID]: {
          id: CHAT_ID,
          title: 'Codex history',
          createdAt: '2026-09-07T00:00:00Z',
          options: {
            chatModel: { providerId: HOMECHAT_CODEX_PROVIDER, key: 'codex' },
            effort: 'xhigh',
            thinking: true,
            optimizationMode: 'speed',
          },
          messages: [],
        },
      };
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Vane offline'));
    const app = mount(fetchImpl, store);
    const list = await request(app).get('/homechat/chats');
    expect(list.status).toBe(200);
    expect(list.body.chats).toMatchObject([{ id: CHAT_ID, engine: 'codex' }]);
    fetchImpl.mockClear();
    const detail = await request(app).get(`/homechat/chats/${CHAT_ID}`);
    expect(detail.body).toMatchObject({
      engine: 'codex',
      messages: [],
      options: { chatModel: { providerId: HOMECHAT_CODEX_PROVIDER } },
    });
    expect(
      (
        await request(app)
          .patch(`/homechat/chats/${CHAT_ID}`)
          .send({ pinned: true, archived: true })
      ).status,
    ).toBe(200);
    expect(store.read().chats[CHAT_ID]).toEqual({
      pinned: true,
      archived: true,
    });
    const mismatch = await request(app).post('/homechat/chat').send({
      chatId: CHAT_ID,
      messageId: MESSAGE_ID,
      content: 'Hello',
      history: [],
    });
    expect(mismatch.status).toBe(409);
    expect(
      (await request(app).delete(`/homechat/chats/${CHAT_ID}`)).status,
    ).toBe(200);
    expect(store.read().codexChats?.[CHAT_ID]).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not replace a saved Codex selection when its account is logged out', async () => {
    const store = createStore();
    const options = {
      chatModel: { providerId: HOMECHAT_CODEX_PROVIDER, key: 'codex' },
      effort: 'xhigh',
      thinking: true,
      optimizationMode: 'speed' as const,
    };
    store.update((state) => {
      state.options = options;
    });
    const app = mount(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(PROVIDERS)),
      store,
    );
    const response = await request(app).get('/homechat/models');
    expect(response.status).toBe(200);
    expect(response.body.options).toEqual(options);
    expect(response.body.models).toHaveLength(2);
  });

  it('returns only the dedicated HomeChat history', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        chats: [
          { id: CHAT_ID, title: 'HomeChat query' },
          { id: 'vane-chat', title: 'Vane query' },
        ],
      }),
    );

    const response = await request(mount(fetchImpl)).get('/homechat/chats');

    expect(response.status).toBe(200);
    expect(response.body.chats).toEqual([
      { id: CHAT_ID, title: 'HomeChat query' },
    ]);
  });

  it('rejects chat ids outside the HomeChat namespace', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = mount(fetchImpl);

    expect((await request(app).get('/homechat/chats/local-files')).status).toBe(
      400,
    );
    expect(
      (await request(app).delete('/homechat/chats/local-files')).status,
    ).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('forwards a fixed web-only research request and streams its response', async () => {
    let forwardedBody: Record<string, unknown> | undefined;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/providers')) {
        return jsonResponse({
          providers: [
            {
              id: 'home-ai-openai-local',
              chatModels: [
                {
                  key: 'local-mlx/local-qwen35-4b',
                  name: 'Qwen Local',
                },
                {
                  key: 'windows-lmstudio/windows-qwen35-9b',
                  name: 'Qwen3.8-27B',
                },
              ],
              embeddingModels: [],
            },
            {
              id: 'home-ai-transformers-local',
              chatModels: [],
              embeddingModels: [
                { key: 'Xenova/all-MiniLM-L6-v2', name: 'MiniLM' },
              ],
            },
          ],
        });
      }
      forwardedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        `${JSON.stringify({ type: 'block', block: { id: 'a', type: 'text', data: 'Ответ' } })}\n${JSON.stringify({ type: 'messageEnd' })}\n`,
        { status: 200 },
      );
    });
    const response = await request(mount(fetchImpl))
      .post('/homechat/chat')
      .send({
        messageId: MESSAGE_ID,
        chatId: CHAT_ID,
        content: 'Что нового?',
        history: [],
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain('messageEnd');
    expect(forwardedBody).toMatchObject({
      optimizationMode: 'speed',
      sources: ['web'],
      files: [],
      chatModel: {
        providerId: 'home-ai-openai-local',
        key: 'windows-lmstudio/windows-qwen35-9b',
      },
      embeddingModel: {
        providerId: 'home-ai-transformers-local',
        key: 'Xenova/all-MiniLM-L6-v2',
      },
    });
    expect(String(forwardedBody?.['systemInstructions'])).toContain(
      "no access to the user's computer",
    );
    expect(forwardedBody).not.toHaveProperty('workspace');
    expect(forwardedBody).not.toHaveProperty('tools');
  });

  it('rejects extra fields that could widen the research boundary', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const response = await request(mount(fetchImpl))
      .post('/homechat/chat')
      .send({
        messageId: MESSAGE_ID,
        chatId: CHAT_ID,
        content: 'Read my files',
        history: [],
        files: ['/Users/me/secret.txt'],
      });

    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

const OPTIONS = {
  chatModel: { providerId: 'openai', key: 'model-b' },
  thinking: true,
  effort: 'high',
  optimizationMode: 'balanced',
};
const PROVIDERS = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      chatModels: [
        { key: 'model-a' },
        { key: 'model-b', name: 'Second model', homechatReasoning: true },
      ],
      embeddingModels: [{ key: 'embedding' }],
    },
  ],
};

describe('HomeChat models and organization', () => {
  it.each([false, true])(
    'defaults to the local 27B with free models listed first (removed saved model: %s)',
    async (savedRemovedModel) => {
      const store = createStore();
      if (savedRemovedModel) {
        store.update((state) => {
          state.options = {
            chatModel: {
              providerId: 'home-ai-openai-local',
              key: 'local-mlx/local-qwen35-4b',
            },
            thinking: false,
            effort: 'medium',
            optimizationMode: 'speed',
          };
        });
      }
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
        jsonResponse({
          providers: [
            {
              id: 'home-ai-openai-llm7',
              name: 'LLM7',
              chatModels: [
                {
                  key: 'codestral-latest',
                  name: 'Codestral · LLM7 · бесплатно',
                },
                { key: 'gpt-oss', name: 'GPT-OSS · LLM7 · бесплатно' },
              ],
            },
            {
              id: 'home-ai-openai-local',
              chatModels: [
                {
                  key: 'windows-lmstudio/windows-qwen35-9b',
                  name: 'Qwen3.8-27B',
                  homechatReasoning: true,
                },
              ],
              embeddingModels: [{ key: 'embedding' }],
            },
          ],
        }),
      );
      const response = await request(mount(fetchImpl, store)).get(
        '/homechat/models',
      );
      expect(response.status).toBe(200);
      expect(response.body.options.chatModel).toEqual({
        providerId: 'home-ai-openai-local',
        key: 'windows-lmstudio/windows-qwen35-9b',
      });
      expect(
        response.body.models.map((model: { name: string }) => model.name),
      ).toEqual([
        'Codestral · LLM7 · бесплатно',
        'GPT-OSS · LLM7 · бесплатно',
        'Qwen3.8-27B',
      ]);
    },
  );

  it('returns public model identities and restores saved Chat-only options', async () => {
    const store = createStore();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(PROVIDERS));
    const app = mount(fetchImpl, store);
    expect(
      (await request(app).put('/homechat/options').send(OPTIONS)).status,
    ).toBe(200);
    const result = await request(mount(fetchImpl, store)).get(
      '/homechat/models',
    );
    expect(result.body.options).toEqual(OPTIONS);
    expect(result.body.models[1]).toEqual({
      providerId: 'openai',
      key: 'model-b',
      name: 'Second model',
      providerName: 'OpenAI',
      reasoning: true,
    });
    expect(store.read().chats).toEqual({});
  });

  it('forwards chosen model, Thinking, effort and research depth to the internet-only backend', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).endsWith('/api/providers')
          ? jsonResponse(PROVIDERS)
          : new Response('{"type":"messageEnd"}\n'),
      );
    const response = await request(mount(fetchImpl))
      .post('/homechat/chat')
      .send({
        messageId: MESSAGE_ID,
        chatId: CHAT_ID,
        content: 'Test',
        history: [],
        options: OPTIONS,
      });
    expect(response.status).toBe(200);
    const body = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(body).toMatchObject({
      chatModel: OPTIONS.chatModel,
      homechatReasoning: { thinking: true, effort: 'high' },
      optimizationMode: 'balanced',
      sources: ['web'],
      files: [],
    });
    expect(body).not.toHaveProperty('workspace');
    expect(body).not.toHaveProperty('tools');
  });

  it.each([
    { ...OPTIONS, chatModel: { providerId: 'openai', key: 'unknown' } },
    { ...OPTIONS, chatModel: { providerId: 'openai', key: 'model-a' } },
    { ...OPTIONS, effort: 'invalid' },
    { ...OPTIONS, effort: ['high'] },
    { ...OPTIONS, optimizationMode: ['speed'] },
    { ...OPTIONS, thinking: 'true' },
    { ...OPTIONS, optimizationMode: 'unbounded' },
    {
      ...OPTIONS,
      chatModel: { ...OPTIONS.chatModel, baseUrl: 'http://evil.test' },
    },
    { ...OPTIONS, tools: ['read_file'] },
  ])('rejects invalid or unconfigured options: %j', async (options) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse(PROVIDERS));
    const app = mount(fetchImpl);
    expect(
      (await request(app).put('/homechat/options').send(options)).status,
    ).toBe(400);
    expect(
      (
        await request(app).post('/homechat/chat').send({
          messageId: MESSAGE_ID,
          chatId: CHAT_ID,
          content: 'Test',
          history: [],
          options,
        })
      ).status,
    ).toBe(400);
    expect(
      fetchImpl.mock.calls.every(([url]) =>
        String(url).endsWith('/api/providers'),
      ),
    ).toBe(true);
  });

  it('persists flags through remount, restores and deletes only the intended metadata', async () => {
    const store = createStore();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).endsWith('/api/chats')
        ? jsonResponse({
            chats: [
              { id: CHAT_ID, title: 'Test' },
              { id: 'ordinary-vane-chat' },
            ],
          })
        : jsonResponse({ messages: [] }),
    );
    const app = mount(fetchImpl, store);
    expect(
      (
        await request(app)
          .patch(`/homechat/chats/${CHAT_ID}`)
          .send({ pinned: true, archived: true })
      ).status,
    ).toBe(200);
    const second = mount(fetchImpl, store);
    expect((await request(second).get('/homechat/chats')).body.chats).toEqual([
      { id: CHAT_ID, title: 'Test', pinned: true, archived: true },
    ]);
    await request(second)
      .patch(`/homechat/chats/${CHAT_ID}`)
      .send({ archived: false });
    expect(store.read().chats[CHAT_ID]).toEqual({
      pinned: true,
      archived: false,
    });
    await request(second).delete(`/homechat/chats/${CHAT_ID}`);
    expect(store.read().chats).toEqual({});
  });

  it('rejects metadata outside Chat and unsupported metadata fields without upstream calls', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const app = mount(fetchImpl);
    for (const [id, flags] of [
      ['harness-chat', { archived: true }],
      [CHAT_ID, { workspace: '/tmp' }],
      [CHAT_ID, { pinned: 'true' }],
      [CHAT_ID, {}],
    ] as const) {
      expect(
        (await request(app).patch(`/homechat/chats/${id}`).send(flags)).status,
      ).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not mutate metadata when upstream chat is missing or deletion fails', async () => {
    const store = createStore();
    store.update((state) => {
      state.chats[CHAT_ID] = { pinned: true };
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => jsonResponse({ error: 'Missing' }, 404));
    const app = mount(fetchImpl, store);
    expect(
      (
        await request(app)
          .patch(`/homechat/chats/${CHAT_ID}`)
          .send({ archived: true })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/homechat/chats/${CHAT_ID}`)).status,
    ).toBe(404);
    expect(store.read().chats[CHAT_ID]).toEqual({ pinned: true });
  });
  it('reports successful deletion even if metadata cleanup fails', async () => {
    const store = createStore();
    vi.spyOn(store, 'update').mockImplementation(() => {
      throw new Error('Read-only metadata');
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ success: true }));
    expect(
      (
        await request(mount(fetchImpl, store)).delete(
          `/homechat/chats/${CHAT_ID}`,
        )
      ).status,
    ).toBe(200);
  });
  it('does not send reasoning parameters to other models of the same provider', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).endsWith('/api/providers')
          ? jsonResponse(PROVIDERS)
          : new Response('{"type":"messageEnd"}\n'),
      );
    const response = await request(mount(fetchImpl))
      .post('/homechat/chat')
      .send({
        messageId: MESSAGE_ID,
        chatId: CHAT_ID,
        content: 'Test',
        history: [],
        options: {
          ...OPTIONS,
          thinking: false,
          chatModel: { providerId: 'openai', key: 'model-a' },
        },
      });
    expect(response.status).toBe(200);
    expect(
      JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)),
    ).not.toHaveProperty('homechatReasoning');
  });
});
