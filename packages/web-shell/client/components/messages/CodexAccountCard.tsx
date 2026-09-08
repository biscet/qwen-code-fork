import { useState } from 'react';
import { BotIcon } from 'lucide-react';
import type { CodexRateLimitSnapshot } from '@qwen-code/sdk/daemon';
import type { CodexAccountControls } from '../../hooks/useCodexAccount';
import { isDesktopShell, openExternalUrl } from '../../utils/externalOpen';
import { codexModelValue } from '../../utils/codexModels';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { ContentSkeleton } from '../ui/content-skeleton';

function LimitWindows({ snapshot }: { snapshot: CodexRateLimitSnapshot }) {
  return (
    <div className="space-y-3">
      {!snapshot.primary && !snapshot.secondary && (
        <p className="text-xs text-muted-foreground">
          Данные об окнах лимита пока недоступны.
        </p>
      )}
      {[snapshot.primary, snapshot.secondary].map((window, index) => {
        if (!window) return null;
        const used =
          typeof window.usedPercent === 'number'
            ? Math.max(0, Math.min(100, window.usedPercent))
            : undefined;
        const minutes = window.windowDurationMins;
        const duration =
          minutes == null
            ? `Окно ${index + 1}`
            : minutes % 1440 === 0
              ? `${minutes / 1440} дн.`
              : minutes % 60 === 0
                ? `${minutes / 60} ч.`
                : `${minutes} мин.`;
        const label = `${snapshot.limitName ?? snapshot.limitId ?? 'Codex'} · ${duration}`;
        return (
          <div key={index} className="space-y-1.5">
            <div className="flex flex-wrap justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums">
                {used === undefined
                  ? 'Остаток неизвестен'
                  : `Осталось ${Math.round((100 - used) * 10) / 10}%`}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={used}
              aria-valuetext={
                used === undefined
                  ? 'Расход неизвестен'
                  : `Использовано ${used}%`
              }
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              style={
                used === undefined
                  ? undefined
                  : { backgroundColor: 'var(--success-color)' }
              }
            >
              {used !== undefined && (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${used}%`,
                    backgroundColor: 'var(--warning-color)',
                  }}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {window.resetsAt == null
                ? 'Время восстановления неизвестно'
                : `Восстановление: ${new Date(window.resetsAt * 1000).toLocaleString('ru-RU')}`}
            </p>
          </div>
        );
      })}
      {snapshot.credits && (
        <p className="text-xs text-muted-foreground">
          Кредиты:{' '}
          {snapshot.credits.unlimited
            ? 'без ограничений'
            : (snapshot.credits.balance ?? 'остаток неизвестен')}
        </p>
      )}
      {snapshot.individualLimit && (
        <p className="text-xs text-muted-foreground">
          Дополнительная квота: осталось{' '}
          {snapshot.individualLimit.remainingPercent}%
          {snapshot.individualLimit.limit == null
            ? ''
            : ` / ${snapshot.individualLimit.limit}`}
        </p>
      )}
    </div>
  );
}

export function CodexAccountCard({
  account,
  currentModelId,
  selectionBusy = false,
  onSelectModel,
  canSelectModel,
}: {
  account: CodexAccountControls;
  currentModelId?: string;
  selectionBusy?: boolean;
  onSelectModel?: (modelId: string) => void;
  canSelectModel?: (modelId: string) => boolean;
}) {
  const { state, busy, error, run, refresh, resetLimits } = account;
  const [browserError, setBrowserError] = useState('');
  const [confirmResetFor, setConfirmResetFor] = useState<string>();
  const [resetNotice, setResetNotice] = useState<{
    account: string;
    text: string;
    error?: boolean;
  }>();
  const openLogin = async (url: string) => {
    setBrowserError('');
    try {
      if (isDesktopShell()) await openExternalUrl(url);
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (cause) {
      setBrowserError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const start = async () => {
    setBrowserError('');
    const next = await run('startCodexLogin');
    if (next?.login) await openLogin(next.login.authUrl);
  };
  const limits = state?.limits;
  const resetCount = limits?.rateLimitResetCredits?.availableCount;
  const resetStorageKey = state?.account
    ? `homecode.codex-reset.${encodeURIComponent(state.account.email ?? 'chatgpt')}`
    : undefined;
  let pendingResetKey: string | null = null;
  try {
    if (resetStorageKey)
      pendingResetKey = sessionStorage.getItem(resetStorageKey);
  } catch {
    // Confirmation reports storage failures before sending a request.
  }
  const resetAvailable =
    !!state?.account &&
    (pendingResetKey ? state.connected : resetCount != null && resetCount > 0);
  const confirmReset = async () => {
    if (!resetAvailable || !resetStorageKey || busy) return;
    setResetNotice(undefined);
    try {
      const idempotencyKey =
        pendingResetKey ??
        sessionStorage.getItem(resetStorageKey) ??
        crypto.randomUUID();
      sessionStorage.setItem(resetStorageKey, idempotencyKey);
      const result = await resetLimits(idempotencyKey);
      if (!result) return;
      sessionStorage.removeItem(resetStorageKey);
      setConfirmResetFor(undefined);
      setResetNotice({
        account: resetStorageKey,
        text: {
          reset: 'Лимиты сброшены.',
          nothingToReset: 'Лимиты уже доступны; сброс не потребовался.',
          noCredit: 'Доступных сбросов нет.',
          alreadyRedeemed: 'Этот запрос на сброс уже выполнен.',
        }[result.outcome],
      });
    } catch (cause) {
      setResetNotice({
        account: resetStorageKey,
        text: cause instanceof Error ? cause.message : String(cause),
        error: true,
      });
    }
  };
  const snapshots =
    limits?.rateLimitsByLimitId &&
    Object.keys(limits.rateLimitsByLimitId).length
      ? Object.values(limits.rateLimitsByLimitId)
      : limits
        ? [limits.rateLimits]
        : [];
  const shownError = browserError || error || state?.error;
  return (
    <Card role="region" aria-label="OpenAI · вход через ChatGPT">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BotIcon
            className="size-4 shrink-0 scale-125"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          OpenAI · вход через ChatGPT
        </CardTitle>
        <CardDescription>
          Codex для задач и HomeChat · общий лимит аккаунта
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!state && !error ? (
          <ContentSkeleton label="Загрузка аккаунта" rows={2} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1 text-xs" role="status">
                {state?.account && (
                  <div className="break-all text-sm font-medium">
                    {state.account.email ?? 'Аккаунт ChatGPT'}
                  </div>
                )}
                <span className="text-muted-foreground">
                  {state?.login
                    ? 'Ожидает входа в браузере'
                    : !state?.account
                      ? 'Вход не выполнен'
                      : state.connected
                        ? 'Подключено'
                        : 'Соединение потеряно'}
                  {state?.account?.planType
                    ? ` · ${state.account.planType}`
                    : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {state?.login ? (
                  <>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={state.login.authUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => {
                          if (isDesktopShell()) {
                            event.preventDefault();
                            void openLogin(state.login!.authUrl);
                          }
                        }}
                      >
                        Открыть браузер
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run('cancelCodexLogin')}
                    >
                      Отменить вход
                    </Button>
                  </>
                ) : state?.account ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run('logoutCodex')}
                  >
                    Выйти
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void start()}
                  >
                    Войти через ChatGPT
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void refresh()}
                >
                  Обновить
                </Button>
              </div>
            </div>
            {state?.account && (
              <>
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    Доступные модели
                  </p>
                  {state.models
                    .filter((model) => !model.hidden)
                    .map((model) => (
                      <div
                        key={model.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {model.displayName || model.model}
                            </span>
                            {currentModelId ===
                              codexModelValue(model.model) && (
                              <span className="text-xs text-muted-foreground">
                                · Текущая
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {model.supportedReasoningEfforts
                              .map((effort) => effort.reasoningEffort)
                              .join(' · ')}
                          </span>
                        </div>
                        {onSelectModel &&
                          currentModelId !== codexModelValue(model.model) && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                busy ||
                                selectionBusy ||
                                !state.connected ||
                                canSelectModel?.(
                                  codexModelValue(model.model),
                                ) === false
                              }
                              aria-label={`Установить текущей ${model.displayName || model.model}`}
                              onClick={() =>
                                onSelectModel(codexModelValue(model.model))
                              }
                            >
                              Установить текущей
                            </Button>
                          )}
                      </div>
                    ))}
                  {!state.models.some((model) => !model.hidden) && (
                    <p className="text-xs text-muted-foreground">
                      Каталог моделей пока недоступен.
                    </p>
                  )}
                </div>
                <div
                  className="space-y-4 border-t border-border pt-3"
                  aria-label="Лимиты Codex"
                >
                  {snapshots.map((snapshot, index) => (
                    <LimitWindows
                      key={snapshot.limitId ?? index}
                      snapshot={snapshot}
                    />
                  ))}
                  {!snapshots.length && (
                    <p className="text-xs text-muted-foreground">
                      Данные о лимитах пока недоступны.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Доступно сбросов лимита: {resetCount ?? 'неизвестно'}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !resetAvailable}
                      onClick={() => {
                        setResetNotice(undefined);
                        setConfirmResetFor(resetStorageKey);
                      }}
                    >
                      {pendingResetKey
                        ? 'Повторить попытку'
                        : 'Сбросить лимиты'}
                    </Button>
                  </div>
                  {resetStorageKey && confirmResetFor === resetStorageKey && (
                    <div
                      data-motion="inline"
                      className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"
                      role="group"
                      aria-label="Подтверждение сброса лимитов"
                    >
                      <span>
                        {pendingResetKey
                          ? 'Повторить предыдущий запрос? Для этой попытки будет использован не более одного сброса.'
                          : 'Использовать один сброс лимита аккаунта ChatGPT?'}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || !resetAvailable}
                          onClick={() => void confirmReset()}
                        >
                          {pendingResetKey
                            ? 'Повторить запрос'
                            : 'Использовать один сброс'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setConfirmResetFor(undefined)}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                  {resetNotice && resetNotice.account === resetStorageKey && (
                    <p
                      className={`text-xs ${resetNotice.error ? 'text-destructive' : 'text-muted-foreground'}`}
                      role={resetNotice.error ? 'alert' : 'status'}
                    >
                      {resetNotice.text}
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {shownError && (
          <p className="text-xs text-destructive" role="alert">
            {shownError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
