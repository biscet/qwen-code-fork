// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { HomeChatModelPicker } from './HomeChatModelPicker';
import {
  HOMECHAT_CODEX_PROVIDER,
  type HomeChatModel,
  type HomeChatOptions,
} from './homechat-api';

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
  {
    providerId: HOMECHAT_CODEX_PROVIDER,
    key: 'gpt-5',
    name: 'GPT-5',
    providerName: 'OpenAI · вход ChatGPT',
    reasoning: true,
    reasoningEfforts: ['low', 'high'],
    defaultReasoningEffort: 'low',
  },
];
const options: HomeChatOptions = {
  chatModel: { providerId: 'local', key: 'qwen' },
  thinking: true,
  effort: 'medium',
  optimizationMode: 'speed',
};

describe('HomeChatModelPicker', () => {
  it('uses the selected Codex catalog reasoning options and hides Vane depth and thinking switch', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn().mockResolvedValue(undefined);
    const model: HomeChatModel = {
      providerId: HOMECHAT_CODEX_PROVIDER,
      key: 'codex',
      name: 'Codex',
      providerName: 'OpenAI · вход ChatGPT',
      reasoning: true,
      reasoningEfforts: ['none', 'xhigh'],
      defaultReasoningEffort: 'xhigh',
    };
    try {
      await act(async () =>
        root.render(
          <HomeChatModelPicker
            models={[model]}
            options={{
              ...options,
              chatModel: { providerId: model.providerId, key: model.key },
              effort: 'xhigh',
            }}
            disabled={false}
            onChange={onChange}
          />,
        ),
      );
      await act(async () =>
        container.querySelector<HTMLButtonElement>('button')!.click(),
      );
      const popup = document.querySelector(
        '[data-web-shell-reasoning-popover]',
      )!;
      expect(popup.textContent).toContain('Очень высокий');
      expect(popup.textContent).toContain('Без размышлений');
      expect(popup.textContent).not.toContain('Глубина исследования');
      expect(popup.querySelector('[role="switch"]')).toBeNull();
      const none = [...popup.querySelectorAll('button')].find(
        (button) => button.textContent === 'Без размышлений',
      )!;
      await act(async () => none.click());
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ effort: 'none' }),
      );
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
  it('uses Harness groups and single-line rows, returns with the keyboard and resets search after selection', async () => {
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
      const initialSubmenu = document.querySelector(
        '[data-web-shell-model-submenu]',
      )!;
      expect(initialSubmenu.textContent).toContain('Qwen');
      expect(initialSubmenu.textContent).toContain('Codex');
      expect(initialSubmenu.textContent).not.toContain('OpenAI · вход ChatGPT');
      expect(
        [...initialSubmenu.querySelectorAll('button')].map(
          (button) => button.textContent,
        ),
      ).toEqual(['Qwen3.8-27B', 'GPT-OSS · LLM7 · бесплатно', 'GPT-5']);
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
        )!.set!.call(search(), ' GPT-OSS ');
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
      ).toHaveLength(3);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
