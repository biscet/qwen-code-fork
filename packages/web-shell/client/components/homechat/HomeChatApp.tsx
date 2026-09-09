import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import {
  ArrowUp,
  Activity,
  Bot,
  Archive,
  ListChecks,
  Pin,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  SquarePen,
  Square,
  Settings,
  Trash2,
  Paperclip,
  FileText,
  X,
} from 'lucide-react';
import { ThemeProvider, type WebShellTheme } from '../../themeContext';
import { WebShellPortalRootContext } from '../../portalRoot';
import { I18nProvider } from '../../i18n';
import { Markdown } from '../messages/Markdown';
import { HomeChatWordmark, HomeCodeSpinner } from '../branding/HomeCodeBrand';
import {
  HomeProductSwitcher,
  type HomeProduct,
} from '../branding/HomeProductSwitcher';
import {
  applyHomeChatEvent,
  deleteHomeChat,
  loadHomeChatDetails,
  loadHomeChatList,
  loadHomeChatModels,
  HOMECHAT_OPTIONS_CHANGED,
  HOMECHAT_CODEX_PROVIDER,
  saveHomeChatOptions,
  updateHomeChat,
  type HomeChatModel,
  type HomeChatOptions,
  messageText,
  streamHomeChat,
  stopHomeChat,
  uploadHomeChatAttachment,
  removeHomeChatUpload,
  type HomeChatAttachment,
  type HomeChatBlock,
  type HomeChatChunk,
  type HomeChatMessage,
  type HomeChatSummary,
} from './homechat-api';
import { HomeChatModelPicker } from './HomeChatModelPicker';
import type { ModelSettingsSelection } from '../messages/ModelSettingsPanel';
import { codexModelValue, parseEngineModel } from '../../utils/codexModels';
import { extractBareModelId } from '../../utils/modelEncoding';
import {
  HomeChatManager,
  type HomeChatAction,
  type HomeChatView,
} from './HomeChatManager';
import {
  extractFileTransfer,
  hasFileTransferPayload,
  normalizeImageMediaType,
} from '../../utils/imageIngestion';
import styles from './HomeChatApp.module.css';
import sidebarStyles from '../sidebar/WebShellSidebar.module.css';
import welcomeStyles from '../WelcomeHeader.module.css';
import editorStyles from '../ChatEditor.module.css';
import userStyles from '../messages/UserMessage.module.css';

interface HomeChatAppProps {
  baseUrl: string;
  token?: string;
  theme: WebShellTheme;
  versionLabel: string;
  macOSDesktop?: boolean;
  onProductChange: (product: HomeProduct) => void;
  renderAdministrationPanel: (
    panel: 'settings' | 'status' | 'models',
    onClose: () => void,
    modelSelection: ModelSettingsSelection,
  ) => ReactNode;
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
          <I18nProvider language="ru">
            <Markdown
              content={text}
              source="assistant"
              isStreaming={streaming}
              tableMode="advanced"
            />
          </I18nProvider>
        </div>
      )}
      {!streaming && error?.type === 'error' && (
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
  macOSDesktop = false,
  onProductChange,
  renderAdministrationPanel,
}: HomeChatAppProps) {
  const [administrationPanel, setAdministrationPanel] = useState<
    'settings' | 'status' | 'models' | null
  >(null);
  const [administrationNavigationVersion, setAdministrationNavigationVersion] =
    useState(0);
  const [managerView, setManagerView] = useState<HomeChatView | null>(null);
  const [models, setModels] = useState<HomeChatModel[]>([]);
  const [options, setOptions] = useState<HomeChatOptions>();
  const [savingOptions, setSavingOptions] = useState(false);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [managingChats, setManagingChats] = useState(false);
  const chatRequest = useRef(0);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chats, setChats] = useState<HomeChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>();
  const [messages, setMessages] = useState<HomeChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const submitting = useRef(false);
  const uploadController = useRef<AbortController | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [streamingMessageId, setStreamingMessageId] = useState<string>();
  const [error, setError] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnsRef = useRef<HTMLDivElement>(null);
  const followAnswer = useRef(true);
  const streamController = useRef<AbortController | undefined>(undefined);

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
    const refresh = () => setOptionsRevision((value) => value + 1);
    window.addEventListener(HOMECHAT_OPTIONS_CHANGED, refresh);
    return () => window.removeEventListener(HOMECHAT_OPTIONS_CHANGED, refresh);
  }, []);

  useEffect(() => {
    let active = true;
    if (administrationPanel) return;
    void loadHomeChatModels(baseUrl, token).then(
      (catalog) => {
        if (active) {
          setModels(catalog.models ?? []);
          setOptions((current) => (activeChatId ? current : catalog.options));
        }
      },
      (reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Не удалось загрузить модели.',
          );
      },
    );
    return () => {
      active = false;
    };
  }, [baseUrl, token, administrationPanel, optionsRevision, activeChatId]);

  useEffect(
    () => () => {
      chatRequest.current += 1;
      streamController.current?.abort();
      uploadController.current?.abort();
    },
    [baseUrl, token],
  );

  const changeOptions = async (next: HomeChatOptions) => {
    if (submitting.current) return;
    setSavingOptions(true);
    try {
      await saveHomeChatOptions(baseUrl, token, next);
      if (
        activeChatId &&
        (options?.chatModel.providerId === HOMECHAT_CODEX_PROVIDER) !==
          (next.chatModel.providerId === HOMECHAT_CODEX_PROVIDER)
      ) {
        setActiveChatId(undefined);
        setMessages([]);
      }
      setOptions(next);
      setError(undefined);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось сохранить параметры.',
      );
    } finally {
      setSavingOptions(false);
    }
  };

  const settingsModel = (value: string, catalog = models) => {
    const { engine, modelId } = parseEngineModel(value);
    const matches = catalog.filter(
      (model) =>
        (model.providerId === HOMECHAT_CODEX_PROVIDER) ===
          (engine === 'codex') && model.key === extractBareModelId(modelId),
    );
    return matches.length === 1 ? matches[0] : undefined;
  };
  const settingsCurrentModel =
    options?.chatModel.providerId === HOMECHAT_CODEX_PROVIDER
      ? codexModelValue(options.chatModel.key)
      : options?.chatModel.key;
  const modelSelection: ModelSettingsSelection = {
    currentModelId:
      settingsCurrentModel &&
      settingsModel(settingsCurrentModel)?.providerId ===
        options?.chatModel.providerId
        ? settingsCurrentModel
        : `homechat:${options?.chatModel.providerId ?? ''}/${options?.chatModel.key ?? ''}`,
    selectionBusy: savingOptions || Boolean(streamingMessageId),
    selectionError: error,
    canSelectModel: (value) =>
      parseEngineModel(value).engine === 'codex' ||
      Boolean(settingsModel(value)),
    onSelectModel: async (value) => {
      if (savingOptions || streamingMessageId) return;
      setSavingOptions(true);
      try {
        const catalog = await loadHomeChatModels(baseUrl, token);
        setModels(catalog.models);
        const model = settingsModel(value, catalog.models);
        if (!model) throw new Error('Эта модель недоступна в HomeChat.');
        const efforts = model.reasoningEfforts ?? ['low', 'medium', 'high'];
        const effort = options?.effort ?? 'medium';
        await changeOptions({
          chatModel: { providerId: model.providerId, key: model.key },
          thinking: model.reasoning && (options?.thinking ?? false),
          effort: efforts.includes(effort)
            ? effort
            : (model.defaultReasoningEffort ?? efforts[0] ?? 'medium'),
          optimizationMode: options?.optimizationMode ?? 'speed',
        });
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось выбрать модель.',
        );
      } finally {
        setSavingOptions(false);
      }
    },
  };

  const openManager = (view: HomeChatView) => {
    setManagerView(view);
    setAdministrationPanel(null);
    setSidebarOpen(false);
    setError(undefined);
  };

  useLayoutEffect(() => {
    const transcript = scrollRef.current;
    const turns = turnsRef.current;
    if (!transcript || !turns) return;
    const scrollToAnswer = () => {
      if (followAnswer.current) {
        transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'auto' });
      }
    };
    scrollToAnswer();
    const observer = new ResizeObserver(scrollToAnswer);
    observer.observe(turns);
    observer.observe(transcript);
    return () => observer.disconnect();
  }, [activeChatId, messages.length, administrationPanel, managerView]);

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
    if (submitting.current || streamingMessageId || managingChats) return;
    followAnswer.current = true;
    setAdministrationPanel(null);
    setManagerView(null);
    const requestId = ++chatRequest.current;
    setActiveChatId(chatId);
    setDraft('');
    setFiles([]);
    setMessages([]);
    setError(undefined);
    setLoading(true);
    setSidebarOpen(false);
    try {
      const loaded = await loadHomeChatDetails(baseUrl, token, chatId);
      if (requestId === chatRequest.current) {
        setMessages(loaded.messages);
        if (loaded.engine === 'codex') {
          setOptions(loaded.options);
          const pending = loaded.messages.at(-1);
          if (pending?.status === 'answering' && loaded.options)
            void followStream(
              chatId,
              pending.messageId,
              pending.query,
              loaded.options,
              [],
              pending.attachments,
            );
        } else if (options?.chatModel.providerId === HOMECHAT_CODEX_PROVIDER) {
          const model = models.find(
            (entry) => entry.providerId !== HOMECHAT_CODEX_PROVIDER,
          );
          setOptions(
            model
              ? {
                  chatModel: { providerId: model.providerId, key: model.key },
                  thinking: false,
                  effort: 'medium',
                  optimizationMode: 'speed',
                }
              : undefined,
          );
        }
      }
    } catch (reason) {
      if (requestId !== chatRequest.current) return;
      setError(
        reason instanceof Error ? reason.message : 'Не удалось загрузить чат.',
      );
    } finally {
      if (requestId === chatRequest.current) setLoading(false);
    }
  };

  const startNewChat = () => {
    if (submitting.current || streamingMessageId || managingChats) return;
    followAnswer.current = true;
    setAdministrationPanel(null);
    setManagerView(null);
    chatRequest.current += 1;
    setLoading(false);
    setActiveChatId(undefined);
    setMessages([]);
    setDraft('');
    setFiles([]);
    setError(undefined);
    setSidebarOpen(false);
  };

  const manageChats = async (
    ids: string[],
    action: HomeChatAction,
  ): Promise<string[]> => {
    if (submitting.current || streamingMessageId || managingChats) return ids;
    setManagingChats(true);
    setError(undefined);
    const flags =
      action === 'archive'
        ? { archived: true }
        : action === 'restore'
          ? { archived: false }
          : { pinned: action === 'pin' };
    const failed: string[] = [];
    try {
      for (const id of ids) {
        try {
          if (action === 'delete') await deleteHomeChat(baseUrl, token, id);
          else await updateHomeChat(baseUrl, token, id, flags);
          setChats((current) =>
            action === 'delete'
              ? current.filter((chat) => chat.id !== id)
              : current.map((chat) =>
                  chat.id === id ? { ...chat, ...flags } : chat,
                ),
          );
          if (
            activeChatId === id &&
            (action === 'delete' || action === 'archive')
          ) {
            chatRequest.current += 1;
            setActiveChatId(undefined);
            setMessages([]);
            setDraft('');
            setFiles([]);
            setLoading(false);
          }
        } catch {
          failed.push(id);
        }
      }
      if (failed.length)
        setError(
          `Не удалось изменить чаты: ${failed.length}. Попробуйте ещё раз.`,
        );
      return failed;
    } finally {
      setManagingChats(false);
    }
  };

  const removeChat = async (chat: HomeChatSummary) => {
    if (submitting.current || streamingMessageId || managingChats) return;
    if (window.confirm(`Удалить чат «${chat.title}»?`))
      await manageChats([chat.id], 'delete');
  };

  const addFiles = (incoming: File[]) => {
    if (submitting.current || streamingMessageId) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of incoming) {
      if (!file.size || file.size > 8 * 1024 * 1024)
        rejected.push(`${file.name}: размер должен быть от 1 байта до 8 МБ.`);
      else if (
        normalizeImageMediaType(file.type, file.name) &&
        options?.chatModel.providerId !== HOMECHAT_CODEX_PROVIDER
      )
        rejected.push(`${file.name}: для изображений выберите Codex.`);
      else accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted].slice(0, 8));
    if (files.length + accepted.length > 8)
      rejected.push('Можно прикрепить до 8 файлов.');
    setError(rejected.length ? rejected.join(' ') : undefined);
  };

  const receiveFiles = (transfer: DataTransfer, source: 'paste' | 'drop') => {
    const result = extractFileTransfer(transfer, source);
    if (result.claimed) {
      addFiles(
        [...result.imageCandidates, ...result.fileCandidates].map(
          (entry) => entry.file,
        ),
      );
      if (result.rejected.length)
        setError('Не удалось получить файл. Используйте кнопку прикрепления.');
    }
    return result.claimed;
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content =
      draft.trim() || (files.length ? 'Изучи прикреплённые файлы.' : '');
    if (
      !content ||
      submitting.current ||
      streamingMessageId ||
      loading ||
      savingOptions ||
      managingChats ||
      !options
    )
      return;
    if (
      options.chatModel.providerId !== HOMECHAT_CODEX_PROVIDER &&
      files.some((file) => normalizeImageMediaType(file.type, file.name))
    ) {
      setError(
        'Для прикреплённых изображений выберите Codex или уберите изображения.',
      );
      return;
    }
    const chatId = activeChatId ?? `homechat-${crypto.randomUUID()}`;
    submitting.current = true;
    setUploading(true);
    const requestId = chatRequest.current;
    const controller = new AbortController();
    uploadController.current = controller;
    const attachments: HomeChatAttachment[] = [];
    let uploaded = false;
    try {
      for (const file of files)
        attachments.push(
          await uploadHomeChatAttachment(
            baseUrl,
            token,
            chatId,
            file,
            controller.signal,
          ),
        );
      if (requestId !== chatRequest.current) return;
      uploaded = true;
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Не удалось прикрепить файлы.',
        );
      return;
    } finally {
      if (!uploaded)
        await Promise.allSettled(
          attachments.map((file) =>
            removeHomeChatUpload(baseUrl, token, chatId, file.id),
          ),
        );
      setUploading(false);
      submitting.current = false;
      uploadController.current = undefined;
    }
    submitting.current = true;
    followAnswer.current = true;
    const messageId = crypto.randomUUID();
    const nextMessage: HomeChatMessage = {
      messageId,
      chatId,
      query: content,
      attachments,
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
    setFiles([]);
    setError(undefined);
    await followStream(
      chatId,
      messageId,
      content,
      options,
      history,
      attachments,
    );
  };

  const followStream = async (
    chatId: string,
    messageId: string,
    content: string,
    requestOptions: HomeChatOptions,
    requestHistory: Array<['human' | 'assistant', string]>,
    attachments: HomeChatAttachment[] = [],
  ) => {
    setStreamingMessageId(messageId);
    const controller = new AbortController();
    streamController.current = controller;
    try {
      let completed = false;
      let hasAnswer = false;
      let stopped = false;
      for await (const streamEvent of streamHomeChat(
        baseUrl,
        token,
        {
          messageId,
          chatId,
          content,
          history:
            requestOptions.chatModel.providerId === HOMECHAT_CODEX_PROVIDER
              ? []
              : requestHistory,
          options: requestOptions,
          ...(attachments.length
            ? { attachments: attachments.map((file) => file.id) }
            : {}),
        },
        controller.signal,
      )) {
        if (streamEvent.type === 'error') {
          throw new Error(
            typeof streamEvent.data === 'string'
              ? streamEvent.data
              : 'Не удалось завершить интернет-исследование.',
          );
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
        if (streamEvent.type === 'messageEnd') {
          completed = true;
          stopped = streamEvent.stopped === true;
        }
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
                      ? streamEvent.stopped
                        ? 'stopped'
                        : 'completed'
                      : message.status,
                }
              : message,
          ),
        );
      }
      if (!stopped && (!completed || !hasAnswer)) {
        throw new Error('HomeChat не вернул завершённый ответ.');
      }
      setChats(await loadHomeChatList(baseUrl, token));
    } catch (reason) {
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.map((item) =>
            item.messageId === messageId
              ? { ...item, status: 'stopped' }
              : item,
          ),
        );
        return;
      }
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
      submitting.current = false;
      streamController.current = undefined;
      setStreamingMessageId(undefined);
    }
  };

  const stop = async () => {
    try {
      if (
        activeChatId &&
        options?.chatModel.providerId === HOMECHAT_CODEX_PROVIDER
      )
        await stopHomeChat(baseUrl, token, activeChatId);
      else streamController.current?.abort();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Не удалось остановить ответ.',
      );
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
          className={`${styles.root} ${theme === 'dark' ? `${styles.dark} dark` : styles.light}`}
          data-web-shell-root
          data-web-shell-shadcn
          data-homechat-root
        >
          {macOSDesktop && (
            <div className={styles.dragRegion} data-tauri-drag-region />
          )}
          {sidebarOpen && (
            <button
              className={styles.scrim}
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {macOSDesktop && (
            <button
              className={`${sidebarStyles.collapseButton} ${styles.sidebarToggle}`}
              type="button"
              title={
                sidebarCollapsed
                  ? 'Развернуть боковую панель'
                  : 'Свернуть боковую панель'
              }
              aria-label={
                sidebarCollapsed
                  ? 'Развернуть боковую панель'
                  : 'Свернуть боковую панель'
              }
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>
          )}
          <aside
            className={`${styles.sidebar} ${macOSDesktop ? sidebarStyles.macOSDesktop : ''} ${sidebarCollapsed && !sidebarOpen ? `${sidebarStyles.collapsed} ${styles.sidebarCollapsed}` : ''} ${sidebarOpen ? `${sidebarStyles.mobileOpen} ${styles.sidebarOpen}` : ''}`}
          >
            {macOSDesktop && (
              <div className={sidebarStyles.topRow} data-tauri-drag-region />
            )}
            <div className={sidebarStyles.brandingRow}>
              <HomeProductSwitcher
                product="homechat"
                onProductChange={onProductChange}
              />
            </div>
            <div className={sidebarStyles.newTaskNav}>
              <button
                className={sidebarStyles.newChatButton}
                type="button"
                aria-label="Новый чат"
                title="Новый чат"
                onClick={startNewChat}
                disabled={uploading || Boolean(streamingMessageId)}
              >
                <span className={sidebarStyles.navIcon}>
                  <SquarePen size={16} aria-hidden="true" />
                </span>
                {(!sidebarCollapsed || sidebarOpen) && <span>Новый чат</span>}
              </button>
            </div>
            <nav className={styles.managerNav} aria-label="Управление чатами">
              {(
                [
                  { view: 'active', label: 'Менеджер чатов', icon: ListChecks },
                  { view: 'archived', label: 'Архивированные', icon: Archive },
                  { view: 'pinned', label: 'Закреплённые', icon: Pin },
                ] as const
              ).map(({ view, label, icon: Icon }) => (
                <button
                  key={view}
                  type="button"
                  className={`${sidebarStyles.newChatButton} ${managerView === view && !administrationPanel ? styles.navActive : ''}`}
                  aria-label={label}
                  title={label}
                  onClick={() => openManager(view)}
                >
                  <span className={sidebarStyles.navIcon}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  {(!sidebarCollapsed || sidebarOpen) && <span>{label}</span>}
                </button>
              ))}
            </nav>
            <div className={styles.chatSection}>
              <div className={styles.chatList}>
                {[
                  {
                    label: 'Закреплённые',
                    items: chats.filter(
                      (chat) => chat.pinned && !chat.archived,
                    ),
                  },
                  {
                    label: 'Чаты',
                    items: chats.filter(
                      (chat) => !chat.pinned && !chat.archived,
                    ),
                  },
                ].map(
                  ({ label, items }) =>
                    (items.length > 0 || label === 'Чаты') && (
                      <div key={label}>
                        <div className={styles.sectionLabel}>{label}</div>
                        {items.map((chat) => (
                          <div
                            key={chat.id}
                            className={`${styles.chatRow} ${activeChatId === chat.id && !managerView ? styles.chatRowActive : ''}`}
                          >
                            <button
                              type="button"
                              disabled={
                                Boolean(streamingMessageId) || managingChats
                              }
                              onClick={() => void selectChat(chat.id)}
                              title={
                                chat.engine === 'codex'
                                  ? `${chat.title} · OpenAI · вход ChatGPT`
                                  : chat.title
                              }
                            >
                              {chat.title}
                            </button>
                            <button
                              className={styles.pinChat}
                              type="button"
                              disabled={
                                Boolean(streamingMessageId) || managingChats
                              }
                              aria-label={`${chat.pinned ? 'Открепить' : 'Закрепить'} чат ${chat.title}`}
                              onClick={() =>
                                void manageChats(
                                  [chat.id],
                                  chat.pinned ? 'unpin' : 'pin',
                                )
                              }
                            >
                              <Pin aria-hidden="true" />
                            </button>
                            <button
                              className={styles.deleteChat}
                              type="button"
                              disabled={
                                Boolean(streamingMessageId) || managingChats
                              }
                              aria-label={`Удалить чат ${chat.title}`}
                              onClick={() => void removeChat(chat)}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ),
                )}
                {!loading && !chats.some((chat) => !chat.archived) && (
                  <p className={styles.emptyHistory}>
                    Здесь появятся исследования
                  </p>
                )}
              </div>
            </div>
            <div
              className={`${sidebarStyles.footer} ${sidebarStyles.stackedFooter}`}
            >
              <button
                className={sidebarStyles.footerButton}
                type="button"
                title="Настройки"
                aria-label="Настройки"
                onClick={() => {
                  setAdministrationPanel('settings');
                  setSidebarOpen(false);
                }}
              >
                <span className={sidebarStyles.navIcon}>
                  <Settings size={16} strokeWidth={1.2} aria-hidden="true" />
                </span>
                {(!sidebarCollapsed || sidebarOpen) && <span>Настройки</span>}
              </button>
              <button
                className={`${sidebarStyles.collapseButton} ${sidebarStyles.footerButton}`}
                type="button"
                title="Статус демона"
                aria-label="Статус демона"
                onClick={() => {
                  setAdministrationPanel('status');
                  setSidebarOpen(false);
                }}
              >
                <span className={sidebarStyles.navIcon}>
                  <Activity size={16} strokeWidth={1.2} aria-hidden="true" />
                </span>
                {(!sidebarCollapsed || sidebarOpen) && (
                  <span>Статус демона</span>
                )}
              </button>
              <button
                className={`${sidebarStyles.collapseButton} ${sidebarStyles.footerButton}`}
                type="button"
                title="Модели"
                aria-label="Модели"
                onClick={() => {
                  setAdministrationPanel('models');
                  setAdministrationNavigationVersion((version) => version + 1);
                  setSidebarOpen(false);
                }}
              >
                <span className={sidebarStyles.navIcon}>
                  <Bot size={16} strokeWidth={1.2} aria-hidden="true" />
                </span>
                {(!sidebarCollapsed || sidebarOpen) && <span>Модели</span>}
              </button>
              <small className={sidebarStyles.version}>{versionLabel}</small>
            </div>
          </aside>
          <main
            className={`${styles.main} ${!administrationPanel && !managerView && messages.length === 0 ? styles.mainEmpty : ''}`}
          >
            <button
              className={styles.mobileMenu}
              type="button"
              aria-label="Открыть меню"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft aria-hidden="true" />
            </button>
            {administrationPanel ? (
              <Fragment key={administrationNavigationVersion}>
                {renderAdministrationPanel(
                  administrationPanel,
                  () => setAdministrationPanel(null),
                  modelSelection,
                )}
              </Fragment>
            ) : managerView ? (
              <HomeChatManager
                key={managerView}
                chats={chats}
                view={managerView}
                disabled={Boolean(streamingMessageId) || managingChats}
                error={error}
                onViewChange={setManagerView}
                onSelect={(id) => void selectChat(id)}
                onAction={manageChats}
                onClose={() => setManagerView(null)}
              />
            ) : (
              <>
                <div
                  className={styles.transcript}
                  ref={scrollRef}
                  onScroll={(event) => {
                    const { scrollHeight, scrollTop, clientHeight } =
                      event.currentTarget;
                    followAnswer.current =
                      scrollHeight - scrollTop - clientHeight <= 8;
                  }}
                >
                  {loading && messages.length === 0 ? (
                    <div className={styles.centerStatus} role="status">
                      <HomeCodeSpinner aria-hidden="true" />
                      Загружает чаты
                    </div>
                  ) : messages.length === 0 ? (
                    <div className={welcomeStyles.header}>
                      <h1 className={welcomeStyles.title} aria-label="HomeChat">
                        <HomeChatWordmark
                          className={`${welcomeStyles.wordmark} ${styles.wordmark}`}
                          aria-hidden="true"
                        />
                      </h1>
                    </div>
                  ) : (
                    <div className={styles.turns} ref={turnsRef}>
                      {messages.map((message) => (
                        <article
                          key={message.messageId}
                          className={styles.turn}
                        >
                          <div className={userStyles.chatMessageRow}>
                            <div className={userStyles.chatMessageColumn}>
                              <div
                                className={`${userStyles.chatBubble} ${userStyles.chatContent}`}
                                data-user-selectable
                              >
                                {message.query}
                                {!!message.attachments?.length && (
                                  <div
                                    className={styles.attachments}
                                    aria-label="Вложения сообщения"
                                  >
                                    {message.attachments.map((file) => (
                                      <span
                                        className={styles.attachment}
                                        key={file.id}
                                        title={file.name}
                                      >
                                        <FileText
                                          size={14}
                                          aria-hidden="true"
                                        />
                                        <span>{file.name}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
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
                  <form
                    className={`${editorStyles.container} ${styles.composer} ${dragging ? styles.dragging : ''}`}
                    onSubmit={submit}
                    onDragOver={(event) => {
                      if (hasFileTransferPayload(event.dataTransfer)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect =
                          uploading || streamingMessageId ? 'none' : 'copy';
                        setDragging(!uploading && !streamingMessageId);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      )
                        setDragging(false);
                    }}
                    onDrop={(event) => {
                      setDragging(false);
                      if (receiveFiles(event.dataTransfer, 'drop'))
                        event.preventDefault();
                    }}
                    onPaste={(event) => {
                      if (receiveFiles(event.clipboardData, 'paste'))
                        event.preventDefault();
                    }}
                  >
                    <div className={editorStyles.content}>
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        hidden
                        aria-label="Выбрать файлы для Chat"
                        onChange={(event) => {
                          addFiles(Array.from(event.target.files ?? []));
                          event.target.value = '';
                        }}
                      />
                      {!!files.length && (
                        <div
                          className={styles.attachments}
                          aria-label="Прикреплённые файлы"
                        >
                          {files.map((file, index) => (
                            <span
                              className={styles.attachment}
                              key={`${file.name}-${index}`}
                              title={file.name}
                            >
                              <FileText size={14} aria-hidden="true" />
                              <span>{file.name}</span>
                              <button
                                type="button"
                                aria-label={`Убрать ${file.name}`}
                                disabled={uploading}
                                onClick={() =>
                                  setFiles((current) =>
                                    current.filter(
                                      (_, position) => position !== index,
                                    ),
                                  )
                                }
                              >
                                <X size={14} aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {uploading && (
                        <span className={styles.uploadStatus} role="status">
                          Читает файлы…
                        </span>
                      )}
                      <textarea
                        value={draft}
                        rows={2}
                        maxLength={32_000}
                        placeholder="Что исследовать в интернете?"
                        aria-label="Сообщение HomeChat"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={onComposerKeyDown}
                        disabled={uploading || Boolean(streamingMessageId)}
                      />
                      <div className={styles.composerFooter}>
                        <button
                          type="button"
                          className={styles.attachButton}
                          aria-label="Прикрепить файлы"
                          title="Текст, код, PDF и офисные документы · до 8 МБ; изображения с Codex"
                          disabled={uploading || Boolean(streamingMessageId)}
                          onClick={() => fileInput.current?.click()}
                        >
                          <Paperclip size={18} aria-hidden="true" />
                        </button>
                        <HomeChatModelPicker
                          models={models}
                          options={options}
                          disabled={
                            uploading ||
                            Boolean(streamingMessageId) ||
                            savingOptions
                          }
                          onChange={changeOptions}
                        />
                        <button
                          className={editorStyles.sendBtn}
                          type={streamingMessageId ? 'button' : 'submit'}
                          aria-label={
                            streamingMessageId ? 'Остановить' : 'Отправить'
                          }
                          onClick={
                            streamingMessageId ? () => void stop() : undefined
                          }
                          disabled={
                            !streamingMessageId &&
                            ((!draft.trim() && !files.length) ||
                              uploading ||
                              loading ||
                              savingOptions ||
                              managingChats ||
                              !options)
                          }
                        >
                          {streamingMessageId ? (
                            <Square aria-hidden="true" />
                          ) : (
                            <ArrowUp aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </>
            )}
          </main>
        </div>
      </WebShellPortalRootContext.Provider>
    </ThemeProvider>
  );
}
