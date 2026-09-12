// @vitest-environment jsdom

import { act, type ReactElement, type ReactNode } from 'react';
import type { HomeProduct } from './components/branding/HomeProductSwitcher';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DaemonProductSessionContext } from '@qwen-code/web-shell/daemon-react-sdk';
import type { WebShellProps } from './App';

interface CapturedWorkspaceSessionProps {
  sessionId?: string;
  workspaceId?: string;
  sessionContext?: DaemonProductSessionContext;
  webShellProps: WebShellProps;
}

const testState = vi.hoisted(() => ({
  props: undefined as CapturedWorkspaceSessionProps | undefined,
  homeChatTheme: undefined as string | undefined,
  modelsAdapter: undefined as WebShellProps['settingsModelSelection'],
}));

vi.mock('react-dom/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom/client')>()),
  default: { createRoot: () => ({ render: vi.fn() }) },
}));
vi.mock('@qwen-code/web-shell/daemon-react-sdk', () => ({
  DaemonWorkspaceProvider: ({ children }: { children: ReactNode }) => children,
  useWorkspace: () => ({ capabilities: { workspaceCwd: '/workspace' } }),
}));
vi.mock('./components/WorkspaceSessionProvider', () => ({
  WorkspaceSessionProvider: (props: CapturedWorkspaceSessionProps) => {
    testState.props = props;
    return null;
  },
}));
vi.mock('./components/homechat/HomeChatApp', () => ({
  HomeChatApp: ({
    theme,
    renderAdministrationPanel,
  }: {
    theme: string;
    renderAdministrationPanel: (
      panel: 'models',
      onClose: () => void,
      selection: NonNullable<WebShellProps['settingsModelSelection']>,
    ) => ReactNode;
  }) => {
    testState.homeChatTheme = theme;
    return testState.modelsAdapter
      ? renderAdministrationPanel(
          'models',
          () => undefined,
          testState.modelsAdapter,
        )
      : null;
  },
}));
vi.mock('./config/daemon', () => ({
  getDaemonBaseUrl: () => '',
  getDaemonToken: () => 'token',
  persistDaemonToken: vi.fn(),
  removeDaemonTokenFromUrl: vi.fn(),
  waitForDaemonTokenMessage: vi.fn(),
}));

import { StandaloneApp } from './main';

describe('StandaloneApp', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.props = undefined;
    testState.homeChatTheme = undefined;
    testState.modelsAdapter = undefined;
    window.localStorage.removeItem('homecode-product');
    window.localStorage.removeItem('qwen-code-web-shell-theme');
    window.history.replaceState(null, '', '/');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the controlled session target in sync with URL changes', () => {
    act(() => root.render(<StandaloneApp daemonToken="token" />));

    act(() => {
      testState.props?.webShellProps.onSessionIdChange?.(
        'session-created',
        'workspace-1',
      );
    });

    expect(testState.props).toMatchObject({
      sessionId: 'session-created',
      workspaceId: 'workspace-1',
    });
    expect(window.location.pathname).toBe('/session/session-created');
    expect(new URLSearchParams(window.location.search).get('workspace')).toBe(
      'workspace-1',
    );
    expect(
      testState.props?.webShellProps.composerToolbarAdditionalActions,
    ).toEqual(['addMenu']);
    expect(testState.props?.webShellProps.environmentPanel?.items).toEqual([
      'environment',
      'subagents',
      'backgroundTasks',
    ]);
    expect(testState.props?.webShellProps.header?.items).not.toContain(
      'contextUsage',
    );
    expect(testState.props?.webShellProps.sidebar).toMatchObject({
      showSessionSourceSwitch: false,
      showWorkspaceGit: false,
    });
  });

  it('uses the simplified Desktop sidebar', () => {
    act(() => root.render(<StandaloneApp daemonToken="token" />));

    expect(testState.props?.webShellProps.sidebar).toMatchObject({
      showSessionSourceSwitch: false,
      showWorkspaceGit: false,
      branding: {
        hideWhenCompact: false,
        render: expect.any(Function),
      },
      primaryNav: {
        items: ['newTask', 'plugins', 'scheduledTasks'],
      },
      footer: {
        items: ['settings', 'daemonStatus', 'models', 'version'],
        layout: 'stacked',
        versionLabel: '2.1.19',
      },
    });
  });

  it('switches to a workspace-free HomeChat URL and restores HomeCode', () => {
    window.history.replaceState(
      null,
      '',
      '/session/session-a?workspace=workspace-a',
    );
    act(() => root.render(<StandaloneApp daemonToken="token" />));
    const branding = testState.props?.webShellProps.sidebar;
    if (!branding || branding === false || branding.branding === false) {
      throw new Error('Expected HomeCode branding');
    }
    const switcher = branding.branding?.render?.() as ReactElement<{
      onProductChange: (product: HomeProduct) => void;
    }>;

    act(() => switcher.props.onProductChange('homechat'));
    expect(window.location.pathname).toBe('/homechat');
    expect(new URLSearchParams(window.location.search).has('workspace')).toBe(
      false,
    );

    act(() => switcher.props.onProductChange('homecode'));
    expect(window.location.pathname).toBe('/session/session-a');
    expect(new URLSearchParams(window.location.search).get('workspace')).toBe(
      'workspace-a',
    );
  });

  it('forwards Chat model selection into its embedded Models screen', () => {
    window.localStorage.setItem('homecode-product', 'homechat');
    testState.modelsAdapter = {
      currentModelId: 'codex:gpt-codex',
      onSelectModel: vi.fn(),
    };
    act(() => root.render(<StandaloneApp daemonToken="token" />));
    expect(testState.props?.webShellProps.initialPanel).toBe('models');
    expect(testState.props?.webShellProps.settingsModelSelection).toBe(
      testState.modelsAdapter,
    );
  });

  it('keeps Chat dark when the Harness theme is light', () => {
    window.localStorage.setItem('homecode-product', 'homechat');
    window.localStorage.setItem('qwen-code-web-shell-theme', 'light');

    act(() => root.render(<StandaloneApp daemonToken="token" />));

    expect(testState.homeChatTheme).toBe('dark');
    expect(document.documentElement.classList.contains('theme-dark')).toBe(
      true,
    );
  });

  it('round-trips standalone context without a workspace selector', () => {
    window.history.replaceState(
      null,
      '',
      '/session/standalone-a?context=standalone',
    );
    act(() => root.render(<StandaloneApp daemonToken="token" />));

    expect(testState.props).toMatchObject({
      sessionId: 'standalone-a',
      sessionContext: { kind: 'standalone' },
    });
    expect(testState.props?.workspaceId).toBeUndefined();

    act(() => {
      testState.props?.webShellProps.onSessionIdChange?.(
        'standalone-b',
        undefined,
        undefined,
        { kind: 'standalone' },
      );
    });

    expect(window.location.pathname).toBe('/session/standalone-b');
    expect(new URLSearchParams(window.location.search).get('context')).toBe(
      'standalone',
    );
    expect(new URLSearchParams(window.location.search).has('workspace')).toBe(
      false,
    );
  });

  it('keeps standalone context out of the URL for an unallocated draft', () => {
    act(() => root.render(<StandaloneApp daemonToken="token" />));

    act(() => {
      testState.props?.webShellProps.onSessionIdChange?.(
        undefined,
        undefined,
        undefined,
        { kind: 'standalone' },
      );
    });

    expect(testState.props).toMatchObject({
      sessionId: undefined,
      workspaceId: undefined,
      sessionContext: { kind: 'standalone' },
    });
    expect(window.location.pathname).toBe('/');
    expect(new URLSearchParams(window.location.search).has('context')).toBe(
      false,
    );
  });

  it('round-trips Live context without exposing its internal workspace', () => {
    window.history.replaceState(null, '', '/session/live-a?context=live');
    act(() => root.render(<StandaloneApp daemonToken="token" />));

    expect(testState.props).toMatchObject({
      sessionId: 'live-a',
      sessionContext: { kind: 'live' },
    });
    expect(testState.props?.workspaceId).toBeUndefined();

    act(() => {
      testState.props?.webShellProps.onSessionIdChange?.(
        'live-b',
        undefined,
        undefined,
        { kind: 'live' },
      );
    });

    expect(window.location.pathname).toBe('/session/live-b');
    expect(new URLSearchParams(window.location.search).get('context')).toBe(
      'live',
    );
    expect(new URLSearchParams(window.location.search).has('workspace')).toBe(
      false,
    );
  });
});
