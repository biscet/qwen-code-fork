import React from 'react';
import ReactDOM from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import {
  DaemonWorkspaceProvider,
  useWorkspace,
  type DaemonProductSessionContext,
} from '@qwen-code/web-shell/daemon-react-sdk';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RootErrorFallback } from './components/RootErrorFallback';
import { WorkspaceSessionProvider } from './components/WorkspaceSessionProvider';
import { HomeChatApp } from './components/homechat/HomeChatApp';
import { HomeCodeSpinner } from './components/branding/HomeCodeBrand';
import type { WebShellProps } from './App';
import {
  HomeProductSwitcher,
  type HomeProduct,
} from './components/branding/HomeProductSwitcher';
import {
  getDaemonBaseUrl,
  getDaemonToken,
  removeDaemonTokenFromUrl,
  waitForDaemonTokenMessage,
} from './config/daemon';
import { normalizeLanguage, type WebShellLanguage } from './i18n';
import { WebShellThemeId, type WebShellTheme } from './themeContext';
import { buildSessionPathname, parseSessionId } from './utils/sessionPath';
import 'katex/dist/katex.min.css';
import './styles/standalone.css';

const DAEMON_BASE_URL = getDaemonBaseUrl();

const STANDALONE_COMPOSER_TOOLBAR_ADDITIONS = ['addMenu'] as const;

const LANGUAGE_STORAGE_KEY = 'qwen-code-web-shell-language';
const THEME_STORAGE_KEY = 'qwen-code-web-shell-theme';
const PRODUCT_STORAGE_KEY = 'homecode-product';
const DESKTOP_VERSION = '2.1.7';

function readStoredProduct(): HomeProduct {
  try {
    return window.localStorage.getItem(PRODUCT_STORAGE_KEY) === 'homechat'
      ? 'homechat'
      : 'homecode';
  } catch {
    return 'homecode';
  }
}

function storeProduct(product: HomeProduct): void {
  try {
    window.localStorage.setItem(PRODUCT_STORAGE_KEY, product);
  } catch {
    // Keep the selected product for this page even when storage is unavailable.
  }
}

function parseTheme(value: string | null): WebShellTheme | undefined {
  if (value === WebShellThemeId.Dark || value === WebShellThemeId.Light) {
    return value;
  }
  return undefined;
}

function getThemeFromUrl(): WebShellTheme | undefined {
  const theme = new URLSearchParams(window.location.search).get('theme');
  return parseTheme(theme);
}

function readStoredTheme(): WebShellTheme | undefined {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

function storeTheme(theme: WebShellTheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures in private browsing or locked-down browsers.
  }
}

function getInitialTheme(): WebShellTheme {
  return getThemeFromUrl() ?? readStoredTheme() ?? WebShellThemeId.Dark;
}

function readStoredLanguage(): WebShellLanguage | undefined {
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return raw ? normalizeLanguage(raw) : undefined;
  } catch {
    return undefined;
  }
}

function storeLanguage(language: WebShellLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage failures in private browsing or locked-down browsers.
  }
}

function getInitialLanguage(): WebShellLanguage {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('language') ?? params.get('lang');
  if (raw) return normalizeLanguage(raw);
  return normalizeLanguage(readStoredLanguage() ?? navigator.language);
}

function getSessionIdFromUrl(): string | undefined {
  return parseSessionId(window.location.pathname);
}

function getWorkspaceIdFromUrl(): string | undefined {
  return (
    new URLSearchParams(window.location.search).get('workspace') || undefined
  );
}

function getSessionContextFromUrl(): DaemonProductSessionContext | undefined {
  const context = new URLSearchParams(window.location.search).get('context');
  return context === 'standalone' || context === 'live'
    ? { kind: context }
    : undefined;
}

function replaceStandaloneSessionUrl(
  sessionId: string | undefined,
  workspaceId?: string,
  sessionContext?: DaemonProductSessionContext,
  currentPathname?: string,
): void {
  const url = new URL(window.location.href);
  url.pathname = buildSessionPathname(
    currentPathname ?? url.pathname,
    sessionId,
  );
  if (
    sessionContext?.kind === 'standalone' ||
    sessionContext?.kind === 'live'
  ) {
    url.searchParams.set('context', sessionContext.kind);
    url.searchParams.delete('workspace');
  } else if (sessionId && workspaceId) {
    url.searchParams.set('workspace', workspaceId);
    url.searchParams.delete('context');
  } else {
    url.searchParams.delete('workspace');
    url.searchParams.delete('context');
  }
  // Strip one-shot query params so bookmarked / shared URLs do not
  // permanently override stored preferences on every page load.
  url.searchParams.delete('theme');
  url.searchParams.delete('language');
  url.searchParams.delete('lang');
  if (!import.meta.env.DEV) {
    url.searchParams.delete('token');
    url.searchParams.delete('daemon');
  }
  window.history.replaceState(null, '', url);
}

function replaceHomeChatUrl(): void {
  const url = new URL(window.location.href);
  url.pathname = '/homechat';
  url.searchParams.delete('workspace');
  url.searchParams.delete('context');
  window.history.replaceState(null, '', url);
}

function AdministrationPanel({
  workspaceId,
  ...webShellProps
}: WebShellProps & { workspaceId?: string }) {
  const { capabilities, error } = useWorkspace();
  if (error) return <p role="alert">{error.message}</p>;
  if (!capabilities) {
    return <HomeCodeSpinner aria-label="Загрузка" />;
  }
  return (
    <WorkspaceSessionProvider
      workspaceId={workspaceId}
      workspaceCwd={workspaceId ? undefined : capabilities.workspaceCwd}
      webShellProps={webShellProps}
    />
  );
}

export function StandaloneApp({ daemonToken }: { daemonToken?: string }) {
  const macOSDesktop = Boolean(
    (
      window as Window & {
        __HOMECODE_MACOS_DESKTOP__?: boolean;
      }
    ).__HOMECODE_MACOS_DESKTOP__,
  );
  const [theme, setTheme] = useState<WebShellTheme>(() => getInitialTheme());
  const [product, setProduct] = useState<HomeProduct>(() =>
    readStoredProduct(),
  );
  const [language, setLanguage] = useState<WebShellLanguage>(() =>
    getInitialLanguage(),
  );
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    getSessionIdFromUrl(),
  );
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(() =>
    getWorkspaceIdFromUrl(),
  );
  const [sessionContext, setSessionContext] = useState<
    DaemonProductSessionContext | undefined
  >(() => getSessionContextFromUrl());
  const baseUrl = DAEMON_BASE_URL || window.location.origin;
  const renderedTheme = product === 'homechat' ? WebShellThemeId.Dark : theme;
  // Keep the <html> theme class and <meta name="theme-color"> in sync with
  // the React theme so mobile status bars / overscroll backgrounds stay
  // consistent when the user toggles or when ?theme= lands via URL.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'dark');
    root.classList.add(`theme-${renderedTheme}`);
    root.classList.toggle('dark', renderedTheme === WebShellThemeId.Dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        renderedTheme === 'light' ? '#ffffff' : '#080808',
      );
    }
  }, [renderedTheme]);
  useEffect(() => {
    if (product === 'homechat') replaceHomeChatUrl();
  }, [product]);
  const handleThemeChange = useCallback((nextTheme: WebShellTheme) => {
    setTheme(nextTheme);
    storeTheme(nextTheme);
  }, []);
  const handleLanguageChange = useCallback((nextLanguage: WebShellLanguage) => {
    setLanguage(nextLanguage);
    storeLanguage(nextLanguage);
  }, []);
  const handleProductChange = useCallback(
    (nextProduct: HomeProduct) => {
      setProduct(nextProduct);
      storeProduct(nextProduct);
      if (nextProduct === 'homechat') {
        replaceHomeChatUrl();
      } else {
        replaceStandaloneSessionUrl(
          sessionId,
          workspaceId,
          sessionContext,
          '/',
        );
      }
    },
    [sessionContext, sessionId, workspaceId],
  );
  const handleSessionIdChange = useCallback(
    (
      nextSessionId?: string,
      nextWorkspaceId?: string,
      _nextWorkspaceCwd?: string,
      nextSessionContext?: DaemonProductSessionContext,
    ) => {
      setSessionId(nextSessionId);
      const nonWorkspaceContext =
        nextSessionContext?.kind === 'standalone' ||
        nextSessionContext?.kind === 'live'
          ? nextSessionContext
          : undefined;
      setSessionContext(nonWorkspaceContext);
      setWorkspaceId(nonWorkspaceContext ? undefined : nextWorkspaceId);
      replaceStandaloneSessionUrl(
        nextSessionId,
        nextWorkspaceId,
        nonWorkspaceContext,
      );
    },
    [],
  );

  return (
    <ErrorBoundary
      label="web-shell-root"
      fallback={(error, reset) => (
        <RootErrorFallback error={error} onRetry={reset} language={language} />
      )}
    >
      {product === 'homechat' ? (
        <HomeChatApp
          macOSDesktop={macOSDesktop}
          baseUrl={baseUrl}
          token={daemonToken}
          theme={renderedTheme}
          versionLabel={DESKTOP_VERSION}
          onProductChange={handleProductChange}
          renderAdministrationPanel={(panel, onClose, modelSelection) => (
            <DaemonWorkspaceProvider baseUrl={baseUrl} token={daemonToken}>
              <AdministrationPanel
                key={panel}
                workspaceId={workspaceId}
                initialPanel={panel}
                settingsModelSelection={modelSelection}
                onPanelClose={onClose}
                theme={renderedTheme}
                onThemeChange={handleThemeChange}
                language={language}
                onLanguageChange={handleLanguageChange}
                sidebar={false}
                header={{ items: [] }}
                rightPanel={{ items: [] }}
                environmentPanel={{ items: [] }}
              />
            </DaemonWorkspaceProvider>
          )}
        />
      ) : (
        <DaemonWorkspaceProvider baseUrl={baseUrl} token={daemonToken}>
          {macOSDesktop && (
            <div
              className="homecode-window-drag-region"
              data-tauri-drag-region
              aria-hidden="true"
            />
          )}
          <WorkspaceSessionProvider
            sessionId={sessionId}
            workspaceId={workspaceId}
            sessionContext={sessionContext}
            webShellProps={{
              theme,
              onThemeChange: handleThemeChange,
              language,
              onLanguageChange: handleLanguageChange,
              onSessionIdChange: handleSessionIdChange,
              sidebar: {
                showSessionSourceSwitch: false,
                showWorkspaceGit: false,
                branding: {
                  hideWhenCompact: false,
                  render: () => (
                    <HomeProductSwitcher
                      product="homecode"
                      onProductChange={handleProductChange}
                    />
                  ),
                },
                primaryNav: {
                  items: ['newTask', 'plugins', 'scheduledTasks'],
                },
                footer: {
                  items: ['settings', 'daemonStatus', 'models', 'version'],
                  layout: 'stacked',
                  versionLabel: DESKTOP_VERSION,
                },
              },
              header: {
                items: ['title', 'environment', 'rightPanel', 'tokenUsage'],
              },
              rightPanel: {
                items: ['review', 'sideTask', 'terminal'],
              },
              environmentPanel: {
                items: ['environment', 'subagents', 'backgroundTasks'],
              },
              compactThinking: true,
              markdownTableMode: 'advanced',
              composerToolbarAdditionalActions:
                STANDALONE_COMPOSER_TOOLBAR_ADDITIONS,
            }}
          />
        </DaemonWorkspaceProvider>
      )}
    </ErrorBoundary>
  );
}

async function main() {
  const daemonToken = getDaemonToken() ?? (await waitForDaemonTokenMessage());
  removeDaemonTokenFromUrl();

  const container = document.getElementById('root');
  // Boot can outlast the watchdog's grace period (a slow daemon, a token
  // handshake that only completes after a restart settles), in which case
  // index.html's fallback panel is already in #root. React appends to the
  // container rather than replacing it, so drop the panel here — otherwise
  // the recovered app renders below a full-viewport "failed to load" screen.
  container?.querySelector('[data-boot-fallback]')?.remove();

  ReactDOM.createRoot(container!).render(
    <React.StrictMode>
      <StandaloneApp daemonToken={daemonToken} />
    </React.StrictMode>,
  );
}

void main();
