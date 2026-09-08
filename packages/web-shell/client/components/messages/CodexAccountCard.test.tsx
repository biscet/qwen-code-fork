// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CodexAccountState,
  CodexResetLimitsResult,
  DaemonClient,
} from '@qwen-code/sdk/daemon';
import { useCodexAccount } from '../../hooks/useCodexAccount';
import { CodexAccountCard } from './CodexAccountCard';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const loggedOut: CodexAccountState = {
  connected: false,
  account: null,
  login: null,
  models: [],
  limits: null,
  error: null,
  updatedAt: 1,
};

describe('CodexAccountCard', () => {
  let container: HTMLDivElement;
  let root: Root;
  let event:
    | ((value: { type: 'codex_account'; state: CodexAccountState }) => void)
    | undefined;
  let disconnect: (() => void) | undefined;
  const unsubscribe = vi.fn();
  const client = {
    codexAccount: vi.fn(),
    startCodexLogin: vi.fn(),
    cancelCodexLogin: vi.fn(),
    logoutCodex: vi.fn(),
    resetCodexLimits: vi.fn(),
    subscribeCodexEvents: vi.fn(),
  };
  function Screen({
    visible = true,
    selection,
  }: {
    visible?: boolean;
    selection?: Omit<Parameters<typeof CodexAccountCard>[0], 'account'>;
  }) {
    const account = useCodexAccount(client as unknown as DaemonClient, visible);
    return <CodexAccountCard account={account} {...selection} />;
  }
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    client.codexAccount.mockResolvedValue(loggedOut);
    client.startCodexLogin.mockResolvedValue({
      ...loggedOut,
      login: { loginId: 'login', authUrl: 'https://auth.openai.com/test' },
      updatedAt: 2,
    });
    client.cancelCodexLogin.mockResolvedValue({ ...loggedOut, updatedAt: 3 });
    client.logoutCodex.mockResolvedValue({ ...loggedOut, updatedAt: 4 });
    client.subscribeCodexEvents.mockImplementation((options) => {
      event = options.onEvent;
      disconnect = options.onError;
      return unsubscribe;
    });
    vi.spyOn(window, 'open').mockReturnValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  async function render(visible = true) {
    await act(async () => root.render(<Screen visible={visible} />));
  }
  async function click(name: string) {
    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name, exact: true })),
    );
  }

  function withResets(count: number | null = 2): CodexAccountState {
    return {
      ...loggedOut,
      connected: true,
      account: {
        type: 'chatgpt',
        email: 'person@example.test',
        planType: 'pro',
      },
      limits: {
        rateLimits: {
          limitId: 'codex',
          limitName: 'Codex',
          primary: null,
          secondary: null,
        },
        rateLimitsByLimitId: null,
        rateLimitResetCredits:
          count === null ? null : { availableCount: count, credits: null },
      },
    };
  }

  it('selects an encoded Codex model, distinguishes a same-name Qwen model, and shows the current model', async () => {
    const state = withResets();
    state.models = ['gpt-test', 'gpt-next'].map((model) => ({
      id: model,
      model,
      displayName: model,
      description: '',
      hidden: false,
      supportedReasoningEfforts: [{ reasoningEffort: 'low', description: '' }],
      defaultReasoningEffort: 'low',
      inputModalities: ['text'],
      isDefault: model === 'gpt-test',
    }));
    client.codexAccount.mockResolvedValue(state);
    const onSelectModel = vi.fn();
    await act(async () =>
      root.render(
        <Screen selection={{ currentModelId: 'gpt-test', onSelectModel }} />,
      ),
    );
    expect(onSelectModel).not.toHaveBeenCalled();
    await click('Установить текущей gpt-test');
    expect(onSelectModel).toHaveBeenCalledWith('codex:gpt-test');
    await act(async () =>
      root.render(
        <Screen
          selection={{
            currentModelId: 'codex:gpt-test',
            onSelectModel,
            selectionBusy: true,
          }}
        />,
      ),
    );
    expect(
      queryByRole(container, 'button', { name: 'Установить текущей gpt-test' }),
    ).toBeNull();
    expect(container.textContent).toContain('Текущая');
    expect(
      getByRole(container, 'button', {
        name: 'Установить текущей gpt-next',
      }).hasAttribute('disabled'),
    ).toBe(true);
    expect(client.resetCodexLimits).not.toHaveBeenCalled();
  });

  it.each([0, null])(
    'disables reset for unavailable credits (%s)',
    async (count) => {
      client.codexAccount.mockResolvedValue(withResets(count));
      await render();
      expect(
        getByRole(container, 'button', {
          name: 'Сбросить лимиты',
        }).hasAttribute('disabled'),
      ).toBe(true);
      expect(client.resetCodexLimits).not.toHaveBeenCalled();
      if (count === null) expect(container.textContent).toContain('неизвестно');
    },
  );

  it('requires confirmation, permits cancellation, and submits once before the busy render', async () => {
    client.codexAccount.mockResolvedValue(withResets());
    let complete!: (result: CodexResetLimitsResult) => void;
    client.resetCodexLimits.mockReturnValue(
      new Promise<CodexResetLimitsResult>((resolve) => {
        complete = resolve;
      }),
    );
    await render();
    await click('Сбросить лимиты');
    expect(client.resetCodexLimits).not.toHaveBeenCalled();
    await click('Отмена');
    expect(
      queryByRole(container, 'group', { name: 'Подтверждение сброса лимитов' }),
    ).toBeNull();
    expect(client.resetCodexLimits).not.toHaveBeenCalled();
    await click('Сбросить лимиты');
    const confirm = getByRole(container, 'button', {
      name: 'Использовать один сброс',
    });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(client.resetCodexLimits).toHaveBeenCalledOnce();
    expect(confirm.hasAttribute('disabled')).toBe(true);
    await act(async () => complete({ outcome: 'reset', state: withResets(1) }));
    expect(container.textContent).toContain('Лимиты сброшены.');
    expect(container.textContent).toContain('Доступно сбросов лимита: 1');
    expect(sessionStorage.length).toBe(0);
  });

  it('reuses a persisted attempt after an ambiguous error and card navigation', async () => {
    client.codexAccount.mockResolvedValue(withResets());
    client.resetCodexLimits
      .mockRejectedValueOnce(new Error('Connection interrupted'))
      .mockResolvedValueOnce({
        outcome: 'alreadyRedeemed',
        state: withResets(1),
      });
    await render();
    await click('Сбросить лимиты');
    await click('Использовать один сброс');
    expect(getByRole(container, 'alert').textContent).toBe(
      'Connection interrupted',
    );
    const key = client.resetCodexLimits.mock.calls[0][0];
    expect(key).toMatch(/^[\da-f-]{36}$/i);
    await act(async () => root.render(<Screen key="reopened" />));
    expect(client.resetCodexLimits).toHaveBeenCalledOnce();
    await click('Повторить попытку');
    await click('Повторить запрос');
    expect(client.resetCodexLimits).toHaveBeenNthCalledWith(2, key);
    expect(container.textContent).toContain(
      'Этот запрос на сброс уже выполнен.',
    );
    expect(sessionStorage.length).toBe(0);
  });

  it('retries an ambiguous last-credit attempt with its existing key after polling reports zero credits', async () => {
    client.codexAccount.mockResolvedValue(withResets(1));
    client.resetCodexLimits
      .mockRejectedValueOnce(new Error('Response lost'))
      .mockResolvedValueOnce({
        outcome: 'alreadyRedeemed',
        state: withResets(0),
      });
    await render();
    await click('Сбросить лимиты');
    await click('Использовать один сброс');
    const key = client.resetCodexLimits.mock.calls[0][0];
    client.codexAccount.mockResolvedValue(withResets(0));
    await click('Обновить');
    expect(container.textContent).toContain('Доступно сбросов лимита: 0');
    expect(
      getByRole(container, 'button', {
        name: 'Повторить попытку',
      }).hasAttribute('disabled'),
    ).toBe(false);
    await click('Повторить попытку');
    expect(container.textContent).toContain('не более одного сброса');
    await click('Повторить запрос');
    expect(client.resetCodexLimits).toHaveBeenNthCalledWith(2, key);
    expect(container.textContent).toContain(
      'Этот запрос на сброс уже выполнен.',
    );
    expect(
      getByRole(container, 'button', { name: 'Сбросить лимиты' }).hasAttribute(
        'disabled',
      ),
    ).toBe(true);
  });

  it.each([
    ['nothingToReset', 'Лимиты уже доступны; сброс не потребовался.'],
    ['noCredit', 'Доступных сбросов нет.'],
  ] as const)(
    'shows the explicit %s outcome without claiming a reset',
    async (outcome, message) => {
      client.codexAccount.mockResolvedValue(withResets());
      client.resetCodexLimits.mockResolvedValue({
        outcome,
        state: withResets(0),
      });
      await render();
      await click('Сбросить лимиты');
      await click('Использовать один сброс');
      expect(container.textContent).toContain(message);
      expect(container.textContent).not.toContain('Лимиты сброшены.');
      expect(sessionStorage.length).toBe(0);
    },
  );

  it('does not reuse another account’s pending reset attempt', async () => {
    sessionStorage.setItem(
      'homecode.codex-reset.other%40example.test',
      'other-account-attempt',
    );
    client.codexAccount.mockResolvedValue(withResets());
    client.resetCodexLimits.mockResolvedValue({
      outcome: 'reset',
      state: withResets(1),
    });
    await render();
    await click('Сбросить лимиты');
    await click('Использовать один сброс');
    expect(client.resetCodexLimits.mock.calls[0][0]).not.toBe(
      'other-account-attempt',
    );
    expect(
      sessionStorage.getItem('homecode.codex-reset.other%40example.test'),
    ).toBe('other-account-attempt');
  });

  it('starts, reopens and cancels login, then receives a real-account event without model mutations', async () => {
    await render();
    await click('Войти через ChatGPT');
    expect(client.startCodexLogin).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenCalledWith(
      'https://auth.openai.com/test',
      '_blank',
      'noopener,noreferrer',
    );
    expect(
      getByRole(container, 'link', { name: 'Открыть браузер' }).getAttribute(
        'href',
      ),
    ).toBe('https://auth.openai.com/test');
    await click('Отменить вход');
    expect(client.cancelCodexLogin).toHaveBeenCalledOnce();
    expect(
      getByRole(container, 'button', { name: 'Войти через ChatGPT' }),
    ).toBeTruthy();
    await act(async () =>
      event?.({
        type: 'codex_account',
        state: {
          ...loggedOut,
          connected: true,
          account: {
            type: 'chatgpt',
            email: 'person@example.test',
            planType: 'plus',
          },
          updatedAt: 5,
        },
      }),
    );
    expect(container.textContent).toContain('person@example.test');
    expect(container.textContent).toContain('Подключено · plus');
    await click('Выйти');
    expect(client.logoutCodex).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('person@example.test');
  });

  it('renders every returned bucket, preserves unknown usage and displays only returned extras', async () => {
    const known = {
      limitId: 'codex',
      limitName: 'Codex',
      primary: {
        usedPercent: 100,
        windowDurationMins: 300,
        resetsAt: 2_000_000_000,
      },
      secondary: null,
    };
    const unknown = {
      limitId: 'other',
      limitName: 'Other',
      primary: { usedPercent: null, windowDurationMins: null, resetsAt: null },
      secondary: null,
    };
    client.codexAccount.mockResolvedValue({
      ...loggedOut,
      connected: true,
      account: { type: 'chatgpt', email: null, planType: 'pro' },
      limits: {
        rateLimits: known,
        rateLimitsByLimitId: { codex: known, other: unknown },
      },
    });
    await render();
    expect(container.textContent).toContain('Осталось 0%');
    expect(
      getByRole(container, 'progressbar', {
        name: 'Codex · 5 ч.',
      }).getAttribute('aria-valuenow'),
    ).toBe('100');
    expect(
      getByRole(container, 'progressbar', {
        name: 'Other · Окно 1',
      }).hasAttribute('aria-valuenow'),
    ).toBe(false);
    expect(container.textContent).toContain('Остаток неизвестен');
    expect(container.textContent).toContain('Время восстановления неизвестно');
    expect(container.textContent).not.toContain('Кредиты:');
    expect(container.textContent).toContain(
      'Доступно сбросов лимита: неизвестно',
    );
  });

  it('shows unknown windows explicitly instead of rendering an empty quota area', async () => {
    client.codexAccount.mockResolvedValue({
      ...loggedOut,
      connected: true,
      account: { type: 'chatgpt', email: null, planType: 'pro' },
      limits: {
        rateLimits: {
          limitId: null,
          limitName: null,
          primary: null,
          secondary: null,
        },
        rateLimitsByLimitId: null,
      },
    });
    await render();
    expect(container.textContent).toContain(
      'Данные об окнах лимита пока недоступны.',
    );
    expect(queryByRole(container, 'progressbar')).toBeNull();
  });

  it('distinguishes a reachable App Server from a logged-in account', async () => {
    client.codexAccount.mockResolvedValue({ ...loggedOut, connected: true });
    await render();
    expect(container.textContent).toContain('Вход не выполнен');
    expect(container.textContent).not.toContain('Подключено');
    expect(container.textContent).not.toContain('Доступные модели');
    expect(
      queryByRole(container, 'region', { name: 'Лимиты Codex' }),
    ).toBeNull();
    expect(
      getByRole(container, 'button', { name: 'Войти через ChatGPT' }),
    ).toBeTruthy();
  });

  it('retains card contents while polling, pauses when hidden, and reconnects events', async () => {
    vi.useFakeTimers();
    await render();
    const initial = client.codexAccount.mock.calls.length;
    client.codexAccount.mockReturnValue(new Promise(() => {}));
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(client.codexAccount).toHaveBeenCalledTimes(initial + 1);
    expect(
      getByRole(container, 'button', { name: 'Войти через ChatGPT' }),
    ).toBeTruthy();
    expect(
      queryByRole(container, 'status', { name: 'Загрузка аккаунта' }),
    ).toBeNull();
    await render(false);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(client.codexAccount).toHaveBeenCalledTimes(initial + 1);
    act(() => disconnect?.());
    await act(async () => vi.advanceTimersByTime(1000));
    expect(client.subscribeCodexEvents).toHaveBeenCalledTimes(2);
  });

  it('shows login errors inside the card and permits retry', async () => {
    client.startCodexLogin.mockRejectedValueOnce(new Error('Login failed'));
    await render();
    await click('Войти через ChatGPT');
    expect(getByRole(container, 'alert').textContent).toBe('Login failed');
    expect(
      getByRole(container, 'button', {
        name: 'Войти через ChatGPT',
      }).hasAttribute('disabled'),
    ).toBe(false);
    await click('Войти через ChatGPT');
    expect(queryByRole(container, 'alert')).toBeNull();
  });
});
