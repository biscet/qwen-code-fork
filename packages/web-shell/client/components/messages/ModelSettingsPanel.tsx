import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  DaemonClient,
  DaemonModelSettingsEntry,
  DaemonModelSettingsScope,
  DaemonModelSettingsSaveRequest,
  DaemonModelLimitsCheckResult,
  DaemonWorkspaceProviderStatus,
} from '@qwen-code/sdk/daemon';
import { useI18n } from '../../i18n';
import { isHiddenQwenOAuthModelAlias } from '../../utils/composerModels';
import { Button } from '../ui/button';
import { ContentSkeleton } from '../ui/content-skeleton';
import { Input } from '../ui/input';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ArrowLeftIcon, BotIcon, ServerIcon } from 'lucide-react';

export interface ModelSettingsPanelProps {
  actions: {
    loadModelSettings: DaemonClient['modelSettings'];
    saveModelSettings: DaemonClient['saveModelSettings'];
    deleteModelSettings: DaemonClient['deleteModelSettings'];
    checkModelLimits: DaemonClient['checkModelLimits'];
    loadProviders: DaemonClient['workspaceProviders'];
  };
  currentModelId?: string;
  selectionBusy?: boolean;
  onSelectModel: (modelId: string) => void;
  onSaved: () => void;
}

const QUOTA_SERVICES = [
  {
    id: 'modelscope',
    modelId: 'Qwen/Qwen3.8-27B',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
  },
  {
    id: 'orcarouter',
    modelId: 'qwen/qwen3.8-27b-free',
    baseUrl: 'https://api.orcarouter.ai/v1',
  },
] as const;

function LimitBar({
  label,
  value,
  limit,
}: {
  label: string;
  value?: number;
  limit: number;
}) {
  const percentage =
    value === undefined
      ? 100
      : Math.min(100, Math.max(0, (value / limit) * 100));

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={value ?? limit}
      style={{ backgroundColor: 'var(--warning-color)' }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${percentage}%`,
          backgroundColor: 'var(--success-color)',
        }}
      />
    </div>
  );
}

function modelKey(model: DaemonModelSettingsEntry): string {
  return JSON.stringify([model.providerId, model.modelId, model.baseUrl]);
}

function EditorField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function ModelEditor({
  model,
  existing,
  busy,
  onSave,
  onCancel,
}: {
  model?: DaemonModelSettingsEntry;
  existing: boolean;
  busy: boolean;
  onSave: (model: DaemonModelSettingsSaveRequest['model']) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(model?.name ?? '');
  const [modelId, setModelId] = useState(model?.modelId ?? '');
  const [baseUrl, setBaseUrl] = useState(model?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [envKey, setEnvKey] = useState(model?.envKey ?? '');
  const [thinking, setThinking] = useState(model?.thinking);
  const [effort, setEffort] = useState(model?.reasoningEffort ?? 'default');
  const [numbers, setNumbers] = useState({
    contextWindowSize: String(model?.contextWindowSize ?? ''),
    maxTokens: String(model?.maxTokens ?? ''),
    temperature: String(model?.temperature ?? ''),
    topP: String(model?.topP ?? ''),
  });
  const numericFields = [
    ['contextWindowSize', 1, undefined, 1],
    ['maxTokens', 1, undefined, 1],
    ['temperature', 0, 2, 0.1],
    ['topP', 0, 1, 0.01],
  ] as const;
  return (
    <form
      className="w-full min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries(
          Object.entries(numbers)
            .filter(([, value]) => value.trim())
            .map(([key, value]) => [key, Number(value)]),
        );
        void onSave({
          providerId: model?.providerId ?? 'openai',
          modelId: modelId.trim(),
          name: name.trim(),
          ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
          ...(envKey.trim() ? { envKey: envKey.trim() } : {}),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...values,
          ...(thinking !== undefined ? { thinking } : {}),
          ...(effort !== 'default'
            ? {
                reasoningEffort:
                  effort as DaemonModelSettingsEntry['reasoningEffort'],
              }
            : {}),
        }).catch(() => {});
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={busy}
        className="-ml-2"
      >
        <ArrowLeftIcon />
        {t('settings.models.back')}
      </Button>
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <EditorField label={t('settings.models.name')}>
          <Input
            aria-label={t('settings.models.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={1024}
            autoFocus
          />
        </EditorField>
        <EditorField label={t('settings.models.modelId')}>
          <Input
            aria-label={t('settings.models.modelId')}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            required
            maxLength={1024}
            className="font-mono"
          />
        </EditorField>
        <EditorField label={t('settings.models.baseUrl')}>
          <Input
            aria-label={t('settings.models.baseUrl')}
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required={!existing || !!model?.baseUrl}
            maxLength={1024}
            placeholder="http://127.0.0.1:1235/v1"
            className="font-mono"
          />
        </EditorField>
        <div className="space-y-2">
          <EditorField label={t('settings.models.apiKey')}>
            <Input
              aria-label={t('settings.models.apiKey')}
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t(
                model?.hasApiKey
                  ? 'settings.models.keySaved'
                  : 'settings.models.keyPlaceholder',
              )}
            />
          </EditorField>
          <p className="text-xs text-muted-foreground">
            {t('settings.models.keyHint')}
          </p>
        </div>
        <div className="border-y border-border py-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t('reasoning.thinking')}{' '}
              <span className="text-xs text-muted-foreground">· thinking</span>
            </span>
            <Select
              value={thinking === undefined ? 'default' : String(thinking)}
              onValueChange={(value) =>
                setThinking(value === 'default' ? undefined : value === 'true')
              }
            >
              <SelectTrigger aria-label="Thinking" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="default"
                  disabled={model?.thinking !== undefined}
                >
                  {t('settings.models.default')}
                </SelectItem>
                <SelectItem value="true">{t('settings.value.on')}</SelectItem>
                <SelectItem value="false">{t('settings.value.off')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              {t('reasoning.effort')}{' '}
              <span className="text-xs text-muted-foreground">· effort</span>
            </span>
            <Select
              value={effort}
              onValueChange={setEffort}
              disabled={thinking === false}
            >
              <SelectTrigger aria-label="Effort" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="default"
                  disabled={model?.reasoningEffort !== undefined}
                >
                  {t('settings.models.default')}
                </SelectItem>
                {(
                  model?.supportedEfforts ?? [
                    'low',
                    'medium',
                    'high',
                    'xhigh',
                    'max',
                  ]
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`reasoning.effort.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.models.reasoningHint')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          {numericFields.map(([key, min, max, step]) => (
            <EditorField key={key} label={t(`settings.models.${key}`)}>
              <Input
                aria-label={t(`settings.models.${key}`)}
                type="number"
                min={min}
                max={max}
                step={step}
                value={numbers[key]}
                placeholder={t(
                  model?.[key] === undefined
                    ? 'settings.models.default'
                    : 'settings.models.unchanged',
                )}
                onChange={(e) =>
                  setNumbers((old) => ({ ...old, [key]: e.target.value }))
                }
              />
            </EditorField>
          ))}
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            {t('settings.models.advanced')}
          </summary>
          <div className="mt-4">
            <EditorField label={t('settings.models.envKey')}>
              <Input
                aria-label={t('settings.models.envKey')}
                value={envKey}
                onChange={(e) => setEnvKey(e.target.value)}
                pattern="[A-Z_][A-Z0-9_]*"
                placeholder="LOCAL_QWEN_API_KEY"
                className="font-mono"
              />
            </EditorField>
          </div>
        </details>
        <div className="flex gap-2 border-t border-border pt-4">
          <Button type="submit" size="sm">
            {t(busy ? 'settings.models.saving' : 'settings.models.save')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('settings.models.cancel')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function ModelSettingsPanel({
  actions,
  currentModelId,
  selectionBusy = false,
  onSelectModel,
  onSaved,
  scope,
}: ModelSettingsPanelProps & { scope: DaemonModelSettingsScope }) {
  const { t, language } = useI18n();
  const [models, setModels] = useState<DaemonModelSettingsEntry[]>([]);
  const [providers, setProviders] = useState<DaemonWorkspaceProviderStatus[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [working, setBusy] = useState(false);
  const busy = working || selectionBusy;
  const [deleting, setDeleting] = useState<string>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<{
    model?: DaemonModelSettingsEntry;
    existing: boolean;
  }>();
  const [quotas, setQuotas] = useState<
    Record<string, DaemonModelLimitsCheckResult>
  >({});
  const mounted = useRef(true);
  const sequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, []);
  const reload = useCallback(async () => {
    const seq = ++sequence.current;
    setLoading(true);
    try {
      const [snapshot, status] = await Promise.all([
        actions.loadModelSettings(scope),
        actions.loadProviders(),
      ]);
      if (!mounted.current || sequence.current !== seq) return;
      setModels(
        snapshot.models.filter((model) => !isHiddenQwenOAuthModelAlias(model)),
      );
      setProviders(status.providers);
      setError('');
    } catch (err) {
      if (mounted.current && sequence.current === seq)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current && sequence.current === seq) setLoading(false);
    }
  }, [actions, scope]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (model: DaemonModelSettingsSaveRequest['model']) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await actions.saveModelSettings({
        scope,
        model,
        ...(editor?.existing && editor.model
          ? {
              target: {
                providerId: editor.model.providerId,
                modelId: editor.model.modelId,
                baseUrl: editor.model.baseUrl,
              },
            }
          : {}),
      });
      if (!mounted.current) return;
      setEditor(undefined);
      setQuotas({});
      setMessage(
        t(
          result.runtimeSync?.status === 'failed'
            ? 'settings.models.runtimeSyncFailed'
            : result.runtimeSync?.status === 'deferred'
              ? 'settings.models.deferred'
              : 'settings.models.saved',
        ),
      );
      onSaved();
      await reload();
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async (model: DaemonModelSettingsEntry) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await actions.deleteModelSettings({
        scope,
        target: {
          providerId: model.providerId,
          modelId: model.modelId,
          baseUrl: model.baseUrl,
        },
      });
      if (!mounted.current) return;
      setDeleting(undefined);
      setQuotas({});
      setMessage(
        t(
          result.runtimeSync.status === 'failed'
            ? 'settings.models.runtimeSyncFailed'
            : result.runtimeSync.status === 'deferred'
              ? 'settings.models.deferred'
              : 'settings.models.deleted',
        ),
      );
      onSaved();
      await reload();
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const check = async (model: DaemonModelSettingsEntry) => {
    setBusy(true);
    setError('');
    try {
      const result = await actions.checkModelLimits({
        scope,
        target: {
          providerId: model.providerId,
          modelId: model.modelId,
          baseUrl: model.baseUrl,
        },
      });
      if (mounted.current)
        setQuotas((old) => ({ ...old, [modelKey(model)]: result }));
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div data-testid="model-settings" className="space-y-6">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {editor ? (
        <Card data-motion="detail">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BotIcon
                className="size-4 shrink-0 scale-125"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              {t('settings.models.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ModelEditor
              model={editor.model}
              existing={editor.existing}
              busy={busy}
              onSave={save}
              onCancel={() => {
                setEditor(undefined);
                setError('');
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card role="region" aria-label={t('settings.models.title')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BotIcon
                  className="size-4 shrink-0 scale-125"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                {t('settings.models.title')}
              </CardTitle>
              <CardDescription>{t('settings.models.subtitle')}</CardDescription>
              <CardAction>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || busy}
                  onClick={() => {
                    setEditor({ existing: false });
                    setMessage('');
                  }}
                >
                  {t('settings.models.add')}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="-mb-(--card-spacing) p-0">
              {loading && !models.length && (
                <ContentSkeleton
                  className="px-5 pb-5 max-md:px-4"
                  label={t('settings.models.loading')}
                  rows={3}
                />
              )}
              {!loading && !models.length && !error && (
                <p className="px-5 py-4 text-sm text-muted-foreground max-md:px-4">
                  {t('settings.models.empty')}
                </p>
              )}
              {error && (
                <Button
                  className="mx-5 mb-4"
                  variant="ghost"
                  size="sm"
                  onClick={() => void reload()}
                >
                  {t('settings.models.retry')}
                </Button>
              )}
              <div className="mx-5 divide-y divide-border max-md:mx-4">
                {models.map((model) => {
                  const key = modelKey(model);
                  const matches = providers
                    .filter((p) => p.authType === model.authType)
                    .flatMap((p) => p.models)
                    .filter((m) => {
                      const registryUrl =
                        m.registryBaseUrl !== undefined
                          ? m.registryBaseUrl
                          : model.baseUrl
                            ? m.baseUrl
                            : undefined;
                      return (
                        m.baseModelId === model.modelId &&
                        registryUrl !== undefined &&
                        (registryUrl ?? '').replace(/\/+$/, '') ===
                          (model.baseUrl ?? '').replace(/\/+$/, '')
                      );
                    });
                  const providerModel =
                    matches.length === 1 ? matches[0] : undefined;
                  const current =
                    providerModel &&
                    (providerModel.modelId === currentModelId ||
                      (model.modelId === currentModelId &&
                        models.filter(
                          (entry) => entry.modelId === currentModelId,
                        ).length === 1) ||
                      (!currentModelId && providerModel.isCurrent));
                  const service = QUOTA_SERVICES.find(
                    (s) =>
                      s.baseUrl === model.baseUrl?.replace(/\/$/, '') &&
                      s.modelId === model.modelId,
                  );
                  const quota = quotas[key];
                  return (
                    <div key={key} data-motion-item className="py-4 space-y-3">
                      <div className="flex items-center justify-between gap-4 max-sm:flex-wrap">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium break-words">
                              {model.name}
                            </span>
                            {current && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                · {t('settings.models.current')}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                            {model.modelId} · {model.baseUrl}
                          </div>
                          <dl className="mt-2 flex flex-wrap text-xs text-muted-foreground">
                            <div className="grid gap-0.5 pr-3">
                              <dt className="text-[10px] leading-none text-muted-foreground/70">
                                {t('settings.models.access')}
                              </dt>
                              <dd>
                                {t(
                                  model.hasApiKey
                                    ? 'settings.models.keyConfigured'
                                    : 'settings.models.keyMissing',
                                )}
                              </dd>
                            </div>
                            {model.contextWindowSize && (
                              <div className="grid gap-0.5 border-l border-border px-3">
                                <dt className="text-[10px] leading-none text-muted-foreground/70">
                                  {t('settings.models.context')}
                                </dt>
                                <dd>
                                  {Math.round(model.contextWindowSize / 1024)}K
                                </dd>
                              </div>
                            )}
                            {model.thinking !== undefined && (
                              <div className="grid gap-0.5 border-l border-border px-3">
                                <dt className="text-[10px] leading-none text-muted-foreground/70">
                                  thinking
                                </dt>
                                <dd>
                                  {t(
                                    model.thinking
                                      ? 'settings.value.on'
                                      : 'settings.value.off',
                                  )}
                                </dd>
                              </div>
                            )}
                            {model.reasoningEffort && (
                              <div className="grid gap-0.5 border-l border-border px-3">
                                <dt className="text-[10px] leading-none text-muted-foreground/70">
                                  effort
                                </dt>
                                <dd>{model.reasoningEffort}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {!current && providerModel && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              aria-label={`${t('settings.models.setCurrent')} ${model.name}`}
                              onClick={() =>
                                onSelectModel(providerModel.modelId)
                              }
                            >
                              {t('settings.models.setCurrent')}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            aria-label={`${t('settings.models.edit')} ${model.name}`}
                            onClick={() => {
                              setEditor({ model, existing: true });
                              setMessage('');
                            }}
                          >
                            {t('settings.models.edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            aria-label={`${t('settings.models.delete')} ${model.name}`}
                            onClick={() => {
                              setDeleting(key);
                              setMessage('');
                            }}
                          >
                            {t('settings.models.delete')}
                          </Button>
                        </div>
                      </div>
                      {deleting === key && (
                        <div
                          data-motion="inline"
                          className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                          role="group"
                          aria-label={t('settings.models.delete')}
                        >
                          <span>
                            {t('settings.models.deletePrompt', {
                              name: model.name,
                            })}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => void remove(model)}
                            >
                              {t('settings.models.confirmDelete')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setDeleting(undefined)}
                            >
                              {t('settings.models.cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                      {service && (
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-4">
                            <span>
                              {t(`settings.models.${service.id}.quota`)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy || !model.hasApiKey}
                              onClick={() => void check(model)}
                            >
                              {t('settings.models.checkLimits')}
                            </Button>
                          </div>
                          {quota ? (
                            <div role="status" className="space-y-1">
                              {quota.windows.map((window, index) => (
                                <div key={index} className="space-y-1.5 py-1">
                                  <div className="flex flex-wrap justify-between gap-2">
                                    <span>{window.label}</span>
                                    <span className="tabular-nums">
                                      {window.remaining === undefined
                                        ? t('settings.models.unknown')
                                        : t('settings.models.remaining', {
                                            count: window.remaining,
                                          })}
                                      {window.limit === undefined
                                        ? ''
                                        : ` / ${window.limit}`}
                                      {window.period
                                        ? ` · ${t(`settings.models.period.${window.period}`)}`
                                        : ''}
                                      {window.resetAt
                                        ? ` · ${t('settings.models.resetAt', { time: new Date(window.resetAt).toLocaleString(language) })}`
                                        : ''}
                                    </span>
                                  </div>
                                  {window.limit !== undefined && (
                                    <LimitBar
                                      label={window.label}
                                      value={window.remaining}
                                      limit={window.limit}
                                    />
                                  )}
                                </div>
                              ))}
                              {quota.message && <p>{quota.message}</p>}
                              <p>
                                {t('settings.models.checkedAt', {
                                  time: new Date(
                                    quota.checkedAt,
                                  ).toLocaleString(language),
                                })}
                              </p>
                            </div>
                          ) : (
                            <p>{t('settings.models.quotaUnknown')}</p>
                          )}
                          <p>{t('settings.models.checkHint')}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card role="region" aria-label={t('settings.models.freeServices')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ServerIcon className="size-4 shrink-0" aria-hidden="true" />
                {t('settings.models.freeServices')}
              </CardTitle>
              <CardDescription>
                {t('settings.models.freeServicesHint')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">
                {t('settings.models.freeServicesAvailable')}
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    label: t('settings.models.freeServicesRequestsMinute'),
                    value: 10,
                  },
                  {
                    label: t('settings.models.freeServicesRequestsHour'),
                    value: 60,
                  },
                  {
                    label: t('settings.models.freeServicesTokensDay'),
                    value: 500_000,
                  },
                ].map((limit) => (
                  <div key={limit.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-muted-foreground">
                        {limit.label}
                      </span>
                      <span className="tabular-nums">
                        {limit.value.toLocaleString(language)} /{' '}
                        {limit.value.toLocaleString(language)}
                      </span>
                    </div>
                    <LimitBar
                      label={limit.label}
                      value={limit.value}
                      limit={limit.value}
                    />
                  </div>
                ))}
              </div>
              <a
                href="https://docs.llm7.io/limits"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4"
              >
                {t('settings.models.freeServicesDocs')}
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
