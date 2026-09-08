import { Fragment, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { filterToolbarDropdownItems } from '../toolbarDropdown';
import type { HomeChatModel, HomeChatOptions } from './homechat-api';
import { HOMECHAT_CODEX_PROVIDER } from './homechat-api';
import editorStyles from '../ChatEditor.module.css';
import styles from './HomeChatApp.module.css';

const efforts: Record<string, string> = {
  none: 'Без размышлений',
  minimal: 'Минимальный',
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  xhigh: 'Очень высокий',
  max: 'Максимальный',
  ultra: 'Ultra',
};
const depths = {
  speed: 'Быстро',
  balanced: 'Сбалансированно',
  quality: 'Глубоко',
};

export function HomeChatModelPicker({
  models,
  options: savedOptions,
  disabled,
  onChange,
}: {
  models: HomeChatModel[];
  options?: HomeChatOptions;
  disabled: boolean;
  onChange: (options: HomeChatOptions) => Promise<void>;
}) {
  const options: HomeChatOptions = savedOptions ?? {
    chatModel: { providerId: '', key: '' },
    thinking: false,
    effort: 'medium',
    optimizationMode: 'speed',
  };
  const [open, setOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
  const [collisionBoundary, setCollisionBoundary] =
    useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modelsTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) {
      setModelsOpen(false);
      setQuery('');
    }
  }, [open]);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 760px)');
    if (!media) return;
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const selected = models.find(
    (model) =>
      model.providerId === options?.chatModel.providerId &&
      model.key === options.chatModel.key,
  );
  const visibleModels = filterToolbarDropdownItems(
    [
      ...models.filter((model) => model.providerId !== HOMECHAT_CODEX_PROVIDER),
      ...models.filter((model) => model.providerId === HOMECHAT_CODEX_PROVIDER),
    ].map((model) => ({
      ...model,
      id: `${model.providerId}/${model.key}`,
      label: model.name,
      searchText: `${model.key} ${model.providerName}`,
      group: model.providerId === HOMECHAT_CODEX_PROVIDER ? 'Codex' : 'Qwen',
    })),
    query,
  );
  const isCodex = options?.chatModel.providerId === HOMECHAT_CODEX_PROVIDER;
  const availableEfforts = selected?.reasoningEfforts ?? [
    'low',
    'medium',
    'high',
  ];
  const change = async (next: HomeChatOptions) => {
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  };
  const label = selected
    ? `${selected.name}${selected.reasoning && options ? ` · ${isCodex || options.thinking ? (efforts[options.effort] ?? options.effort) : 'Без размышлений'}` : ''}`
    : savedOptions
      ? 'Модель недоступна'
      : 'Выбрать модель';
  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen)
          setCollisionBoundary(
            triggerRef.current?.closest<HTMLElement>('[data-web-shell-root]') ??
              null,
          );
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          ref={triggerRef}
          className={`${editorStyles.toolBtn} ${editorStyles.modelToolBtn} ${styles.modelTrigger}`}
          disabled={disabled || !models.length}
          aria-label={`Выбрать модель: ${label}`}
          title={label}
          data-web-shell-model-button
          data-web-shell-toolbar-popover-trigger
        >
          <span className={editorStyles.toolBtnModelIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3.5 19.4 7.8v8.4L12 20.5l-7.4-4.3V7.8L12 3.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="m8.2 9.7 3.8 2.2 3.8-2.2M12 11.9v4.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={editorStyles.toolBtnText}>{label}</span>
          <span className={editorStyles.toolBtnArrow}>
            <ChevronDown />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={8}
        collisionBoundary={collisionBoundary ?? undefined}
        data-web-shell-toolbar-popover
        data-web-shell-reasoning-popover
        data-web-shell-compact-overlay={compact ? '' : undefined}
        aria-label="Параметры модели Chat"
        onClick={(event) => event.stopPropagation()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          modelsTriggerRef.current?.focus();
        }}
      >
        {options && (
          <>
            {selected?.reasoning && (
              <div className={editorStyles.reasoningOptions}>
                <div className={editorStyles.reasoningSectionTitle}>
                  Параметры рассуждений
                </div>
                {!isCodex && (
                  <div className={editorStyles.reasoningThinkingRow}>
                    <span>Размышления</span>
                    <Switch
                      checked={options.thinking}
                      disabled={busy || disabled}
                      aria-label="Размышления"
                      onCheckedChange={(thinking) =>
                        void change({ ...options, thinking })
                      }
                    />
                  </div>
                )}
                <div className={editorStyles.reasoningDivider} />
                <div className={editorStyles.reasoningSectionTitle}>
                  Усилие · effort
                </div>
                {availableEfforts.map((effort) => (
                  <button
                    type="button"
                    key={effort}
                    className={editorStyles.reasoningEffortRow}
                    aria-pressed={options.effort === effort}
                    disabled={
                      busy || disabled || (!isCodex && !options.thinking)
                    }
                    onClick={() =>
                      void change({
                        ...options,
                        effort: effort as HomeChatOptions['effort'],
                      })
                    }
                  >
                    <span>{efforts[effort] ?? effort}</span>
                    <span className={editorStyles.dropdownItemCheck}>
                      {options.effort === effort && (
                        <Check aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className={editorStyles.dropdownSubmenuSection}>
              <div className={editorStyles.reasoningSectionTitle}>Модель</div>
              <Popover
                open={modelsOpen}
                onOpenChange={(value) => {
                  setModelsOpen(value);
                  if (!value) setQuery('');
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    ref={modelsTriggerRef}
                    className={`${editorStyles.dropdownItem} ${editorStyles.dropdownSubmenuTrigger}`}
                    disabled={busy || disabled}
                    aria-label="Список моделей"
                    data-web-shell-model-submenu-trigger
                    aria-haspopup="dialog"
                    aria-expanded={modelsOpen}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowRight') return;
                      event.preventDefault();
                      setModelsOpen(true);
                    }}
                  >
                    <span title={selected?.name}>
                      {selected?.name ?? 'Выбрать модель'}
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="end"
                  alignOffset={-10}
                  sideOffset={15}
                  collisionPadding={8}
                  collisionBoundary={collisionBoundary ?? undefined}
                  data-web-shell-toolbar-popover
                  data-web-shell-model-submenu
                  aria-label="Модели Chat"
                  onClick={(event) => event.stopPropagation()}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    modelsTriggerRef.current?.focus();
                  }}
                >
                  <Input
                    type="search"
                    placeholder="Поиск моделей"
                    aria-label="Поиск моделей"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowLeft' || query) return;
                      event.preventDefault();
                      setModelsOpen(false);
                      modelsTriggerRef.current?.focus();
                    }}
                  />
                  <div
                    className={`${editorStyles.dropdownList} ${editorStyles.dropdownCheck} ${editorStyles.dropdownListConstrained}`}
                  >
                    {visibleModels.map((model, index) => (
                      <Fragment key={model.id}>
                        {model.group !== visibleModels[index - 1]?.group && (
                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                            {model.group}
                          </div>
                        )}
                        <button
                          type="button"
                          className={`${editorStyles.dropdownItem} ${model.providerId === selected?.providerId && model.key === selected.key ? editorStyles.dropdownItemActive : ''}`}
                          title={model.name}
                          disabled={busy || disabled}
                          aria-pressed={
                            model.providerId === selected?.providerId &&
                            model.key === selected.key
                          }
                          onClick={() => {
                            void change({
                              ...options,
                              chatModel: {
                                providerId: model.providerId,
                                key: model.key,
                              },
                              thinking: model.reasoning && options.thinking,
                              effort: model.reasoningEfforts
                                ? model.reasoningEfforts.includes(
                                    options.effort,
                                  )
                                  ? options.effort
                                  : (model.defaultReasoningEffort ??
                                    model.reasoningEfforts[0] ??
                                    'medium')
                                : ['low', 'medium', 'high'].includes(
                                      options.effort,
                                    )
                                  ? options.effort
                                  : 'medium',
                            });
                            setOpen(false);
                          }}
                        >
                          <span className={editorStyles.dropdownItemContent}>
                            <span className={editorStyles.dropdownItemLabel}>
                              {model.name}
                            </span>
                          </span>
                          <span className={editorStyles.dropdownItemCheck}>
                            {model.providerId === selected?.providerId &&
                              model.key === selected.key && (
                                <Check aria-hidden="true" />
                              )}
                          </span>
                        </button>
                      </Fragment>
                    ))}
                    {!visibleModels.length && (
                      <div className={editorStyles.dropdownEmpty} role="status">
                        Модели не найдены
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {!isCodex && (
              <div className={editorStyles.dropdownSubmenuSection}>
                <div className={editorStyles.reasoningSectionTitle}>
                  Глубина исследования
                </div>
                {Object.entries(depths).map(([mode, name]) => (
                  <button
                    type="button"
                    key={mode}
                    className={editorStyles.reasoningEffortRow}
                    aria-pressed={options.optimizationMode === mode}
                    disabled={busy || disabled}
                    onClick={() =>
                      void change({
                        ...options,
                        optimizationMode:
                          mode as HomeChatOptions['optimizationMode'],
                      })
                    }
                  >
                    <span>{name}</span>
                    <span className={editorStyles.dropdownItemCheck}>
                      {options.optimizationMode === mode && (
                        <Check aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
