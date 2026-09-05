/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  type ColumnDef,
  type ExpandedState,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  useConnection,
  useWorkspace,
  useWorkspaceActions,
} from '@qwen-code/web-shell/daemon-react-sdk';
import type {
  DaemonClient,
  DaemonSessionSummary,
  DaemonWorkspaceCapability,
  DaemonWorkspaceGitStatus,
} from '@qwen-code/sdk/daemon';
import { useI18n } from '../../i18n';
import { workspaceLabel } from '../../utils/workspace';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import {
  SESSION_LIST_PAGE_SIZE,
  WEB_SHELL_SESSION_SOURCE_TYPE,
} from '../../constants/sessions';
import {
  useSessionCatalogController,
  useSessionCatalogQuery,
} from '../../session-catalog/session-catalog-hooks';
import { useWorkspaceOverview } from '../sidebar/useWorkspaceOverview';
import { summarizeSessions } from '../sidebar/workspaceOverviewModel';
import { useWorkspaceRemoval } from './useWorkspaceRemoval';
import { WorkspaceRemovalDialog } from './WorkspaceRemovalDialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { DataTable, type DataTableColumnMeta } from '../ui/data-table';
import { Skeleton } from '../ui/skeleton';
import { TooltipProvider } from '../ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import styles from './WorkspacesOverviewPanel.module.css';

/**
 * Counts change on the order of prompts, not keystrokes. The query is
 * byte-identical to useOtherWorkspaceSessions', so for secondary workspaces
 * the catalog store dedupes the panel, sidebar and expanded row subscriptions.
 */
const SESSIONS_POLL_MS = 30_000;
const GIT_POLL_MS = 60_000;
const VISIBLE_SESSION_STEP = 5;

/** One page of active web-shell sessions for one workspace. */
function useWorkspaceSessionsPage(cwd: string, enabled: boolean) {
  const workspace = useWorkspace();
  const query = useMemo(
    () => ({
      routeKind: 'legacy' as const,
      workspaceCwd: cwd,
      options: {
        pageSize: SESSION_LIST_PAGE_SIZE,
        archiveState: 'active' as const,
        sourceType: WEB_SHELL_SESSION_SOURCE_TYPE,
      },
    }),
    [cwd],
  );
  return useSessionCatalogQuery(workspace.client, query, {
    autoLoad: true,
    enabled,
    pollIntervalMs: SESSIONS_POLL_MS,
  });
}

/**
 * Same fetch discipline as the sidebar's git chip: enriched (`wait`) status,
 * last known value kept across a transient failure, refreshed on focus and a
 * visibility-gated slow poll.
 */
function useWorkspaceGitStatus(
  client: DaemonClient,
  cwd: string,
  enabled: boolean,
) {
  const [status, setStatus] = useState<DaemonWorkspaceGitStatus>();
  const [resolved, setResolved] = useState(false);
  const failedRef = useRef(false);
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await client.workspaceByCwd(cwd).workspaceGit({
        wait: true,
      });
      failedRef.current = false;
      setStatus(next);
    } catch (err) {
      if (!failedRef.current) {
        console.warn('[WorkspacesOverviewPanel] git status failed:', err);
        failedRef.current = true;
      }
    } finally {
      setResolved(true);
    }
  }, [client, cwd, enabled]);
  useEffect(() => {
    if (!enabled) {
      setStatus(undefined);
      setResolved(false);
      return;
    }
    setStatus(undefined);
    setResolved(false);
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, GIT_POLL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [enabled, load]);
  return { status, loading: enabled && !resolved };
}

function NameCell({
  workspace,
  expanded,
  onToggle,
}: {
  workspace: DaemonWorkspaceCapability;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <span className={styles.nameCell}>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className={styles.disclosureButton}
        aria-label={t(
          expanded
            ? 'workspacesOverview.collapseChats'
            : 'workspacesOverview.expandChats',
          { name: workspaceLabel(workspace) },
        )}
        aria-expanded={expanded}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </Button>
      <span className={styles.nameLabel}>{workspaceLabel(workspace)}</span>
      {workspace.primary && (
        <Badge variant="secondary">
          {t('workspacesOverview.primaryBadge')}
        </Badge>
      )}
      {!workspace.trusted && (
        <Badge variant="outline">{t('sidebar.workspaceUntrusted')}</Badge>
      )}
    </span>
  );
}

function SessionsCell({ workspace }: { workspace: DaemonWorkspaceCapability }) {
  const { t } = useI18n();
  const page = useWorkspaceSessionsPage(workspace.cwd, workspace.trusted);
  if (!workspace.trusted) {
    return <span className={styles.muted}>—</span>;
  }
  if (page.page === undefined) return <Skeleton className="h-3 w-10" />;
  // Either more pages follow, or the daemon capped its scan; the same
  // union the sidebar's section applies.
  const stats = summarizeSessions(
    page.sessions,
    page.truncated || Boolean(page.nextCursor),
  );
  return (
    <span
      className={styles.statCell}
      title={stats.truncated ? t('workspacesOverview.truncated') : undefined}
    >
      <span>
        {stats.total}
        {stats.truncated ? '+' : ''}
      </span>
      {stats.running > 0 && (
        <Badge variant="secondary">
          {t('workspacesOverview.running', { count: stats.running })}
        </Badge>
      )}
      {stats.attention > 0 && (
        <Badge variant="destructive">
          {t('workspacesOverview.attention', { count: stats.attention })}
        </Badge>
      )}
    </span>
  );
}

function McpCell({ workspace }: { workspace: DaemonWorkspaceCapability }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const { overview } = useWorkspaceOverview(ws.client, workspace.cwd, {
    enabled: workspace.trusted,
    items: ['mcp'],
  });
  const mcp = overview?.mcp;
  // Disabled servers are excluded from the denominator, matching the
  // sidebar chip's connected/enabled convention (formatOverviewValue).
  const enabled = mcp ? mcp.configured - mcp.disabled : 0;
  if (!workspace.trusted) {
    // The runtime discovers MCP servers; before an ACP child is live the
    // daemon answers a placeholder that must read as unknown, never zero.
    return (
      <span className={styles.muted} title={t('sidebar.overview.unknown')}>
        —
      </span>
    );
  }
  if (!overview) return <Skeleton className="h-3 w-12" />;
  if (!mcp || !mcp.initialized) {
    return (
      <span className={styles.muted} title={t('sidebar.overview.unknown')}>
        —
      </span>
    );
  }
  return (
    <span className={styles.statCell}>
      <span>{enabled === 0 ? '0' : `${mcp.connected}/${enabled}`}</span>
      {mcp.failed > 0 && (
        <Badge variant="destructive">
          {t('workspacesOverview.mcpFailed', { count: mcp.failed })}
        </Badge>
      )}
    </span>
  );
}

function GitCell({ workspace }: { workspace: DaemonWorkspaceCapability }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const { status, loading } = useWorkspaceGitStatus(
    ws.client,
    workspace.cwd,
    workspace.trusted,
  );
  if (!workspace.trusted) {
    return <span className={styles.muted}>—</span>;
  }
  if (loading) return <Skeleton className="h-3 w-16" />;
  if (status === undefined) return <span className={styles.muted}>—</span>;
  if (!status.branch) {
    return <span className={styles.muted}>—</span>;
  }
  const dirty =
    (status.staged ?? 0) +
    (status.unstaged ?? 0) +
    (status.untracked ?? 0) +
    (status.conflicted ?? 0);
  return (
    <span className={styles.statCell}>
      <span className={styles.nameLabel}>{status.branch}</span>
      {dirty > 0 && (
        <span className={styles.muted}>
          {t('workspacesOverview.dirty', { count: dirty })}
        </span>
      )}
    </span>
  );
}

function LastActivityCell({
  workspace,
}: {
  workspace: DaemonWorkspaceCapability;
}) {
  const { t } = useI18n();
  const page = useWorkspaceSessionsPage(workspace.cwd, workspace.trusted);
  if (!workspace.trusted) {
    return <span className={styles.muted}>—</span>;
  }
  if (page.page === undefined) return <Skeleton className="h-3 w-20" />;
  let latest: string | undefined;
  for (const session of page.sessions) {
    // Mirrors the daemon's getSummaryActivityTime: a live session has no
    // updatedAt until its first terminal publishes; createdAt stands in.
    const activity = session.updatedAt ?? session.createdAt;
    if (activity && (!latest || activity > latest)) {
      latest = activity;
    }
  }
  if (!latest) return <span className={styles.muted}>—</span>;
  return <span>{formatRelativeTime(latest, t)}</span>;
}

type SessionMutation = 'archive' | 'delete';

interface SessionMutationTarget {
  kind: SessionMutation;
  sessions: DaemonSessionSummary[];
}

function isSessionIdle(session: DaemonSessionSummary): boolean {
  return !(
    session.hasActivePrompt ||
    session.isWaitingForPermission ||
    session.isWaitingForUserQuestion
  );
}

function sessionLabel(session: DaemonSessionSummary): string {
  return session.displayName?.trim() || session.sessionId.slice(0, 8);
}

function ExpandedWorkspaceSessions({
  workspace: workspaceEntry,
  onOpenSession,
  onCurrentSessionRemoved,
  onReportError,
}: {
  workspace: DaemonWorkspaceCapability;
  onOpenSession?: (sessionId: string, workspaceCwd: string) => void;
  onCurrentSessionRemoved?: (session: {
    sessionId: string;
    workspaceCwd: string;
  }) => Promise<boolean | void> | boolean | void;
  onReportError: (error: unknown, message: string) => void;
}) {
  const { t } = useI18n();
  const connection = useConnection();
  const workspace = useWorkspace();
  const catalogController = useSessionCatalogController(workspace.client);
  const sessionPage = useWorkspaceSessionsPage(
    workspaceEntry.cwd,
    workspaceEntry.trusted,
  );
  const [visibleCount, setVisibleCount] = useState(VISIBLE_SESSION_STEP);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [mutationTarget, setMutationTarget] =
    useState<SessionMutationTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const sessions = sessionPage.sessions;
  const visibleSessions = sessions.slice(0, visibleCount);
  const canUseQualifiedMutations =
    connection.capabilities?.features?.includes(
      'workspace_qualified_rest_core',
    ) ?? false;
  const canUseMutations =
    workspaceEntry.trusted &&
    (workspaceEntry.primary || canUseQualifiedMutations);
  const archiveEnabled =
    connection.capabilities?.features?.includes('session_archive') ?? false;
  const canDelete = useCallback(
    (session: DaemonSessionSummary) =>
      canUseMutations && isSessionIdle(session),
    [canUseMutations],
  );
  const canArchive = useCallback(
    (session: DaemonSessionSummary) => archiveEnabled && canDelete(session),
    [archiveEnabled, canDelete],
  );
  const selectableSessions = sessions.filter(canDelete);
  const selectedSessions = sessions.filter((session) =>
    selectedIds.has(session.sessionId),
  );
  const allSelected =
    selectableSessions.length > 0 &&
    selectableSessions.every((session) => selectedIds.has(session.sessionId));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    const availableIds = new Set(sessions.map((session) => session.sessionId));
    setSelectedIds((current) => {
      const next = new Set(
        [...current].filter((sessionId) => availableIds.has(sessionId)),
      );
      return next.size === current.size ? current : next;
    });
  }, [sessions]);

  const requestMutation = useCallback(
    (kind: SessionMutation, targets: DaemonSessionSummary[]) => {
      const canMutate = kind === 'archive' ? canArchive : canDelete;
      if (targets.length === 0 || !targets.every(canMutate)) return;
      setActionError(undefined);
      setMutationTarget({ kind, sessions: targets });
    },
    [canArchive, canDelete],
  );

  const loadEverySession = useCallback(async () => {
    if (!sessionPage.nextCursor && !sessionPage.truncated) return sessions;
    const collected = new Map(
      sessions.map((session) => [session.sessionId, session]),
    );
    let cursor = sessionPage.nextCursor;
    if (!cursor) {
      throw new Error(t('workspacesOverview.allChatsUnavailable'));
    }
    while (cursor) {
      const page = await workspace.client.listWorkspaceSessionsPage(
        workspaceEntry.cwd,
        {
          pageSize: SESSION_LIST_PAGE_SIZE,
          cursor,
          archiveState: 'active',
          sourceType: WEB_SHELL_SESSION_SOURCE_TYPE,
        },
      );
      for (const session of page.sessions) {
        collected.set(session.sessionId, session);
      }
      cursor = page.nextCursor;
      if (page.truncated && !cursor) {
        throw new Error(t('workspacesOverview.allChatsUnavailable'));
      }
    }
    return [...collected.values()];
  }, [
    sessionPage.nextCursor,
    sessionPage.truncated,
    sessions,
    t,
    workspace.client,
    workspaceEntry.cwd,
  ]);

  const requestAllMutation = useCallback(
    (kind: SessionMutation) => {
      if (busy || sessions.length === 0) return;
      setActionError(undefined);
      setBusy(true);
      void loadEverySession()
        .then((targets) => {
          const canMutate = kind === 'archive' ? canArchive : canDelete;
          if (!targets.every(canMutate)) {
            throw new Error(t('workspacesOverview.actionUnavailable'));
          }
          setMutationTarget({ kind, sessions: targets });
        })
        .catch((error: unknown) => {
          const message = t('workspacesOverview.loadChatsFailed');
          setActionError(
            error instanceof Error ? `${message}: ${error.message}` : message,
          );
          onReportError(error, message);
        })
        .finally(() => setBusy(false));
    },
    [
      busy,
      canArchive,
      canDelete,
      loadEverySession,
      onReportError,
      sessions.length,
      t,
    ],
  );

  const confirmMutation = useCallback(() => {
    const target = mutationTarget;
    if (!target || busy) return;
    setMutationTarget(null);
    setBusy(true);
    setActionError(undefined);
    void (async () => {
      const ids = target.sessions.map((session) => session.sessionId);
      const client = workspaceEntry.primary
        ? workspace.client
        : workspace.client.workspaceByCwd(workspaceEntry.cwd);
      const succeeded = new Set<string>();
      let firstError: Error | undefined;
      try {
        if (target.kind === 'archive') {
          const result = await client.archiveSessionsData(ids);
          for (const id of [
            ...result.archived,
            ...result.alreadyArchived,
            ...result.notFound,
          ]) {
            succeeded.add(id);
          }
          if (result.errors[0]) firstError = new Error(result.errors[0].error);
        } else {
          const result = await client.deleteSessionsData(ids);
          for (const id of [...result.removed, ...result.notFound]) {
            succeeded.add(id);
          }
          if (result.errors[0]) firstError = new Error(result.errors[0].error);
        }
        const current = target.sessions.find(
          (session) =>
            succeeded.has(session.sessionId) &&
            connection.sessionId === session.sessionId &&
            (!connection.workspaceCwd ||
              connection.workspaceCwd === workspaceEntry.cwd),
        );
        if (current) {
          const cleared = await onCurrentSessionRemoved?.({
            sessionId: current.sessionId,
            workspaceCwd: workspaceEntry.cwd,
          });
          if (cleared === false) {
            firstError ??= new Error(t('sidebar.newSessionFailed'));
          }
        }
        setSelectedIds((currentIds) => {
          const next = new Set(currentIds);
          for (const id of succeeded) next.delete(id);
          return next;
        });
        if (firstError) throw firstError;
      } finally {
        catalogController.refreshWorkspace(workspaceEntry.cwd);
      }
    })()
      .catch((error: unknown) => {
        const message =
          target.kind === 'archive'
            ? t('workspacesOverview.archiveFailed')
            : t('workspacesOverview.deleteFailed');
        setActionError(
          error instanceof Error ? `${message}: ${error.message}` : message,
        );
        onReportError(error, message);
      })
      .finally(() => setBusy(false));
  }, [
    busy,
    catalogController,
    connection.sessionId,
    connection.workspaceCwd,
    mutationTarget,
    onCurrentSessionRemoved,
    onReportError,
    t,
    workspace.client,
    workspaceEntry.cwd,
    workspaceEntry.primary,
  ]);

  if (!workspaceEntry.trusted) {
    return (
      <div className={styles.sessionsEmpty}>
        {t('workspacesOverview.untrustedChats')}
      </div>
    );
  }
  if (sessionPage.page === undefined && sessionPage.error) {
    return (
      <div className={styles.sessionsLoadFailure} role="alert">
        <span>
          {t('workspacesOverview.loadChatsFailed')}: {sessionPage.error.message}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void sessionPage.reload({ interactive: true })}
        >
          {t('common.retry')}
        </Button>
      </div>
    );
  }
  if (sessionPage.page === undefined) {
    return (
      <div className={styles.sessionsLoading}>
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }

  return (
    <div
      className={styles.sessionsPanel}
      data-testid={`workspace-chats-${workspaceEntry.id}`}
    >
      <div className={styles.sessionsToolbar}>
        <label className={styles.selectAll}>
          <Checkbox
            checked={
              allSelected ? true : someSelected ? 'indeterminate' : false
            }
            disabled={busy || selectableSessions.length === 0}
            onCheckedChange={(checked) => {
              setSelectedIds(
                checked === true
                  ? new Set(
                      selectableSessions.map((session) => session.sessionId),
                    )
                  : new Set(),
              );
            }}
            aria-label={t('workspacesOverview.selectAllChats')}
          />
          <span>
            {t('workspacesOverview.chatCount', {
              count: `${sessions.length}${
                sessionPage.nextCursor || sessionPage.truncated ? '+' : ''
              }`,
            })}
          </span>
        </label>
        <span className={styles.allActions}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={
              busy || sessions.length === 0 || !sessions.every(canArchive)
            }
            title={
              sessions.every(canArchive)
                ? t('workspacesOverview.archiveAll')
                : t('workspacesOverview.actionUnavailable')
            }
            onClick={() => requestAllMutation('archive')}
          >
            <ArchiveIcon />
            {t('workspacesOverview.archiveAll')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={styles.deleteAction}
            disabled={
              busy || sessions.length === 0 || !sessions.every(canDelete)
            }
            title={
              sessions.every(canDelete)
                ? t('workspacesOverview.deleteAll')
                : t('workspacesOverview.actionUnavailable')
            }
            onClick={() => requestAllMutation('delete')}
          >
            <Trash2Icon />
            {t('workspacesOverview.deleteAll')}
          </Button>
        </span>
      </div>

      {selectedSessions.length > 0 && (
        <div className={styles.selectionToolbar}>
          <span>
            {t('workspacesOverview.selectedChats', {
              count: selectedSessions.length,
            })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !selectedSessions.every(canArchive)}
            onClick={() => requestMutation('archive', selectedSessions)}
          >
            {t('workspacesOverview.archiveSelected')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={styles.deleteAction}
            disabled={busy || !selectedSessions.every(canDelete)}
            onClick={() => requestMutation('delete', selectedSessions)}
          >
            {t('workspacesOverview.deleteSelected')}
          </Button>
        </div>
      )}

      {actionError && (
        <div className={styles.sessionsError} role="alert">
          {actionError}
        </div>
      )}

      {sessions.length === 0 ? (
        <div className={styles.sessionsEmpty}>
          {t('workspacesOverview.emptyChats')}
        </div>
      ) : (
        <div className={styles.sessionList}>
          {visibleSessions.map((session) => {
            const label = sessionLabel(session);
            const attention =
              session.isWaitingForPermission ||
              session.isWaitingForUserQuestion;
            const running = session.hasActivePrompt && !attention;
            return (
              <div key={session.sessionId} className={styles.sessionRow}>
                <Checkbox
                  checked={selectedIds.has(session.sessionId)}
                  disabled={busy || !canDelete(session)}
                  aria-label={t('sessionsOverview.selectSession', {
                    name: label,
                  })}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={(checked) => {
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(session.sessionId);
                      else next.delete(session.sessionId);
                      return next;
                    });
                  }}
                />
                <button
                  type="button"
                  className={styles.sessionOpen}
                  disabled={!onOpenSession}
                  aria-label={t('workspacesOverview.openChat', { name: label })}
                  onClick={() =>
                    onOpenSession?.(session.sessionId, workspaceEntry.cwd)
                  }
                >
                  <span className={styles.sessionDetails}>
                    <span className={styles.sessionTitle}>{label}</span>
                    <span className={styles.sessionId}>
                      {session.sessionId.slice(0, 8)}
                    </span>
                  </span>
                </button>
                <span className={styles.sessionMeta}>
                  {attention ? (
                    <Badge variant="destructive">
                      {t('workspacesOverview.attentionChat')}
                    </Badge>
                  ) : running ? (
                    <Badge variant="secondary">
                      {t('workspacesOverview.runningChat')}
                    </Badge>
                  ) : null}
                  {(session.updatedAt || session.createdAt) && (
                    <span>
                      {formatRelativeTime(
                        session.updatedAt ?? session.createdAt ?? '',
                        t,
                      )}
                    </span>
                  )}
                </span>
                <span className={styles.sessionActions}>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    disabled={busy || !canArchive(session)}
                    aria-label={t('workspacesOverview.archiveChat', {
                      name: label,
                    })}
                    title={
                      canArchive(session)
                        ? t('sidebar.archive')
                        : t('workspacesOverview.actionUnavailable')
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      requestMutation('archive', [session]);
                    }}
                  >
                    <ArchiveIcon />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className={styles.deleteAction}
                    disabled={busy || !canDelete(session)}
                    aria-label={t('workspacesOverview.deleteChat', {
                      name: label,
                    })}
                    title={
                      canDelete(session)
                        ? t('sidebar.delete')
                        : t('workspacesOverview.actionUnavailable')
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      requestMutation('delete', [session]);
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {visibleCount < sessions.length && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.showMore}
          disabled={busy}
          onClick={() =>
            setVisibleCount((current) => current + VISIBLE_SESSION_STEP)
          }
        >
          {t('workspacesOverview.showMoreChats', {
            count: Math.min(
              VISIBLE_SESSION_STEP,
              sessions.length - visibleCount,
            ),
          })}
        </Button>
      )}

      <AlertDialog
        open={mutationTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMutationTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mutationTarget?.kind === 'delete'
                ? t('workspacesOverview.confirmDeleteTitle', {
                    count: mutationTarget.sessions.length,
                  })
                : t('workspacesOverview.confirmArchiveTitle', {
                    count: mutationTarget?.sessions.length ?? 0,
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mutationTarget?.kind === 'delete'
                ? t('workspacesOverview.confirmDelete', {
                    count: mutationTarget.sessions.length,
                  })
                : t('workspacesOverview.confirmArchive', {
                    count: mutationTarget?.sessions.length ?? 0,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant={
                mutationTarget?.kind === 'delete' ? 'destructive' : 'default'
              }
              disabled={busy}
              onClick={confirmMutation}
            >
              {mutationTarget?.kind === 'delete'
                ? t('sidebar.delete')
                : t('sidebar.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export interface WorkspacesOverviewPanelProps {
  onClose: () => void;
  /** Starts a new draft in the row's workspace (every row names one). */
  onNewSession: (workspaceCwd: string) => Promise<boolean> | boolean;
  /** Opens the existing Add-workspace dialog; hidden when not registered. */
  onAddWorkspace?: () => void;
  onOpenSession?: (sessionId: string, workspaceCwd: string) => void;
  onCurrentSessionRemoved?: (session: {
    sessionId: string;
    workspaceCwd: string;
  }) => Promise<boolean | void> | boolean | void;
  onError?: (error: unknown, message: string) => void;
  initialFocusRef?: Ref<HTMLHeadingElement>;
}

/**
 * Full-page table of every registered workspace: name, path, session counts,
 * MCP health, branch and last activity, with the per-row actions the sidebar
 * offers in its `⋮` menu. Layer B2 of the workspace-overview plan.
 */
export function WorkspacesOverviewPanel({
  onClose,
  onNewSession,
  onAddWorkspace,
  onOpenSession,
  onCurrentSessionRemoved,
  onError,
  initialFocusRef,
}: WorkspacesOverviewPanelProps) {
  const { t } = useI18n();
  const connection = useConnection();
  const workspace = useWorkspace();
  const workspaceActions = useWorkspaceActions();
  const catalogController = useSessionCatalogController(workspace.client);
  const [creatingCwd, setCreatingCwd] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const workspaces = useMemo(
    () =>
      (workspace.capabilities?.workspaces ?? []).filter(
        (entry) => entry.kind !== 'live',
      ),
    [workspace.capabilities?.workspaces],
  );
  const removalEnabled = Boolean(
    connection.capabilities?.features?.includes('workspace_runtime_removal'),
  );

  const reportError = useCallback(
    (error: unknown, message: string) => {
      if (onError) onError(error, message);
      else console.error(message, error);
    },
    [onError],
  );

  const removal = useWorkspaceRemoval({
    removeWorkspace: (workspaceId, options) =>
      workspaceActions.removeWorkspace(workspaceId, options),
    onRemoved: async (removed) => {
      catalogController.invalidateWorkspace(removed.cwd);
      try {
        await workspace.refreshCapabilities?.();
      } catch {
        // The mutation already converged; a later refresh will reconcile,
        // same contract as the sidebar's reconcileRemovedWorkspace.
      }
    },
    onError: reportError,
    errorMessage: t('sidebar.removeWorkspaceError'),
    blockForce: (candidate) =>
      Boolean(connection.sessionId) &&
      connection.workspaceCwd === candidate.cwd,
  });

  const handleNewSession = useCallback(
    (ws: DaemonWorkspaceCapability) => {
      if (creatingCwd !== null) return;
      setCreatingCwd(ws.cwd);
      void (async () => {
        try {
          await onNewSession(ws.cwd);
        } finally {
          setCreatingCwd(null);
        }
      })();
    },
    [creatingCwd, onNewSession],
  );

  const columns = useMemo<ColumnDef<DaemonWorkspaceCapability>[]>(
    () => [
      {
        id: 'name',
        header: t('workspacesOverview.column.name'),
        cell: ({ row }) => (
          <NameCell
            workspace={row.original}
            expanded={row.getIsExpanded()}
            onToggle={() => row.toggleExpanded()}
          />
        ),
        meta: {
          width: 180,
          fluidWeight: 2,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
      {
        id: 'path',
        header: t('workspacesOverview.column.path'),
        cell: ({ row }) => (
          <span className={styles.pathCell} title={row.original.cwd}>
            {row.original.cwd}
          </span>
        ),
        meta: {
          width: 220,
          fluidWeight: 3,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
      {
        id: 'sessions',
        header: t('workspacesOverview.column.sessions'),
        cell: ({ row }) => <SessionsCell workspace={row.original} />,
        meta: {
          width: 150,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
      {
        id: 'mcp',
        header: t('workspacesOverview.column.mcp'),
        cell: ({ row }) => <McpCell workspace={row.original} />,
        meta: {
          width: 110,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
      {
        id: 'git',
        header: t('workspacesOverview.column.git'),
        cell: ({ row }) => <GitCell workspace={row.original} />,
        meta: {
          width: 150,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
      {
        id: 'lastActivity',
        header: t('workspacesOverview.column.lastActivity'),
        cell: ({ row }) => <LastActivityCell workspace={row.original} />,
        meta: {
          width: 130,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
      {
        id: 'actions',
        header: t('workspacesOverview.column.actions'),
        cell: ({ row }) => {
          const ws = row.original;
          const canRemove =
            removalEnabled && !ws.primary && ws.removable === true;
          return (
            <span className={styles.actionsCell}>
              <Button
                size="sm"
                variant="outline"
                disabled={!ws.trusted || creatingCwd !== null}
                onClick={() => handleNewSession(ws)}
              >
                {t('workspacesOverview.newTask')}
              </Button>
              {canRemove && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t('workspacesOverview.remove')}
                  title={t('workspacesOverview.remove')}
                  disabled={removal.submitting}
                  onClick={() => removal.request(ws)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </span>
          );
        },
        meta: {
          width: 170,
          headerClassName: 'text-right',
          stopRowClick: true,
        } satisfies DataTableColumnMeta<DaemonWorkspaceCapability>,
      },
    ],
    [creatingCwd, handleNewSession, removal, removalEnabled, t],
  );

  const table = useReactTable({
    data: workspaces,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TooltipProvider>
      <div className={styles.page} data-testid="workspaces-overview-panel">
        <header className={styles.pageHeader}>
          <Button
            variant="ghost"
            size="icon"
            className={styles.backButton}
            onClick={onClose}
            aria-label={t('workspacesOverview.back')}
          >
            <ArrowLeftIcon />
          </Button>
          <h1 ref={initialFocusRef} tabIndex={-1} className={styles.title}>
            {t('workspacesOverview.title')}
          </h1>
        </header>
        <div className={styles.pageBody}>
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {t('workspacesOverview.count', { count: workspaces.length })}
            </p>
            {onAddWorkspace && (
              <span className={styles.toolbarActions}>
                <Button size="sm" variant="outline" onClick={onAddWorkspace}>
                  <PlusIcon />
                  {t('sidebar.addWorkspace')}
                </Button>
              </span>
            )}
          </div>
          <DataTable
            table={table}
            rowClassName={(row) =>
              row.getIsExpanded()
                ? `${styles.workspaceRow} ${styles.workspaceRowExpanded}`
                : styles.workspaceRow
            }
            onRowClick={(row) => row.toggleExpanded()}
            renderExpandedRow={(row) =>
              row.getIsExpanded() ? (
                <ExpandedWorkspaceSessions
                  workspace={row.original}
                  onOpenSession={onOpenSession}
                  onCurrentSessionRemoved={onCurrentSessionRemoved}
                  onReportError={reportError}
                />
              ) : null
            }
          />
        </div>
        <WorkspaceRemovalDialog
          removal={removal}
          currentSessionInCandidate={
            Boolean(connection.sessionId) &&
            connection.workspaceCwd === removal.candidate?.cwd
          }
        />
      </div>
    </TooltipProvider>
  );
}
