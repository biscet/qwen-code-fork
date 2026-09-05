/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerHomeChatRoutes } from './homechat.js';

const CHAT_ID = 'homechat-018f0ec4-31c4-4f2f-9c1f-5f47e6be37f1';
const MESSAGE_ID = '018f0ec4-31c4-4f2f-9c1f-5f47e6be37f2';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mount(fetchImpl: typeof fetch) {
  const app = express();
  app.use(express.json());
  const mutate = (): RequestHandler => (_req, _res, next) => next();
  registerHomeChatRoutes(app, {
    mutate,
    fetchImpl,
    backendUrl: 'http://vane.test',
  });
  return app;
}

describe('HomeChat routes', () => {
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
                  key: 'windows-lmstudio/windows-qwen35-9b',
                  name: 'Qwen Windows',
                },
                {
                  key: 'local-mlx/local-qwen35-4b',
                  name: 'Qwen Local',
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
        key: 'local-mlx/local-qwen35-4b',
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
