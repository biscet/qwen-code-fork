import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { ArrowUp, Globe2, PanelLeft, Plus, Search, Trash2 } from 'lucide-react';
import { ThemeProvider, type WebShellTheme } from '../../themeContext';
import { WebShellPortalRootContext } from '../../portalRoot';
import { Markdown } from '../messages/Markdown';
import { HomeChatWordmark, HomeCodeSpinner } from '../branding/HomeCodeBrand';
import {
  HomeProductSwitcher,
  type HomeProduct,
} from '../branding/HomeProductSwitcher';
import {
  applyHomeChatEvent,
  deleteHomeChat,
  loadHomeChat,
  loadHomeChatList,
  messageText,
  streamHomeChat,
  type HomeChatBlock,
  type HomeChatChunk,
  type HomeChatMessage,
  type HomeChatSummary,
} from './homechat-api';
import styles from './HomeChatApp.module.css';

interface HomeChatAppProps {
  baseUrl: string;
  token?: string;
  theme: WebShellTheme;
  versionLabel: string;
  onProductChange: (product: HomeProduct) => void;
}

function safeSource(
  chunk: HomeChatChunk,
): { title: string; url: string } | null {
  const url = chunk.metadata?.url;
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return {
      title: chunk.metadata?.title?.trim() || parsed.hostname,
      url: parsed.toString(),
    };
  } catch {
    return null;
  }
}

function messageSources(
  blocks: HomeChatBlock[],
): Array<{ title: string; url: string }> {
  const chunks: HomeChatChunk[] = [];
  for (const block of blocks) {
    if (block.type === 'source' && Array.isArray(block.data)) {
      chunks.push(...block.data);
    }
    if (block.type === 'research') {
      for (const step of block.data.subSteps) {
        if (Array.isArray(step.reading)) chunks.push(...step.reading);
      }
    }
  }
  const sources = new Map<string, { title: string; url: string }>();
  for (const chunk of chunks) {
    const source = safeSource(chunk);
    if (source && !sources.has(source.url)) sources.set(source.url, source);
  }
  return [...sources.values()].slice(0, 8);
}

function researchLabel(blocks: HomeChatBlock[], hasText: boolean): string {
  if (hasText) return 'Формирует ответ';
  const research = [...blocks]
    .reverse()
    .find(
      (block): block is Extract<HomeChatBlock, { type: 'research' }> =>
        block.type === 'research',
    );
  const step = research?.data.subSteps.at(-1);
  if (step?.type === 'searching') {
    const query = step.searching?.at(-1);
    return query ? `Ищет: ${query}` : 'Ищет источники';
  }
  if (step?.type === 'reading' || step?.type === 'search_results') {
    return 'Читает источники';
  }
  if (step?.type === 'reasoning') return 'Планирует исследование';
  return 'Исследует интернет';
}

function AssistantMessage({
  message,
  streaming,
}: {
  message: HomeChatMessage;
  streaming: boolean;
}) {
  const text = messageText(message);
  const sources = messageSources(message.responseBlocks);
  const error = message.responseBlocks.find((block) => block.type === 'error');
  return (
    <div className={styles.assistantTurn}>
      {streaming && (
        <div className={styles.researchStatus} role="status">
          <HomeCodeSpinner aria-hidden="true" />
          <span>{researchLabel(message.responseBlocks, Boolean(text))}</span>
        </div>
      )}
      {text && (
        <div className={styles.answer} data-user-selectable>
          <Markdown
            content={text}
            source="assistant"
            isStreaming={streaming}
            tableMode="advanced"
          />
        </div>
      )}
      {!streaming && !text && error?.type === 'error' && (
        <p className={styles.messageError} role="alert">
          {error.data.message || 'Исследование завершилось с ошибкой.'}
        </p>
      )}
      {sources.length > 0 && (
        <div className={styles.sources} aria-label="Источники">
          <span className={styles.sourcesLabel}>Источники</span>
          <div className={styles.sourceList}>
            {sources.map((source, index) => (
              <a
                key={source.url}
                className={styles.source}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>{index + 1}</span>
                <span>{source.title}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HomeChatApp({
  baseUrl,
  token,
  theme,
  versionLabel,
  onProductChange,
}: HomeChatAppProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<HomeChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>();
  const [messages, setMessages] = useState<HomeChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [streamingMessageId, setStreamingMessageId] = useState<string>();
  const [error, setError] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = document.createElement('div');
    root.dataset.webShellPortalRoot = '';
    root.dataset.webShellShadcn = '';
    document.body.appendChild(root);
    setPortalRoot(root);
    return () => {
      root.remove();
      setPortalRoot(null);
    };
  }, []);

  useEffect(() => {
    portalRoot?.classList.toggle('dark', theme === 'dark');
  }, [portalRoot, theme]);

  useEffect(() => {
    let active = true;
    void loadHomeChatList(baseUrl, token)
      .then(
        (nextChats) => {
          if (active) setChats(nextChats);
        },
        (reason: unknown) => {
          if (active) {
            setError(
              reason instanceof Error ? reason.message : 'HomeChat недоступен.',
            );
          }
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [baseUrl, token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: streamingMessageId ? 'auto' : 'smooth',
    });
  }, [messages, streamingMessageId]);

  const history = useMemo(() => {
    const entries: Array<['human' | 'assistant', string]> = [];
    for (const message of messages) {
      const answer = messageText(message);
      entries.push(['human', message.query]);
      if (answer) entries.push(['assistant', answer]);
    }
    return entries;
  }, [messages]);

  const selectChat = async (chatId: string) => {
    if (streamingMessageId) return;
    setActiveChatId(chatId);
    setMessages([]);
    setError(undefined);
    setLoading(true);
    setSidebarOpen(false);
    try {
      setMessages(await loadHomeChat(baseUrl, token, chatId));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Не удалось загрузить чат.',
      );
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    if (streamingMessageId) return;
    setActiveChatId(undefined);
    setMessages([]);
    setDraft('');
    setError(undefined);
    setSidebarOpen(false);
  };

  const removeChat = async (chat: HomeChatSummary) => {
    if (streamingMessageId) return;
    if (!window.confirm(`Удалить чат «${chat.title}»?`)) return;
    try {
      await deleteHomeChat(baseUrl, token, chat.id);
      setChats((current) => current.filter((item) => item.id !== chat.id));
      if (activeChatId === chat.id) startNewChat();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Не удалось удалить чат.',
      );
    }
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || streamingMessageId) return;
    const chatId = activeChatId ?? `homechat-${crypto.randomUUID()}`;
    const messageId = crypto.randomUUID();
    const nextMessage: HomeChatMessage = {
      messageId,
      chatId,
      query: content,
      createdAt: new Date().toISOString(),
      responseBlocks: [],
      status: 'answering',
    };
    setActiveChatId(chatId);
    setMessages((current) => [...current, nextMessage]);
    if (!activeChatId) {
      setChats((current) => [
        {
          id: chatId,
          title: content,
          createdAt: nextMessage.createdAt,
        },
        ...current,
      ]);
    }
    setDraft('');
    setError(undefined);
    setStreamingMessageId(messageId);
    try {
      let completed = false;
      let hasAnswer = false;
      for await (const streamEvent of streamHomeChat(baseUrl, token, {
        messageId,
        chatId,
        content,
        history,
      })) {
        if (streamEvent.type === 'error') {
          throw new Error('Не удалось завершить интернет-исследование.');
        }
        if (
          streamEvent.type === 'block' &&
          streamEvent.block.type === 'text' &&
          streamEvent.block.data.trim()
        ) {
          hasAnswer = true;
        }
        if (
          streamEvent.type === 'updateBlock' &&
          streamEvent.patch.some(
            (patch) =>
              patch.path === '/data' &&
              typeof patch.value === 'string' &&
              patch.value.trim().length > 0,
          )
        ) {
          hasAnswer = true;
        }
        if (streamEvent.type === 'messageEnd') completed = true;
        setMessages((current) =>
          current.map((message) =>
            message.messageId === messageId
              ? {
                  ...message,
                  responseBlocks: applyHomeChatEvent(
                    message.responseBlocks,
                    streamEvent,
                  ),
                  status:
                    streamEvent.type === 'messageEnd'
                      ? 'completed'
                      : message.status,
                }
              : message,
          ),
        );
      }
      if (!completed || !hasAnswer) {
        throw new Error('HomeChat не вернул завершённый ответ.');
      }
      setChats(await loadHomeChatList(baseUrl, token));
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : 'HomeChat сейчас недоступен.';
      setMessages((current) =>
        current.map((item) =>
          item.messageId === messageId
            ? {
                ...item,
                status: 'error',
                responseBlocks: [
                  ...item.responseBlocks,
                  {
                    id: `error-${messageId}`,
                    type: 'error',
                    data: { message },
                  },
                ],
              }
            : item,
        ),
      );
    } finally {
      setStreamingMessageId(undefined);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <ThemeProvider value={theme}>
      <WebShellPortalRootContext.Provider value={portalRoot}>
        <div
          className={`${styles.root} ${theme === 'dark' ? 'dark' : ''}`}
          data-web-shell-root
          data-web-shell-shadcn
          data-homechat-root
        >
          <div className={styles.dragRegion} data-tauri-drag-region />
          {sidebarOpen && (
            <button
              className={styles.scrim}
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside
            className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
          >
            <div className={styles.productRow} data-tauri-drag-region>
              <HomeProductSwitcher
                product="homechat"
                onProductChange={onProductChange}
              />
            </div>
            <button
              className={styles.newChat}
              type="button"
              onClick={startNewChat}
              disabled={Boolean(streamingMessageId)}
            >
              <Plus aria-hidden="true" />
              Новый чат
            </button>
            <div className={styles.chatSection}>
              <div className={styles.sectionLabel}>Чаты</div>
              <div className={styles.chatList}>
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`${styles.chatRow} ${activeChatId === chat.id ? styles.chatRowActive : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => void selectChat(chat.id)}
                    >
                      {chat.title}
                    </button>
                    <button
                      className={styles.deleteChat}
                      type="button"
                      aria-label={`Удалить чат ${chat.title}`}
                      onClick={() => void removeChat(chat)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {!loading && chats.length === 0 && (
                  <p className={styles.emptyHistory}>
                    Здесь появятся исследования
                  </p>
                )}
              </div>
            </div>
            <div className={styles.sidebarFooter}>
              <div>
                <Globe2 aria-hidden="true" />
                <span>Только открытый интернет</span>
              </div>
              <small>{versionLabel}</small>
            </div>
          </aside>
          <main className={styles.main}>
            <button
              className={styles.mobileMenu}
              type="button"
              aria-label="Открыть меню"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft aria-hidden="true" />
            </button>
            <div className={styles.transcript} ref={scrollRef}>
              {loading && messages.length === 0 ? (
                <div className={styles.centerStatus} role="status">
                  <HomeCodeSpinner aria-hidden="true" />
                  Загружает чаты
                </div>
              ) : messages.length === 0 ? (
                <div className={styles.welcome}>
                  <HomeChatWordmark role="img" aria-label="HomeChat" />
                  <div className={styles.boundaryLine}>
                    <Search aria-hidden="true" />
                    <span>Исследует интернет. Не видит файлы и компьютер.</span>
                  </div>
                </div>
              ) : (
                <div className={styles.turns}>
                  {messages.map((message) => (
                    <article key={message.messageId} className={styles.turn}>
                      <div className={styles.userMessage} data-user-selectable>
                        {message.query}
                      </div>
                      <AssistantMessage
                        message={message}
                        streaming={streamingMessageId === message.messageId}
                      />
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.composerDock}>
              {error && (
                <p className={styles.globalError} role="alert">
                  {error}
                </p>
              )}
              <form className={styles.composer} onSubmit={submit}>
                <textarea
                  value={draft}
                  rows={2}
                  maxLength={32_000}
                  placeholder="Что исследовать в интернете?"
                  aria-label="Сообщение HomeChat"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onComposerKeyDown}
                  disabled={Boolean(streamingMessageId)}
                />
                <div className={styles.composerFooter}>
                  <span>
                    <Globe2 aria-hidden="true" />
                    Интернет
                  </span>
                  <button
                    type="submit"
                    aria-label="Отправить"
                    disabled={!draft.trim() || Boolean(streamingMessageId)}
                  >
                    {streamingMessageId ? (
                      <HomeCodeSpinner aria-hidden="true" />
                    ) : (
                      <ArrowUp aria-hidden="true" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </WebShellPortalRootContext.Provider>
    </ThemeProvider>
  );
}
