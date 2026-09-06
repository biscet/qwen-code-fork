import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import type { HomeChatModel, HomeChatOptions } from './homechat-api';
import editorStyles from '../ChatEditor.module.css';
import styles from './HomeChatApp.module.css';

const efforts = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
const depths = {
  speed: 'Быстро',
  balanced: 'Сбалансированно',
  quality: 'Глубоко',
};

export function HomeChatModelPicker({
  models,
  options,
  disabled,
  onChange,
}: {
  models: HomeChatModel[];
  options?: HomeChatOptions;
  disabled: boolean;
  onChange: (options: HomeChatOptions) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
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
  const change = async (next: HomeChatOptions) => {
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
    }
  };
  const label = selected
    ? `${selected.name}${selected.reasoning && options ? ` · ${options.thinking ? efforts[options.effort] : 'Без размышлений'}` : ''}`
    : 'Модель недоступна';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${editorStyles.toolBtn} ${editorStyles.modelToolBtn} ${styles.modelTrigger}`}
          disabled={disabled || !options}
          aria-label={`Выбрать модель: ${label}`}
          title={label}
          data-web-shell-model-button
        >
          <span>{label}</span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        data-web-shell-toolbar-popover
        data-web-shell-reasoning-popover
        data-web-shell-compact-overlay={compact ? '' : undefined}
        aria-label="Параметры модели Chat"
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
                <div className={editorStyles.reasoningDivider} />
                <div className={editorStyles.reasoningSectionTitle}>
                  Усилие · effort
                </div>
                {Object.entries(efforts).map(([effort, name]) => (
                  <button
                    type="button"
                    key={effort}
                    className={editorStyles.reasoningEffortRow}
                    aria-pressed={options.effort === effort}
                    disabled={busy || disabled || !options.thinking}
                    onClick={() =>
                      void change({
                        ...options,
                        effort: effort as HomeChatOptions['effort'],
                      })
                    }
                  >
                    <span>{name}</span>
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
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowRight') return;
                      event.preventDefault();
                      setModelsOpen(true);
                    }}
                  >
                    <span title={selected?.name}>
                      {selected?.name ?? 'Выбрать модель'}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side={compact ? 'top' : 'right'}
                  align={compact ? 'start' : 'end'}
                  alignOffset={compact ? 0 : -10}
                  sideOffset={compact ? 4 : 15}
                  collisionPadding={12}
                  data-web-shell-toolbar-popover
                  data-web-shell-model-submenu
                  aria-label="Модели Chat"
                >
                  <Input
                    type="search"
                    placeholder="Поиск моделей"
                    aria-label="Поиск моделей"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowLeft' || query) return;
                      event.preventDefault();
                      setModelsOpen(false);
                    }}
                  />
                  <div
                    className={`${editorStyles.dropdownList} ${editorStyles.dropdownCheck} ${editorStyles.dropdownListConstrained}`}
                  >
                    {models
                      .filter((model) =>
                        `${model.name} ${model.key} ${model.providerName}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((model) => (
                        <button
                          type="button"
                          key={`${model.providerId}/${model.key}`}
                          className={`${editorStyles.dropdownItem} ${model === selected ? editorStyles.dropdownItemActive : ''}`}
                          title={model.name}
                          disabled={busy || disabled}
                          aria-pressed={model === selected}
                          onClick={() => {
                            void change({
                              ...options,
                              chatModel: {
                                providerId: model.providerId,
                                key: model.key,
                              },
                              thinking: model.reasoning && options.thinking,
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
                            {model === selected && <Check aria-hidden="true" />}
                          </span>
                        </button>
                      ))}
                    {!models.some((model) =>
                      `${model.name} ${model.key} ${model.providerName}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    ) && (
                      <div className={editorStyles.dropdownEmpty} role="status">
                        Модели не найдены
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
