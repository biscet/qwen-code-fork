// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { HomeChatModelPicker } from './HomeChatModelPicker';
import type { HomeChatModel, HomeChatOptions } from './homechat-api';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const models: HomeChatModel[] = [
  {
    providerId: 'local',
    key: 'qwen',
    name: 'Qwen3.8-27B',
    providerName: 'Локальные модели',
    reasoning: true,
  },
  {
    providerId: 'llm7',
    key: 'gpt-oss',
    name: 'GPT-OSS · LLM7 · бесплатно',
    providerName: 'LLM7',
    reasoning: false,
  },
];
const options: HomeChatOptions = {
  chatModel: { providerId: 'local', key: 'qwen' },
  thinking: true,
  effort: 'medium',
  optimizationMode: 'speed',
};

describe('HomeChatModelPicker', () => {
  it('returns from the model submenu with the keyboard and closes/reset search after selection', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn().mockResolvedValue(undefined);
    const modelTrigger = () =>
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Список моделей"]',
      )!;
    const search = () =>
      document.querySelector<HTMLInputElement>(
        'input[aria-label="Поиск моделей"]',
      )!;
    const openPicker = async () => {
      await act(async () => {
        container.querySelector<HTMLButtonElement>('button')!.click();
      });
      await act(async () => {
        modelTrigger().dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
        );
      });
    };
    try {
      await act(async () => {
        root.render(
          <HomeChatModelPicker
            models={models}
            options={options}
            disabled={false}
            onChange={onChange}
          />,
        );
      });
      await openPicker();
      expect(document.activeElement).toBe(search());
      await act(async () => {
        search().dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
        );
      });
      expect(search()).toBeNull();
      expect(document.activeElement).toBe(modelTrigger());
      await act(async () => modelTrigger().click());
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )!.set!.call(search(), 'GPT');
        search().dispatchEvent(new Event('input', { bubbles: true }));
      });
      const submenu = document.querySelector('[data-web-shell-model-submenu]')!;
      expect(submenu.querySelectorAll('button')).toHaveLength(1);
      await act(async () => {
        submenu.querySelector<HTMLButtonElement>('button')!.click();
      });
      expect(onChange).toHaveBeenCalledWith({
        ...options,
        chatModel: { providerId: 'llm7', key: 'gpt-oss' },
        thinking: false,
      });
      expect(
        document.querySelector('[data-web-shell-toolbar-popover]'),
      ).toBeNull();
      await openPicker();
      expect(search().value).toBe('');
      expect(
        document.querySelectorAll('[data-web-shell-model-submenu] button'),
      ).toHaveLength(2);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
