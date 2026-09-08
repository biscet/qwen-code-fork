// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HomeChatApp } from './HomeChatApp';
import { saveHomeChatOptions, type HomeChatOptions } from './homechat-api';
import type { ModelSettingsSelection } from '../messages/ModelSettingsPanel';
import styles from './HomeChatApp.module.css';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('HomeChatApp', () => {
  it('applies the CSS Modules dark-theme class', () => {
    const markup = renderToStaticMarkup(
      <HomeChatApp
        baseUrl="http://localhost"
        theme="dark"
        versionLabel="1.3.0"
        onProductChange={() => undefined}
        renderAdministrationPanel={() => null}
      />,
    );

    expect(markup).toContain(`class="${styles.root} ${styles.dark} dark"`);
  });

  it('places the mode picker outside the native drag region and before new chat', () => {
    const markup = renderToStaticMarkup(
      <HomeChatApp
        baseUrl="http://localhost"
        theme="dark"
        macOSDesktop
        versionLabel="1.3.0"
        onProductChange={() => undefined}
        renderAdministrationPanel={() => null}
      />,
    );
    const modeIndex = markup.indexOf('aria-label="Режим: Chat"');
    const newChatIndex = markup.indexOf('aria-label="Новый чат"');
    expect(modeIndex).toBeGreaterThan(0);
    expect(newChatIndex).toBeGreaterThan(modeIndex);
    expect(markup).not.toMatch(/data-tauri-drag-region[^>]*>[^<]*<button/);
  });

  it('selects advertised Codex and LLM7 models from settings through HomeChat options only', async () => {
    let codexAvailable = false;
    let options: HomeChatOptions = {
      chatModel: {
        providerId: 'catalog-llm7-provider',
        key: 'codestral-latest',
      },
      thinking: false,
      effort: 'medium',
      optimizationMode: 'speed',
    };
    const saved: HomeChatOptions[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/options')) {
        options = JSON.parse(String(init?.body)) as HomeChatOptions;
        saved.push(options);
        return Response.json({});
      }
      if (url.endsWith('/models'))
        return Response.json({
          options,
          models: [
            {
              providerId: 'catalog-llm7-provider',
              key: 'codestral-latest',
              name: 'LLM7 Codestral',
              providerName: 'LLM7',
              reasoning: false,
            },
            ...(codexAvailable
              ? [
                  {
                    providerId: 'homecode-codex',
                    key: 'gpt-codex',
                    name: 'Codex',
                    providerName: 'ChatGPT',
                    reasoning: true,
                    reasoningEfforts: ['low', 'high'],
                    defaultReasoningEffort: 'low',
                  },
                ]
              : []),
          ],
        });
      return Response.json({ chats: [] });
    });
    vi.stubGlobal('fetch', fetch);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    let selection: ModelSettingsSelection | undefined;
    let pending: Promise<unknown> | undefined;
    try {
      await act(async () =>
        root.render(
          <HomeChatApp
            baseUrl="http://localhost"
            theme="dark"
            versionLabel="2.0.0"
            onProductChange={() => undefined}
            renderAdministrationPanel={(_panel, _close, value) => {
              selection = value;
              return (
                <div>
                  <button
                    onClick={() => {
                      pending = Promise.resolve(
                        value.onSelectModel('codex:gpt-codex'),
                      );
                    }}
                  >
                    Выбрать Codex
                  </button>
                  <button
                    onClick={() => {
                      pending = Promise.resolve(
                        value.onSelectModel('codestral-latest(openai)'),
                      );
                    }}
                  >
                    Выбрать LLM7
                  </button>
                </div>
              );
            }}
          />,
        ),
      );
      await act(async () =>
        container
          .querySelector<HTMLButtonElement>('button[aria-label="Модели"]')!
          .click(),
      );
      expect(selection?.currentModelId).toBe('codestral-latest');
      codexAvailable = true;
      await act(async () => {
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === 'Выбрать Codex')!
          .click();
        await pending;
      });
      expect(saved[0]).toMatchObject({
        chatModel: { providerId: 'homecode-codex', key: 'gpt-codex' },
        effort: 'low',
      });
      expect(selection?.currentModelId).toBe('codex:gpt-codex');
      await act(async () => {
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === 'Выбрать LLM7')!
          .click();
        await pending;
      });
      expect(saved[1]).toMatchObject({
        chatModel: {
          providerId: 'catalog-llm7-provider',
          key: 'codestral-latest',
        },
      });
      expect(selection?.currentModelId).toBe('codestral-latest');
      expect(
        fetch.mock.calls.every(([url]) => url.includes('/homechat/')),
      ).toBe(true);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  it('opens administration panels from Chat and preserves the draft on return', async () => {
    let catalogLoads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (!url.endsWith('/models'))
          return new Response(JSON.stringify({ chats: [] }));
        catalogLoads += 1;
        return new Response(
          JSON.stringify({
            models: [
              {
                providerId: 'local',
                key: 'model',
                name: `Saved model ${catalogLoads}`,
                providerName: 'Local',
                reasoning: false,
              },
            ],
            options: {
              chatModel: { providerId: 'local', key: 'model' },
              thinking: false,
              effort: 'medium',
              optimizationMode: 'speed',
            },
          }),
        );
      }),
    );
    const scrollTo = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTo',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onProductChange = vi.fn();
    try {
      await act(async () => {
        root.render(
          <HomeChatApp
            baseUrl="http://localhost"
            theme="dark"
            versionLabel="1.3.0"
            onProductChange={onProductChange}
            renderAdministrationPanel={(panel, onClose) => (
              <div role="dialog" aria-label={panel}>
                <button aria-label="Закрыть панель" onClick={onClose}>
                  Закрыть
                </button>
              </div>
            )}
          />,
        );
      });
      expect(container.textContent).not.toContain('Только открытый интернет');
      const draft = 'Неотправленный текст для проверки сохранности';
      const textarea = container.querySelector('textarea')!;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )!.set!;
      await act(async () => {
        setValue.call(textarea, draft);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(textarea.value).toBe(draft);
      for (const [label, panel] of [
        ['Настройки', 'settings'],
        ['Статус демона', 'status'],
        ['Модели', 'models'],
      ]) {
        await act(async () => {
          container
            .querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
            .click();
        });
        expect(
          container
            .querySelector('[role="dialog"]')
            ?.getAttribute('aria-label'),
        ).toBe(panel);
        expect(container.querySelector('textarea')).toBeNull();
        expect(
          container.querySelector('button[aria-label="Режим: Chat"]'),
        ).not.toBeNull();
        await act(async () => {
          container
            .querySelector<HTMLButtonElement>(
              'button[aria-label="Закрыть панель"]',
            )!
            .click();
        });
        expect(container.querySelector('[role="dialog"]')).toBeNull();
        expect(container.querySelector('textarea')?.value).toBe(draft);
        expect(catalogLoads).toBe(
          panel === 'settings' ? 2 : panel === 'status' ? 3 : 4,
        );
        expect(
          container.querySelector('button[aria-label^="Выбрать модель:"]')
            ?.textContent,
        ).toContain(`Saved model ${catalogLoads}`);
      }
      expect(onProductChange).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      if (scrollTo) {
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo);
      } else {
        delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
      }
    }
  });

  it('refreshes a late settings save and ignores an older catalog response', async () => {
    const options = {
      chatModel: { providerId: 'local', key: 'model' },
      thinking: false,
      effort: 'medium' as const,
      optimizationMode: 'speed' as const,
    };
    const catalog = (name: string) =>
      new Response(
        JSON.stringify({
          models: [
            {
              providerId: 'local',
              key: 'model',
              name,
              providerName: 'Local',
              reasoning: false,
            },
          ],
          options,
        }),
      );
    let loads = 0;
    let finishSave!: (response: Response) => void;
    let finishStaleLoad!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'PUT')
          return new Promise<Response>((resolve) => {
            finishSave = resolve;
          });
        if (!url.endsWith('/models'))
          return new Response(JSON.stringify({ chats: [] }));
        loads += 1;
        if (loads === 2)
          return new Promise<Response>((resolve) => {
            finishStaleLoad = resolve;
          });
        return catalog(loads === 1 ? 'Original' : 'Saved');
      }),
    );
    const scrollTo = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTo',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <HomeChatApp
            baseUrl="http://localhost"
            theme="dark"
            versionLabel="1.3.0"
            onProductChange={() => undefined}
            renderAdministrationPanel={(_panel, onClose) => (
              <button onClick={onClose}>Close settings</button>
            )}
          />,
        ),
      );
      await act(async () =>
        container
          .querySelector<HTMLButtonElement>('button[aria-label="Настройки"]')!
          .click(),
      );
      const saving = saveHomeChatOptions(
        'http://localhost',
        undefined,
        options,
      );
      await act(async () =>
        [...container.querySelectorAll('button')]
          .find((button) => button.textContent === 'Close settings')!
          .click(),
      );
      await act(async () => {
        finishSave(new Response('{}'));
        await saving;
      });
      expect(
        container.querySelector('[data-web-shell-model-button]')?.textContent,
      ).toContain('Saved');
      await act(async () => {
        finishStaleLoad(catalog('Stale'));
      });
      expect(
        container.querySelector('[data-web-shell-model-button]')?.textContent,
      ).toContain('Saved');
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      if (scrollTo)
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo);
      else delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });
});

describe('Chat management', () => {
  it('archives selected chats and keeps failed items selected for retry', async () => {
    const chats = ['First', 'Second', 'Third'].map((title, index) => ({
      id: `chat-${index}`,
      title,
      createdAt: '2026-09-06T00:00:00Z',
    }));
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      if (init?.method === 'PATCH')
        return new Response('{}', {
          status: String(url).endsWith('chat-1') ? 502 : 200,
        });
      return new Response(
        JSON.stringify(
          String(url).endsWith('/models') ? { models: [] } : { chats },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const scrollTo = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollTo',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const click = async (selector: string) => {
      await act(async () =>
        container.querySelector<HTMLButtonElement>(selector)!.click(),
      );
    };
    try {
      await act(async () =>
        root.render(
          <HomeChatApp
            baseUrl="http://localhost"
            theme="dark"
            versionLabel="1.3.0"
            onProductChange={vi.fn()}
            renderAdministrationPanel={() => null}
          />,
        ),
      );
      await click('button[aria-label="Менеджер чатов"]');
      await click('button[aria-label="Выбрать чат First"]');
      await click('button[aria-label="Выбрать чат Second"]');
      await act(async () =>
        Array.from(
          container.querySelectorAll<HTMLButtonElement>('section button'),
        )
          .find((button) => button.textContent === 'Архивировать')!
          .click(),
      );
      const writes = fetchMock.mock.calls.filter(
        ([, init]) => init?.method === 'PATCH',
      );
      expect(writes.map(([url]) => String(url))).toEqual([
        'http://localhost/homechat/chats/chat-0',
        'http://localhost/homechat/chats/chat-1',
      ]);
      expect(
        writes.every(([, init]) => init?.body === '{"archived":true}'),
      ).toBe(true);
      expect(container.querySelector('section')?.textContent).toContain(
        'Выбрано: 1',
      );
      expect(
        container.querySelector('section [role="alert"]')?.textContent,
      ).toContain('Не удалось изменить чаты: 1');
      expect(
        container.querySelector(
          'section button[aria-label="Выбрать чат First"]',
        ),
      ).toBeNull();
      expect(
        container
          .querySelector('section button[aria-label="Выбрать чат Second"]')
          ?.getAttribute('aria-checked'),
      ).toBe('true');
      await click('nav button[aria-label="Архивированные"]');
      expect(
        container.querySelector(
          'section button[aria-label="Выбрать чат First"]',
        ),
      ).not.toBeNull();
      expect(
        container.querySelector(
          'section button[aria-label="Выбрать чат Second"]',
        ),
      ).toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      if (scrollTo)
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo);
      else delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
    }
  });
});
