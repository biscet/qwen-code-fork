// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type {
  DaemonSettingDescriptor,
  DaemonSettingUpdateResult,
  DaemonWorkspaceSettingsStatus,
  DaemonWorkspaceProviderStatus,
} from '@qwen-code/web-shell/daemon-react-sdk';
import { I18nProvider } from '../../i18n';
import {
  SettingsMessage,
  type SettingsMessageSettingsState,
} from './SettingsMessage';
import type { ModelManagementProps } from './ModelManagementSection';
import type { ModelSettingsPanelProps } from './ModelSettingsPanel';
import type { UseLiveVoiceSetupResult } from '../../live/useLiveVoiceSetup';

// The Daemon category renders LocalControlSettingsCard, which reads the
// workspace connection from context; stub it so the category can be
// rendered without a DaemonWorkspaceProvider.
vi.mock('@qwen-code/web-shell/daemon-react-sdk', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@qwen-code/web-shell/daemon-react-sdk')
    >();
  return {
    ...actual,
    useWorkspace: () => ({
      baseUrl: 'http://127.0.0.1:8080/',
      token: 'test-token',
    }),
  };
});

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function render(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  mounted.push({ root, container });
  return container;
}

function boolSetting(): DaemonSettingDescriptor {
  return {
    key: 'general.testFlag',
    type: 'boolean',
    label: 'Test Flag',
    category: 'General',
    requiresRestart: false,
    default: false,
    values: { effective: false },
  };
}

function subDialogSetting(): DaemonSettingDescriptor {
  return {
    key: 'fastModel',
    type: 'string',
    label: 'Fast Model',
    category: 'Model',
    requiresRestart: false,
    default: '',
    values: { effective: '' },
  };
}

function modelSelectSetting(
  key: 'advisorModel' | 'tools.webSearch.model',
  label: string,
  category: 'Model' | 'Tools',
  effective: string | undefined,
): DaemonSettingDescriptor {
  return {
    key,
    type: 'string',
    label,
    category,
    requiresRestart: false,
    default: '',
    values: { effective },
  };
}

function liveEnabledSetting(): DaemonSettingDescriptor {
  return {
    key: 'experimental.liveVoice.enabled',
    type: 'boolean',
    label: 'Qwen Live',
    category: 'Experimental',
    requiresRestart: false,
    default: false,
    values: { effective: false },
  };
}

function liveSetup(keyConfigured: boolean): UseLiveVoiceSetupResult {
  return {
    supported: true,
    status: {
      v: 1,
      enabled: false,
      keyConfigured,
      model: 'qwen3.5-omni-plus-realtime',
      shortcut: 'Command+E',
      install: { state: 'missing' },
      live: {
        v: 1,
        available: false,
        state: 'unavailable',
        shortcut: 'Command+E',
      },
    },
    loading: false,
    mutating: false,
    error: undefined,
    refresh: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    retryInstall: vi.fn(async () => {}),
    launchHost: vi.fn(async () => {}),
  };
}

function makeState(
  settings: DaemonSettingDescriptor[],
  setValue: SettingsMessageSettingsState['setValue'],
  setup?: UseLiveVoiceSetupResult,
): SettingsMessageSettingsState {
  const status: DaemonWorkspaceSettingsStatus = { v: 1, settings };
  return {
    status,
    settings,
    loading: false,
    error: undefined,
    reload: vi.fn(async () => status),
    setValue,
    ...(setup ? { liveSetup: setup } : {}),
  };
}

function makeModelManagement(): ModelManagementProps {
  const providers: DaemonWorkspaceProviderStatus[] = [
    {
      kind: 'model_provider',
      status: 'ok',
      authType: 'openai',
      current: true,
      models: [
        {
          modelId: 'gpt-4o(openai)',
          baseModelId: 'gpt-4o',
          name: 'GPT-4o',
          isCurrent: true,
          isRuntime: false,
        },
      ],
    },
  ];
  return {
    providers,
    currentModelId: 'gpt-4o(openai)',
    loading: false,
    error: undefined,
    busy: false,
    onSelectModel: vi.fn(),
    onDeleteModel: vi.fn(),
    onAddModel: vi.fn(),
  };
}

function makeLocalModelManagement(): ModelManagementProps {
  return {
    ...makeModelManagement(),
    currentModelId: 'local-coder(openai)',
    providers: [
      {
        kind: 'model_provider',
        status: 'ok',
        authType: 'openai',
        current: true,
        models: [
          {
            modelId: 'local-coder(openai)',
            baseModelId: 'local-coder',
            name: 'Local Qwen3.8-27B',
            isCurrent: true,
            isRuntime: false,
          },
          {
            modelId: 'gpt-4o(openai)',
            baseModelId: 'gpt-4o',
            name: 'GPT-4o',
            isCurrent: false,
            isRuntime: false,
          },
        ],
      },
    ],
  };
}

const noop = () => {};

function renderPanel(
  state: SettingsMessageSettingsState,
  overrides: Partial<{
    onSubDialog: (key: string, scope: 'workspace' | 'user') => void;
    modelManagement: ModelManagementProps;
    modelSettings: ModelSettingsPanelProps & { workspaceKey: string };
    initialCategory: string;
    workspaceScopeAvailable: boolean;
  }> = {},
): HTMLElement {
  return render(
    <I18nProvider language="en">
      <SettingsMessage
        settingsState={state}
        embedded
        initialCategory={overrides.initialCategory}
        workspaceScopeAvailable={overrides.workspaceScopeAvailable}
        onLanguageChange={noop}
        onThemeChange={noop}
        onSubDialog={overrides.onSubDialog ?? noop}
        chatWidthMode="1000"
        onChatWidthModeChange={noop}
        modelManagement={overrides.modelManagement}
        modelSettings={overrides.modelSettings}
      />
    </I18nProvider>,
  );
}

/**
 * The second scope tab (radix TabsTrigger) is "User". Radix Tabs default to
 * automatic activation (on focus), so focus it then click to flip to user.
 */
function clickUserTab(container: HTMLElement): void {
  const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  const userTab = tabs[1];
  if (!userTab) throw new Error('User scope tab not found');
  act(() => {
    userTab.focus();
    userTab.click();
  });
  expect(userTab.getAttribute('aria-selected')).toBe('true');
}

/** The boolean control is a radix Switch (button[role="switch"]). */
function switchButton(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(
    'button[role="switch"]',
  );
  if (!el) throw new Error('boolean switch not found');
  return el;
}

describe('SettingsMessage without a workspace', () => {
  it('offers only user scope and persists edits there', async () => {
    const setValue = vi.fn().mockResolvedValue({});
    const container = renderPanel(makeState([boolSetting()], setValue), {
      workspaceScopeAvailable: false,
    });
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['User']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    await act(async () => switchButton(container).click());
    expect(setValue).toHaveBeenCalledWith('user', 'general.testFlag', true);
  });
});

describe('SettingsMessage initialCategory', () => {
  function daemonSetting(): DaemonSettingDescriptor {
    return {
      key: 'daemon.testFlag',
      type: 'boolean',
      label: 'Daemon Flag',
      category: 'Daemon',
      requiresRestart: false,
      default: false,
      values: { effective: false },
    };
  }

  function activeCategoryButton(container: HTMLElement): HTMLButtonElement {
    const el = container.querySelector<HTMLButtonElement>(
      'button[aria-current="page"]',
    );
    if (!el) throw new Error('active category button not found');
    return el;
  }

  it('selects the requested category on open', async () => {
    // The Daemon category's Local Control card fetches status on mount.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify({ active: false })),
      }),
    );
    const container = renderPanel(
      makeState([boolSetting(), daemonSetting()], vi.fn()),
      { initialCategory: 'Daemon' },
    );
    // Flush the card's status fetch under act so it doesn't warn.
    await act(async () => {
      await Promise.resolve();
    });

    expect(activeCategoryButton(container).textContent).toContain('Daemon');
    vi.unstubAllGlobals();
  });

  it('falls back to the first category without an initialCategory', () => {
    const container = renderPanel(
      makeState([boolSetting(), daemonSetting()], vi.fn()),
    );

    expect(activeCategoryButton(container).textContent).toContain('General');
  });

  it('falls back to the first category for an unknown initialCategory', () => {
    const container = renderPanel(
      makeState([boolSetting(), daemonSetting()], vi.fn()),
      { initialCategory: 'NoSuchCategory' },
    );

    expect(activeCategoryButton(container).textContent).toContain('General');
  });

  it('does not force the deep-linked category again after a manual switch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(JSON.stringify({ active: false })),
      }),
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    const renderWith = (state: SettingsMessageSettingsState) =>
      act(() => {
        root.render(
          <I18nProvider language="en">
            <SettingsMessage
              settingsState={state}
              embedded
              initialCategory="Daemon"
              onLanguageChange={noop}
              onThemeChange={noop}
              onSubDialog={noop}
              chatWidthMode="1000"
              onChatWidthModeChange={noop}
            />
          </I18nProvider>,
        );
      });

    renderWith(makeState([boolSetting(), daemonSetting()], vi.fn()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(activeCategoryButton(container).textContent).toContain('Daemon');

    // The user manually switches to General.
    const generalButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((el) => el.textContent?.includes('General'));
    if (!generalButton) throw new Error('General category button not found');
    act(() => {
      generalButton.click();
    });
    expect(activeCategoryButton(container).textContent).toContain('General');

    // A re-render with a fresh settings identity (re-running the deep-link
    // effect) must not override the manual choice.
    renderWith(makeState([boolSetting(), daemonSetting()], vi.fn()));
    expect(activeCategoryButton(container).textContent).toContain('General');
    vi.unstubAllGlobals();
  });
});

describe('SettingsMessage user-scope editing', () => {
  it('persists a boolean toggle to the user scope from the User tab', async () => {
    const setValue = vi.fn(
      (scope: 'workspace' | 'user', key: string, value: unknown) =>
        Promise.resolve({
          key,
          scope,
          value,
          requiresRestart: false,
        } as DaemonSettingUpdateResult),
    );
    const container = renderPanel(makeState([boolSetting()], setValue));

    clickUserTab(container);
    await act(async () => {
      switchButton(container).click();
    });

    expect(setValue).toHaveBeenCalledWith('user', 'general.testFlag', true);
  });

  it('still persists to workspace scope on the default (Workspace) tab', async () => {
    const setValue = vi.fn(
      (scope: 'workspace' | 'user', key: string, value: unknown) =>
        Promise.resolve({
          key,
          scope,
          value,
          requiresRestart: false,
        } as DaemonSettingUpdateResult),
    );
    const container = renderPanel(makeState([boolSetting()], setValue));

    await act(async () => {
      switchButton(container).click();
    });

    expect(setValue).toHaveBeenCalledWith(
      'workspace',
      'general.testFlag',
      true,
    );
  });

  it('keeps the dedicated key secret out of the response and saves replacements', async () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const setup = liveSetup(false);
    const container = renderPanel(
      makeState([liveEnabledSetting()], setValue, setup),
    );

    const experimental = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((button) => button.textContent?.includes('Experimental'));
    act(() => experimental?.click());
    const keyInput =
      container.querySelector<HTMLInputElement>('#live-realtime-key');
    if (!keyInput) throw new Error('Live Realtime key input not found');
    expect(keyInput.type).toBe('password');
    expect(container.textContent).not.toContain('test-dashscope-key');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(keyInput, 'test-dashscope-key');
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
      keyInput.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }),
      );
      await Promise.resolve();
    });

    expect(setup.update).toHaveBeenCalledWith({
      apiKey: { operation: 'replace', value: 'test-dashscope-key' },
    });
    expect(setValue).not.toHaveBeenCalled();
  });

  it('clears the dedicated key only through an explicit setup mutation', async () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const setup = liveSetup(true);
    const container = renderPanel(
      makeState([liveEnabledSetting()], setValue, setup),
    );
    const experimental = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((button) => button.textContent?.includes('Experimental'));
    act(() => experimental?.click());
    const removeKey = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent === 'Remove key');

    await act(async () => {
      removeKey?.click();
      await Promise.resolve();
    });

    expect(setup.update).toHaveBeenCalledWith({
      apiKey: { operation: 'clear' },
    });
    expect(setValue).not.toHaveBeenCalled();
  });

  it('requires confirmation before enabling and describes the native install', async () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const setup = liveSetup(true);
    const container = renderPanel(
      makeState([liveEnabledSetting()], setValue, setup),
    );
    const experimental = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((button) => button.textContent?.includes('Experimental'));
    act(() => experimental?.click());

    act(() => switchButton(container).click());
    expect(document.body.textContent).toContain(
      'download, verify, install, and open',
    );
    const confirm = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('button'),
    ).find((button) => button.textContent === 'Enable and install');
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });

    expect(setup.update).toHaveBeenCalledWith({ enabled: true });
    expect(setValue).not.toHaveBeenCalled();
  });

  it('does not show a stale Host error before Live is enabled', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const setup = liveSetup(true);
    setup.status = {
      ...setup.status!,
      install: { state: 'error', message: 'Gatekeeper rejected old Host' },
    };
    const container = renderPanel(
      makeState([liveEnabledSetting()], setValue, setup),
    );
    const experimental = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((button) => button.textContent?.includes('Experimental'));
    act(() => experimental?.click());

    expect(container.textContent).not.toContain('Gatekeeper rejected old Host');
  });

  it('forwards the active scope to onSubDialog for model sub-dialog keys', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const onSubDialog = vi.fn();
    const container = renderPanel(makeState([subDialogSetting()], setValue), {
      onSubDialog,
    });

    clickUserTab(container);

    // The fastModel sub-dialog Button is the only control button outside the
    // scope tabs and the category nav.
    const nav = container.querySelector('nav');
    const modelButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((b) => b.getAttribute('role') !== 'tab' && !nav?.contains(b));
    if (!modelButton) throw new Error('sub-dialog button not found');
    act(() => modelButton.click());

    expect(onSubDialog).toHaveBeenCalledWith('fastModel', 'user');
  });

  it('uses the current local model as the advisor select default', () => {
    const container = renderPanel(
      makeState(
        [modelSelectSetting('advisorModel', 'Advisor Model', 'Model', '')],
        vi.fn(),
      ),
      { modelManagement: makeLocalModelManagement() },
    );

    expect(
      container.querySelector('input[aria-label="Advisor Model"]'),
    ).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[role="combobox"][aria-label="Advisor Model"]',
      )?.textContent,
    ).toContain('Local Qwen3.8-27B · Default');
  });

  it('hides the built-in Qwen OAuth coder alias from model selects', () => {
    const management = makeLocalModelManagement();
    management.providers.unshift({
      kind: 'model_provider',
      status: 'ok',
      authType: 'qwen-oauth',
      current: true,
      models: [
        {
          modelId: 'coder-model(qwen-oauth)',
          baseModelId: 'coder-model',
          name: 'Qwen 3.7 Max',
          isCurrent: true,
          isRuntime: false,
        },
      ],
    });
    const container = renderPanel(
      makeState(
        [modelSelectSetting('advisorModel', 'Advisor Model', 'Model', '')],
        vi.fn(),
      ),
      { modelManagement: management },
    );

    expect(container.textContent).not.toContain('Qwen 3.7 Max');
    expect(container.textContent).not.toContain('coder-model');
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[role="combobox"][aria-label="Advisor Model"]',
      )?.textContent,
    ).toContain('Local Qwen3.8-27B · Default');
  });

  it('does not restore a persisted coder alias into a model select', () => {
    const container = renderPanel(
      makeState(
        [
          modelSelectSetting(
            'advisorModel',
            'Advisor Model',
            'Model',
            'coder-model',
          ),
        ],
        vi.fn(),
      ),
      { modelManagement: makeLocalModelManagement() },
    );

    expect(container.textContent).not.toContain('coder-model');
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[role="combobox"][aria-label="Advisor Model"]',
      )?.textContent,
    ).toContain('Local Qwen3.8-27B · Default');
  });

  it('preserves a custom model that uses the same bare id', () => {
    const management = makeLocalModelManagement();
    management.providers[0]!.models.push({
      modelId: 'coder-model(openai)',
      baseModelId: 'coder-model',
      name: 'Custom coder endpoint',
      isCurrent: false,
      isRuntime: false,
    });
    const container = renderPanel(
      makeState(
        [
          modelSelectSetting(
            'advisorModel',
            'Advisor Model',
            'Model',
            'coder-model',
          ),
        ],
        vi.fn(),
      ),
      { modelManagement: management },
    );

    expect(
      container.querySelector<HTMLButtonElement>(
        'button[role="combobox"][aria-label="Advisor Model"]',
      )?.textContent,
    ).toContain('Custom coder endpoint');
  });

  it('does not show a persisted coder alias on a model dialog trigger', () => {
    const hiddenFastModel = {
      ...subDialogSetting(),
      values: { effective: 'qwen-oauth:coder-model' },
    };
    const container = renderPanel(makeState([hiddenFastModel], vi.fn()));

    expect(container.textContent).not.toContain('coder-model');
    expect(container.textContent).toContain('Select');
  });

  it('renders the search model as a select without inventing a default', () => {
    const container = renderPanel(
      makeState(
        [
          modelSelectSetting(
            'tools.webSearch.model',
            'Search Model',
            'Tools',
            undefined,
          ),
        ],
        vi.fn(),
      ),
      { modelManagement: makeLocalModelManagement() },
    );

    expect(
      container.querySelector('input[aria-label="Search Model"]'),
    ).toBeNull();
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[role="combobox"][aria-label="Search Model"]',
      )?.textContent,
    ).toContain('Select');
  });

  it('keeps a configured model visible when it is absent from providers', () => {
    const container = renderPanel(
      makeState(
        [
          modelSelectSetting(
            'tools.webSearch.model',
            'Search Model',
            'Tools',
            'dashscope-search',
          ),
        ],
        vi.fn(),
      ),
      { modelManagement: makeLocalModelManagement() },
    );

    expect(
      container.querySelector<HTMLButtonElement>(
        'button[role="combobox"][aria-label="Search Model"]',
      )?.textContent,
    ).toContain('dashscope-search');
  });

  it('shows a fallback UI category with a readable label when no theme setting exists', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    // boolSetting has key 'general.testFlag' — no 'ui.theme', so the
    // fallback UI category branch is exercised.
    const container = renderPanel(makeState([boolSetting()], setValue));

    const nav = container.querySelector('nav');
    const labels = Array.from(nav?.querySelectorAll('span') ?? []).map(
      (s) => s.textContent,
    );
    expect(labels).toContain('UI');
    expect(labels).not.toContain('settings.category.UI');
  });

  it('keeps retired daemon keys like ui.compactMode out of the panel', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const retiredCompactMode: DaemonSettingDescriptor = {
      key: 'ui.compactMode',
      type: 'boolean',
      label: 'Compact Mode',
      category: 'General',
      requiresRestart: false,
      default: false,
      values: { effective: false },
    };
    const container = renderPanel(
      makeState([boolSetting(), retiredCompactMode], setValue),
    );

    // The visible control proves the panel rendered settings rows; the
    // retired key must stay hidden even though the daemon still lists it.
    expect(container.textContent).toContain('Test Flag');
    expect(switchButton(container)).toBeTruthy();
    expect(container.textContent).not.toContain('Compact Mode');
  });

  it('keeps the CLI automatic update setting out of the Web Shell panel', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const automaticUpdate: DaemonSettingDescriptor = {
      key: 'general.enableAutoUpdate',
      type: 'boolean',
      label: 'Enable Auto Update',
      category: 'General',
      requiresRestart: false,
      default: true,
      values: { effective: true },
    };
    const container = renderPanel(
      makeState([boolSetting(), automaticUpdate], setValue),
    );

    expect(container.textContent).toContain('Test Flag');
    expect(container.textContent).not.toContain('Enable Auto Update');
  });

  it('keeps model.reasoningEffort out of the generic settings panel', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const reasoningEffort: DaemonSettingDescriptor = {
      key: 'model.reasoningEffort',
      type: 'enum',
      label: 'Reasoning Effort',
      category: 'Model',
      requiresRestart: false,
      default: undefined,
      options: [{ value: 'none', label: 'None' }],
      values: { effective: undefined },
    };
    const container = renderPanel(
      makeState([boolSetting(), reasoningEffort], setValue),
    );

    expect(container.textContent).toContain('Test Flag');
    expect(container.textContent).not.toContain('Reasoning Effort');
  });

  it('separates Harness, Chat and Models and makes Vane user-wide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ models: [] }))),
    );
    const container = renderPanel(
      makeState([boolSetting(), subDialogSetting()], vi.fn()),
      {
        modelManagement: makeModelManagement(),
      },
    );
    const nav = container.querySelector('nav')!;
    const groups = [...nav.querySelectorAll('[role="group"]')];
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Harness',
      'Chat',
      'Models',
    ]);
    expect(groups[0]?.textContent).toContain('General');
    expect(groups[0]?.textContent).not.toContain('Models');
    expect(groups[1]?.textContent).toContain('Vane');
    expect(groups[1]?.querySelector('button')?.textContent).toBe('Vane4');
    expect(groups[2]?.textContent).toContain('Models');
    await act(async () => groups[1]!.querySelector('button')!.click());
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.textContent).toContain('User · Chat');
    await act(async () => groups[0]!.querySelector('button')!.click());
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(container.querySelector('section')?.textContent).toContain(
      'Test Flag',
    );
    vi.unstubAllGlobals();
  });

  it('keeps Models available when the schema has no Model settings', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const container = renderPanel(makeState([], setValue), {
      modelManagement: makeModelManagement(),
      initialCategory: 'Model',
    });
    expect(
      container.querySelector('button[aria-current="page"]')?.textContent,
    ).toContain('Models');
    expect(
      container.querySelector('[data-testid="model-management"]'),
    ).toBeTruthy();
  });

  it('shows the number of visible models in the Models category', () => {
    const management = makeModelManagement();
    management.providers.unshift({
      kind: 'model_provider',
      status: 'ok',
      authType: 'qwen-oauth',
      current: false,
      models: [
        {
          modelId: 'coder-model(qwen-oauth)',
          baseModelId: 'coder-model',
          name: 'Hidden built-in alias',
          isCurrent: false,
          isRuntime: false,
        },
      ],
    });
    const container = renderPanel(makeState([], vi.fn()), {
      modelManagement: management,
      initialCategory: 'Model',
    });
    const modelCategory = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((button) => button.textContent?.includes('Models'));

    expect(modelCategory?.textContent).toContain('1');
    expect(modelCategory?.textContent).not.toContain('2');
  });

  it('renders the model-management block inside the Model category', () => {
    const setValue = vi.fn(() =>
      Promise.resolve({} as DaemonSettingUpdateResult),
    );
    const container = renderPanel(makeState([subDialogSetting()], setValue), {
      modelManagement: makeModelManagement(),
    });

    // Model is the only category, so it's active — the management block shows.
    const block = container.querySelector('[data-testid="model-management"]');
    expect(block).toBeTruthy();
    expect(block?.textContent).toContain('GPT-4o');
  });

  it('separates chat defaults from model connections and preserves their scope', async () => {
    const onSubDialog = vi.fn();
    const container = renderPanel(makeState([subDialogSetting()], vi.fn()), {
      initialCategory: 'Model',
      onSubDialog,
      modelSettings: {
        workspaceKey: '/workspace',
        actions: {
          loadModelSettings: vi.fn().mockResolvedValue({ models: [] }),
          loadProviders: vi.fn().mockResolvedValue({ providers: [] }),
          saveModelSettings: vi.fn(),
          deleteModelSettings: vi.fn(),
          checkModelLimits: vi.fn(),
        },
        onSelectModel: noop,
        onSaved: noop,
      },
    });
    await act(async () => {});

    const content = container.querySelector('section')!;
    expect(
      content.querySelector('[data-testid="model-settings"]'),
    ).not.toBeNull();
    expect(content.textContent).not.toContain('Fast Model');
    expect(content.textContent).not.toContain('Chat defaults');

    const chatCategory = Array.from(
      container.querySelectorAll<HTMLButtonElement>('nav button'),
    ).find((button) => button.textContent?.includes('Chat defaults'))!;
    act(() => chatCategory.click());
    expect(content.querySelector('[data-testid="model-settings"]')).toBeNull();
    expect(content.textContent).toContain('Fast Model');
    clickUserTab(container);
    act(() => content.querySelector<HTMLButtonElement>('button')!.click());
    expect(onSubDialog).toHaveBeenCalledWith('fastModel', 'user');
  });
});

describe('HomeCode native agent settings', () => {
  it('renders Russian response language as a selector', () => {
    const container = renderPanel(
      makeState(
        [
          {
            key: 'general.outputLanguage',
            type: 'string',
            label: 'Language: Model',
            category: 'General',
            requiresRestart: true,
            default: 'auto',
            values: { effective: 'Russian' },
          },
        ],
        vi.fn(),
      ),
    );
    const select = container.querySelector(
      'button[role="combobox"][aria-label="Response language"]',
    );
    expect(select?.textContent).toContain('Russian');
    expect(container.querySelector('input')).toBeNull();
  });

  it('persists a chosen agent limit as a number in user scope', async () => {
    const setValue = vi.fn().mockResolvedValue({ requiresRestart: true });
    const container = renderPanel(
      makeState(
        [
          {
            key: 'agents.maxParallelAgents',
            type: 'integer',
            label: 'Max Parallel Agents',
            category: 'Advanced',
            requiresRestart: true,
            default: 10,
            values: { effective: 10 },
          },
        ],
        setValue,
      ),
      { workspaceScopeAvailable: false },
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="Parallel subagent limit"]',
    )!;
    expect(input.type).toBe('number');
    expect(input.value).toBe('10');
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, '2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(setValue).toHaveBeenCalledWith(
      'user',
      'agents.maxParallelAgents',
      2,
    );
    expect(container.textContent).toContain('restart');
  });
});
