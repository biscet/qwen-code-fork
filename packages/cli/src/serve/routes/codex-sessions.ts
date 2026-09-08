import type { Application, RequestHandler, Request, Response } from 'express';
import express from 'express';
import { SessionAttachmentReferenceError } from '@qwen-code/acp-bridge/sessionAttachments';
import type {
  WorkspaceRegistry,
  WorkspaceRuntime,
} from '../workspace-registry.js';
import {
  CodexSessionError,
  CodexSessionManager,
  isRecord,
} from '../codex/codex-session-manager.js';
import {
  listWorkspaceSessionsForResponse,
  searchWorkspaceSessionsForResponse,
} from '../server/session-list.js';

export function registerCodexSessionRoutes(
  app: Application,
  deps: {
    workspaceRegistry: WorkspaceRegistry;
    mutate: (options?: { strict?: boolean }) => RequestHandler;
    mutateQwenBatch?: (
      req: Request,
      res: Response,
      ids: string[],
      action: 'archive' | 'unarchive' | 'delete',
      workspace?: string,
    ) => Promise<Record<string, unknown> | undefined>;
  },
) {
  const manager = new CodexSessionManager(deps.workspaceRegistry);
  const parseAttachmentBody = express.raw({ type: '*/*', limit: '8mb' });
  const resolveWorkspace = (selector?: string): WorkspaceRuntime => {
    const entry =
      selector === undefined
        ? deps.workspaceRegistry.primaryEntry
        : (deps.workspaceRegistry.getEntryByWorkspaceId(selector) ??
          deps.workspaceRegistry.getEntryByWorkspaceCwd(selector));
    if (!entry || entry.state !== 'active' || !entry.current)
      throw new CodexSessionError(
        'Workspace is unavailable.',
        503,
        'workspace_runtime_unavailable',
      );
    return entry.current.runtime;
  };

  app.use(async (req, res, next) => {
    const body = isRecord(req.body) ? req.body : {};
    const creation = req.method === 'POST' && req.path === '/session';
    const match = req.path.match(
      /^(?:\/workspaces\/([^/]+))?\/session\/([^/]+)(?:\/(.*))?$/,
    );
    const sessionId = match
      ? decodeURIComponent(match[2]!).toLowerCase()
      : undefined;
    const catalog = req.path.match(
      /^\/workspaces?\/([^/]+)\/sessions(?:\/(live-state|search))?$/,
    );
    const batch = req.path.match(
      /^(?:\/workspaces\/([^/]+))?\/sessions\/(archive|unarchive|delete)$/,
    );
    const ids = Array.isArray(body['sessionIds'])
      ? body['sessionIds'].filter((id): id is string => typeof id === 'string')
      : [];
    const codexIds = ids.filter((id) => manager.owns(id));
    if (
      creation &&
      body['engine'] !== 'codex' &&
      typeof body['sessionId'] === 'string' &&
      manager.owns(body['sessionId'])
    ) {
      res.status(409).json({
        error: 'Session ID belongs to Codex.',
        code: 'session_conflict',
      });
      return;
    }
    if (
      creation &&
      body['engine'] !== undefined &&
      body['engine'] !== 'qwen' &&
      body['engine'] !== 'codex'
    ) {
      res
        .status(400)
        .json({ error: 'Invalid engine.', code: 'invalid_engine' });
      return;
    }
    if (req.path.startsWith('/standalone/') && body['engine'] === 'codex') {
      res.status(409).json({
        error: 'Select a workspace to start Codex Harness.',
        code: 'unsupported_engine_action',
      });
      return;
    }
    if (
      !(creation && body['engine'] === 'codex') &&
      !(sessionId && manager.owns(sessionId)) &&
      !catalog &&
      !(batch && codexIds.length)
    ) {
      next();
      return;
    }

    const run: RequestHandler = async (_req, _res, _next) => {
      try {
        if (creation) {
          const runtime = resolveWorkspace(
            typeof body['cwd'] === 'string' ? body['cwd'] : undefined,
          );
          const session = await manager.create(runtime, body);
          res.status(201).json(session);
          return;
        }
        if (catalog && req.method === 'GET') {
          const selector = decodeURIComponent(catalog[1]!);
          const entry =
            deps.workspaceRegistry.getEntryByWorkspaceId(selector) ??
            deps.workspaceRegistry.getEntryByWorkspaceCwd(selector);
          if (
            !entry ||
            (!manager.list(entry.workspaceCwd, 'active').length &&
              !manager.list(entry.workspaceCwd, 'archived').length)
          ) {
            next();
            return;
          }
          const runtime = resolveWorkspace(selector);
          const archiveState =
            req.query['archiveState'] === 'archived' ? 'archived' : 'active';
          const additions = manager.list(runtime.workspaceCwd, archiveState);
          if (!additions.length) {
            next();
            return;
          }
          if (catalog[2] === 'live-state') {
            if (!runtime.trusted)
              throw new CodexSessionError(
                'Workspace trust is required.',
                403,
                'untrusted_workspace',
              );
            const version = runtime.bridge.getSessionCatalogVersion();
            const revision = additions.reduce(
              (sum, session) =>
                sum + Date.parse(session.updatedAt ?? session.createdAt),
              0,
            );
            res.json({
              v: 1,
              catalogVersion: {
                ...version,
                revision: version.revision + revision,
              },
              sessions: [
                ...runtime.bridge.listWorkspaceSessions(runtime.workspaceCwd),
                ...additions,
              ],
            });
            return;
          }
          if (catalog[2] === 'search') {
            const query =
              typeof req.query['q'] === 'string' ? req.query['q'].trim() : '';
            if (!query || query.length > 200)
              throw new CodexSessionError(
                'Search query must contain 1–200 characters.',
                400,
                'invalid_search_query',
              );
            const maximum =
              req.query['maxResults'] === undefined
                ? 20
                : Number(req.query['maxResults']);
            if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 50)
              throw new CodexSessionError(
                'Search result limit must be between 1 and 50.',
                400,
                'invalid_search_max_results',
              );
            const qwen = await searchWorkspaceSessionsForResponse(
              runtime.workspaceCwd,
              query,
              { maxResults: maximum },
              { runtimeBaseDir: runtime.sessionRuntimeBaseDir },
            );
            const needle = query.toLowerCase();
            const matches = additions.flatMap((summary) => {
              const session = manager.get(summary.sessionId);
              const messages = session.stored.events
                .flatMap((event) => {
                  if (!isRecord(event.data) || !isRecord(event.data['update']))
                    return [];
                  const update = event.data['update'];
                  if (
                    !['user_message_chunk', 'agent_message_chunk'].includes(
                      String(update['sessionUpdate']),
                    ) ||
                    !isRecord(update['content']) ||
                    typeof update['content']['text'] !== 'string'
                  )
                    return [];
                  return [update['content']['text']];
                })
                .join('');
              const text = `${summary.displayName ?? ''}\n${messages}`;
              const index = text.toLowerCase().indexOf(needle);
              return index < 0
                ? []
                : [
                    {
                      session: summary,
                      snippet: text
                        .slice(
                          Math.max(0, index - 60),
                          index + query.length + 140,
                        )
                        .replace(/\s+/g, ' '),
                    },
                  ];
            });
            res.json({
              results: [...qwen.results, ...matches]
                .sort(
                  (a, b) =>
                    Date.parse(b.session.updatedAt ?? b.session.createdAt) -
                    Date.parse(a.session.updatedAt ?? a.session.createdAt),
                )
                .slice(0, maximum),
            });
            return;
          }
          const rows = [...additions];
          let cursor: string | undefined;
          do {
            const page = await listWorkspaceSessionsForResponse(
              runtime.bridge,
              runtime.workspaceCwd,
              { archiveState, size: 500, ...(cursor ? { cursor } : {}) },
              {
                runtimeBaseDir: runtime.sessionRuntimeBaseDir,
                mergeLive: runtime.trusted,
              },
            );
            rows.push(...page.sessions);
            cursor = page.nextCursor;
          } while (cursor);
          const group = req.query['group'];
          const filtered = rows
            .filter((row) => {
              if (
                typeof req.query['parentSessionId'] === 'string' &&
                row.parentSessionId !== req.query['parentSessionId']
              )
                return false;
              if (
                typeof req.query['sourceType'] === 'string' &&
                (row.sourceType ?? 'default') !== req.query['sourceType']
              )
                return false;
              if (
                typeof req.query['sourceId'] === 'string' &&
                row.sourceId !== req.query['sourceId']
              )
                return false;
              if (group === 'pinned') return row.isPinned;
              if (group === 'ungrouped') return !row.groupId;
              if (typeof group === 'string' && group !== 'all')
                return row.groupId === group;
              return true;
            })
            .sort((a, b) => {
              if (
                req.query['view'] === 'organized' &&
                !!a.isPinned !== !!b.isPinned
              )
                return a.isPinned ? -1 : 1;
              return (
                Date.parse(b.updatedAt ?? b.createdAt) -
                  Date.parse(a.updatedAt ?? a.createdAt) ||
                a.sessionId.localeCompare(b.sessionId)
              );
            });
          const rawCursor = req.query['cursor'];
          if (
            rawCursor !== undefined &&
            (typeof rawCursor !== 'string' || !/^codex-v1:\d+$/.test(rawCursor))
          )
            throw new CodexSessionError(
              'Reload the session catalog.',
              400,
              'invalid_cursor',
            );
          const offset =
            typeof rawCursor === 'string'
              ? Number(rawCursor.slice('codex-v1:'.length))
              : 0;
          const size = Math.min(
            500,
            Math.max(1, Number(req.query['size']) || 50),
          );
          res.json({
            sessions: filtered.slice(offset, offset + size),
            ...(offset + size < filtered.length
              ? { nextCursor: `codex-v1:${offset + size}` }
              : {}),
          });
          return;
        }
        if (batch) {
          if (
            ids.length === 0 ||
            ids.length > 100 ||
            ids.length !== (body['sessionIds'] as unknown[]).length
          )
            throw new CodexSessionError(
              'sessionIds must contain 1–100 string IDs.',
            );
          const selector = batch[1] ? decodeURIComponent(batch[1]) : undefined;
          for (const id of codexIds) {
            const session = manager.get(id);
            if (
              selector &&
              resolveWorkspace(selector).workspaceCwd !==
                session.stored.workspaceCwd
            )
              throw new CodexSessionError(
                'Session belongs to another workspace.',
                409,
                'workspace_mismatch',
              );
          }
          const action = batch[2] as 'archive' | 'unarchive' | 'delete';
          const field =
            action === 'delete'
              ? 'removed'
              : action === 'archive'
                ? 'archived'
                : 'unarchived';
          const qwenIds = [...new Set(ids.filter((id) => !manager.owns(id)))];
          if (qwenIds.length && !deps.mutateQwenBatch)
            throw new CodexSessionError(
              'Mixed session dispatch is unavailable.',
              503,
              'session_routing_unavailable',
            );
          const qwen = qwenIds.length
            ? await deps.mutateQwenBatch?.(req, res, qwenIds, action, selector)
            : {};
          if (qwenIds.length && !qwen) return;
          const result: Record<string, unknown[]> = {
            [field]: [],
            alreadyArchived: [],
            alreadyActive: [],
            notFound: [],
            errors: [],
            resolvedConflicts: [],
          };
          for (const [key, value] of Object.entries(qwen ?? {}))
            if (Array.isArray(value)) result[key] = value;
          for (const id of new Set(codexIds)) {
            try {
              if (action === 'delete') await manager.delete(id);
              else await manager.archive(id, action === 'archive');
              result[field]!.push(id);
            } catch (error) {
              result['errors']!.push({
                sessionId: id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
          res.json(result);
          return;
        }
        if (!sessionId || !manager.owns(sessionId)) {
          next();
          return;
        }
        const session = manager.get(sessionId);
        const selector = match?.[1] ? decodeURIComponent(match[1]) : undefined;
        if (
          selector &&
          resolveWorkspace(selector).workspaceCwd !==
            session.stored.workspaceCwd
        )
          throw new CodexSessionError(
            'Session belongs to another workspace.',
            409,
            'workspace_mismatch',
          );
        if (
          typeof body['cwd'] === 'string' &&
          body['cwd'] !== session.stored.workspaceCwd
        )
          throw new CodexSessionError(
            'Session belongs to another workspace.',
            409,
            'workspace_mismatch',
          );
        const action = match?.[3] ?? '';
        if (req.method === 'POST' && action === 'attachments') {
          const runtime = manager.runtime(session);
          const store = manager.attachments(sessionId);
          await new Promise<void>((resolve, reject) => {
            parseAttachmentBody(req, res, (error?: unknown) =>
              error ? reject(error) : resolve(),
            );
          });
          const name = req.query['name'];
          const mimeType = req.headers['content-type']
            ?.split(';', 1)[0]
            ?.trim()
            .toLowerCase();
          if (
            typeof name !== 'string' ||
            !mimeType ||
            !Buffer.isBuffer(req.body)
          )
            throw new CodexSessionError(
              'Request body, Content-Type and name are required.',
            );
          runtime.generationGuard?.assertOpen();
          manager.runtime(session);
          const reference = await store.putAttachment(req.body, mimeType, name);
          runtime.generationGuard?.assertOpen();
          manager.runtime(session);
          res.status(201).json(reference);
          return;
        }
        if (action.startsWith('attachments/')) {
          const runtime = manager.runtime(session);
          const store = manager.attachments(sessionId);
          const attachmentId = decodeURIComponent(
            action.slice('attachments/'.length),
          );
          if (req.method === 'GET') {
            const attachment = await store.read(attachmentId);
            runtime.generationGuard?.assertOpen();
            manager.runtime(session);
            if (!attachment)
              throw new CodexSessionError('Attachment not found.', 404);
            res
              .set({
                'Content-Type': attachment.mimeType,
                'Content-Length': String(attachment.data.byteLength),
                'Cache-Control': 'private, max-age=300',
                'Content-Disposition': 'attachment',
                'X-Content-Type-Options': 'nosniff',
              })
              .send(attachment.data);
            return;
          }
          if (req.method === 'DELETE') {
            const removed = await store.remove(attachmentId);
            runtime.generationGuard?.assertOpen();
            manager.runtime(session);
            res.json({ removed });
            return;
          }
        }
        if (req.method === 'GET' && action === 'events') {
          res.status(200).set({
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Qwen-Event-Epoch': session.bus.epoch,
          });
          res.flushHeaders();
          const controller = new AbortController();
          res.on('close', () => controller.abort());
          const last = req.headers['last-event-id'];
          const epoch = req.headers['x-qwen-event-epoch'];
          const heartbeat = setInterval(() => {
            if (!res.destroyed) res.write(': heartbeat\n\n');
          }, 15000);
          try {
            for await (const event of session.bus.subscribe({
              signal: controller.signal,
              ...(typeof last === 'string' && /^\d+$/.test(last)
                ? { lastEventId: Number(last) }
                : {}),
              ...(typeof epoch === 'string' ? { epoch } : {}),
            })) {
              if (res.destroyed) break;
              res.write(
                `${event.id === undefined ? '' : `id: ${event.id}\n`}data: ${JSON.stringify(event)}\n\n`,
              );
            }
          } finally {
            clearInterval(heartbeat);
            res.end();
          }
          return;
        }
        if (
          req.method === 'POST' &&
          (action === 'load' || action === 'resume')
        ) {
          res.json(manager.restore(sessionId));
          return;
        }
        if (req.method === 'GET' && action === 'transcript') {
          res.json({
            v: 1,
            sessionId,
            events: session.stored.events,
            hasMore: false,
            startTime: session.stored.createdAt,
            lastUpdated: session.stored.updatedAt,
          });
          return;
        }
        if (req.method === 'GET' && action === 'context') {
          res.json({
            v: 1,
            sessionId,
            workspaceCwd: session.stored.workspaceCwd,
            state: manager.state(sessionId),
          });
          return;
        }
        if (req.method === 'GET' && action === 'supported-commands') {
          res.json({ commands: [], skills: [] });
          return;
        }
        if (req.method === 'GET' && action === 'status') {
          res.json(manager.summary(session));
          return;
        }
        if (req.method === 'POST' && action === 'prompt') {
          if (!Array.isArray(body['prompt']) || !body['prompt'].length)
            throw new CodexSessionError('Prompt is required.');
          res.status(202).json(await manager.prompt(sessionId, body['prompt']));
          return;
        }
        if (req.method === 'POST' && action === 'cancel') {
          await manager.cancel(sessionId);
          res.status(204).end();
          return;
        }
        if (
          req.method === 'POST' &&
          (action === 'heartbeat' || action === 'detach')
        ) {
          if (action === 'heartbeat')
            res.json({
              sessionId,
              clientId: req.headers['x-qwen-client-id'],
              lastSeenAt: Date.now(),
            });
          else res.status(204).end();
          return;
        }
        if (req.method === 'POST' && action.startsWith('permission/')) {
          const outcome = isRecord(body['outcome']) ? body['outcome'] : body;
          manager.runtime(session);
          manager.respond(
            sessionId,
            action.slice('permission/'.length),
            outcome['optionId'] === 'allow',
          );
          res.json({});
          return;
        }
        if (
          req.method === 'PATCH' &&
          (action === 'metadata' || action === 'organization')
        ) {
          const metadata = await manager.metadata(sessionId, body);
          res.json(
            action === 'organization'
              ? {
                  ...metadata,
                  groupId: metadata.groupId ?? null,
                  isPinned: metadata.isPinned ?? false,
                }
              : metadata,
          );
          return;
        }
        if (req.method === 'POST' && action === 'model') {
          if (typeof body['modelId'] !== 'string')
            throw new CodexSessionError('Model is required.');
          res.json(await manager.setModel(sessionId, body['modelId']));
          return;
        }
        if (req.method === 'POST' && action === 'config-option') {
          if (
            body['configId'] !== 'reasoning_effort' ||
            typeof body['value'] !== 'string'
          )
            throw new CodexSessionError('Unsupported Codex setting.');
          await manager.setModel(
            sessionId,
            session.stored.modelId,
            body['value'] === 'default' ? undefined : body['value'],
          );
          res.json({
            configOptions: manager.state(sessionId).configOptions,
            persisted: true,
          });
          return;
        }
        if (req.method === 'GET' && action === 'artifacts') {
          res.json({
            v: 1,
            sessionId,
            generatedAt: new Date().toISOString(),
            limits: { maxArtifacts: 1000 },
            artifacts: session.stored.artifacts,
          });
          return;
        }
        if (req.method === 'DELETE' && action === '') {
          await manager.close(sessionId);
          res.status(204).end();
          return;
        }
        throw new CodexSessionError(
          'This operation is not available for Codex sessions.',
          409,
          'unsupported_engine_action',
        );
      } catch (error) {
        if (res.headersSent) {
          res.end();
          return;
        }
        res
          .status(
            error instanceof CodexSessionError
              ? error.status
              : error instanceof RangeError ||
                  (isRecord(error) && error['status'] === 413)
                ? 413
                : error instanceof TypeError ||
                    error instanceof SessionAttachmentReferenceError
                  ? 400
                  : 502,
          )
          .json({
            error: error instanceof Error ? error.message : String(error),
            code:
              error instanceof CodexSessionError ||
              error instanceof SessionAttachmentReferenceError
                ? error.code
                : 'codex_error',
          });
      }
    };
    if (req.method === 'GET') await run(req, res, next);
    else
      deps.mutate({ strict: true })(req, res, (error) => {
        if (error) next(error);
        else void run(req, res, next);
      });
  });
  return manager;
}
