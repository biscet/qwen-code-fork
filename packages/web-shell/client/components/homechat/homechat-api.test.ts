import { describe, expect, it } from 'vitest';
import {
  applyHomeChatEvent,
  streamHomeChat,
  type HomeChatBlock,
} from './homechat-api';

describe('HomeChat stream', () => {
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
