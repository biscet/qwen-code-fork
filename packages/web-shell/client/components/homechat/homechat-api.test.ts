import { describe, expect, it, vi } from 'vitest';
import {
  applyHomeChatEvent,
  streamHomeChat,
  type HomeChatBlock,
  HOMECHAT_CODEX_PROVIDER,
} from './homechat-api';

describe('HomeChat stream', () => {
  it.each([false, true])(
    'reattaches a truncated Codex stream with the same accepted request identity (partial JSON: %s)',
    async (partialJson) => {
      const originalFetch = globalThis.fetch;
      const bodies: string[] = [];
      const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
        bodies.push(String(init?.body));
        return new Response(
          bodies.length === 1
            ? '{"type":"block","block":{"id":"a","type":"text","data":"Partial"}}\n' +
              (partialJson ? '{"type":' : '')
            : '{"type":"block","block":{"id":"a","type":"text","data":"Complete"}}\n{"type":"messageEnd"}\n',
        );
      });
      globalThis.fetch = fetch;
      try {
        let blocks: HomeChatBlock[] = [];
        for await (const event of streamHomeChat('', undefined, {
          messageId: 'accepted-message',
          chatId: 'chat',
          content: 'query',
          history: [],
          options: {
            chatModel: { providerId: HOMECHAT_CODEX_PROVIDER, key: 'codex' },
            effort: 'xhigh',
            thinking: true,
            optimizationMode: 'speed',
          },
        }))
          blocks = applyHomeChatEvent(blocks, event);
        expect(bodies).toHaveLength(2);
        expect(bodies[0]).toBe(bodies[1]);
        expect(blocks).toEqual([{ id: 'a', type: 'text', data: 'Complete' }]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  );
  it('parses newline JSON split across network chunks', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      '{"type":"block","block":{"id":"a",',
      '"type":"text","data":"Ответ"}}\n{"type":"messageEnd"}\n',
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks)
              controller.enqueue(encoder.encode(chunk));
            controller.close();
          },
        }),
      );
    try {
      const events = [];
      for await (const event of streamHomeChat('', undefined, {
        messageId: 'message',
        chatId: 'chat',
        content: 'query',
        history: [],
      })) {
        events.push(event);
      }
      expect(events.map((event) => event.type)).toEqual([
        'block',
        'messageEnd',
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('applies Vane text and research block replacements', () => {
    let blocks: HomeChatBlock[] = [
      { id: 'text', type: 'text', data: 'Начало' },
      { id: 'research', type: 'research', data: { subSteps: [] } },
    ];
    blocks = applyHomeChatEvent(blocks, {
      type: 'updateBlock',
      blockId: 'text',
      patch: [{ op: 'replace', path: '/data', value: 'Полный ответ' }],
    });
    blocks = applyHomeChatEvent(blocks, {
      type: 'updateBlock',
      blockId: 'research',
      patch: [
        {
          op: 'replace',
          path: '/data/subSteps',
          value: [{ id: 'step', type: 'searching', searching: ['запрос'] }],
        },
      ],
    });

    expect(blocks[0]).toMatchObject({ data: 'Полный ответ' });
    expect(blocks[1]).toMatchObject({
      data: { subSteps: [{ type: 'searching' }] },
    });
  });
});
