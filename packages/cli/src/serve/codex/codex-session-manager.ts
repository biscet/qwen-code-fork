import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import path from 'node:path';
import { EventBus, type BridgeEvent } from '@qwen-code/acp-bridge/eventBus';
import {
  SessionAttachmentStore,
  isSessionAttachmentReference,
} from '@qwen-code/acp-bridge/sessionAttachments';
import type {
  BridgeSessionSummary,
  DaemonSessionArtifact,
} from '@qwen-code/acp-bridge';
import {
  SessionService,
  stableSessionArtifactId,
  sessionArtifactIdentityKey,
  type ToolCall,
} from '@qwen-code/qwen-code-core';
import type {
  WorkspaceRegistry,
  WorkspaceRuntime,
} from '../workspace-registry.js';
import { getCodexService } from './codex-service.js';
import { CodexTools } from './codex-tools.js';
import { loadSettings } from '../../config/settings.js';
import {
  generateOutputLanguageFileContent,
  resolveOutputLanguageOrPreserveAuto,
} from '../../i18n/languageUtils.js';

function harnessInstructions(workspaceCwd: string): string {
  const settings = loadSettings(workspaceCwd, {
    skipLoadEnvironment: true,
    workspaceTrusted: true,
  });
  const language = resolveOutputLanguageOrPreserveAuto(
    settings.merged.general?.outputLanguage,
  );
  return (
    'You are Codex in HomeCode Harness. Use the HomeCode dynamic tools for findings, artifacts, images and the selected workspace MCP integrations. Do not call a Qwen model or start another Qwen agent.\n\n' +
    `## Workspace MCPs and agents
Use the connected tool inventory and read relevant workspace skills and agent instructions. Prefer Serena for semantic navigation and symbol changes, Node REPL for JavaScript and local APIs, and Playwright for browser interactions and end-to-end checks. Use Chrome DevTools (--slim) for navigation, in-page JavaScript and screenshots. MCPs using the bundled local launcher run in the selected workspace: localhost refers to this Mac. Before semantic edits, confirm Serena's active project matches the selected workspace. MCPs configured with remote URLs use their remote host's paths and localhost; check each server's configuration before using it. Home AI Research remains a remote web-search service and requires LOCAL_QWEN_API_KEY. Do not claim an MCP check succeeded unless its tool call succeeded; report unavailable integrations and use another available tool when appropriate.

` +
    generateOutputLanguageFileContent(language)
  );
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export class CodexSessionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'codex_session_error',
  ) {
    super(message);
  }
}

function toCodexInput(part: unknown, filePath?: string) {
  if (!isRecord(part)) throw new CodexSessionError('Invalid prompt content.');
  if (part['type'] === 'text' && typeof part['text'] === 'string')
    return { type: 'text', text: part['text'], text_elements: [] };
  if (
    part['type'] === 'image' &&
    typeof part['data'] === 'string' &&
    typeof part['mimeType'] === 'string'
  )
    return {
      type: 'image',
      url: `data:${part['mimeType']};base64,${part['data']}`,
    };
  if (
    part['type'] === 'resource' &&
    isRecord(part['resource']) &&
    typeof part['resource']['uri'] === 'string' &&
    typeof part['resource']['text'] === 'string'
  )
    return {
      type: 'text',
      text: `Attached file: ${part['resource']['uri']}\n\n${part['resource']['text']}`,
      text_elements: [],
    };
  if (filePath && part['type'] === 'resource' && isRecord(part['resource']))
    return {
      type: 'text',
      text: `Attached file: ${filePath}`,
      text_elements: [],
    };
  throw new CodexSessionError(
    'Codex supports text, images and text file attachments.',
    400,
    'unsupported_input',
  );
}

interface StoredSession {
  engine: 'codex';
  sessionId: string;
  threadId: string;
  workspaceCwd: string;
  workspaceId: string;
  modelId: string;
  reasoningEffort?: string;
  reasoningEfforts?: string[];
  dynamicToolNames?: string[];
  createdAt: string;
  updatedAt: string;
  displayName: string;
  isPinned?: boolean;
  pinnedAt?: string;
  groupId?: string | null;
  color?: string | null;
  isArchived?: boolean;
  sourceType?: string;
  sourceId?: string;
  events: BridgeEvent[];
  artifacts: DaemonSessionArtifact[];
  promptId?: string;
  turnId?: string;
  turnError?: { message: string; code: string };
}

interface LiveSession {
  stored: StoredSession;
  attachments: SessionAttachmentStore;
  bus: EventBus;
  tools?: CodexTools;
  loaded: boolean;
  abort?: AbortController;
  streamedItems: Set<string>;
  retiredTurns: Set<string>;
  submissionSettled?: Promise<void>;
  generationUnsubscribe?: () => void;
  dispatching?: boolean;
  cancelRequested?: boolean;
  permissions: Map<string, (allow: boolean) => void>;
}

export class CodexSessionManager {
  private readonly sessions = new Map<string, LiveSession>();
  private readonly service = getCodexService();
  private readonly directory = path.join(
    this.service.homeDir,
    'homecode-harness',
  );
  private readonly subscriptions: Array<() => void> = [];
  private readonly creating = new Set<string>();

  constructor(private readonly registry: WorkspaceRegistry) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    for (const name of readdirSync(this.directory)) {
      if (!name.endsWith('.json')) continue;
      const stored = JSON.parse(
        readFileSync(path.join(this.directory, name), 'utf8'),
      ) as StoredSession;
      if (
        stored.engine !== 'codex' ||
        !stored.sessionId ||
        !Array.isArray(stored.events)
      ) {
        throw new Error(`Invalid Codex session store: ${name}`);
      }
      const session = this.attach(stored);
      if (stored.promptId)
        this.finish(
          session,
          'Previous Codex request was interrupted by a daemon restart.',
          'codex_interrupted',
        );
    }
    this.subscriptions.push(
      this.service.appServer.onNotification((method, params) =>
        this.notification(method, params),
      ),
      this.service.appServer.onRequest((method, params) =>
        this.request(method, params),
      ),
      this.service.appServer.onDisconnect((error) => {
        for (const session of this.sessions.values()) {
          session.loaded = false;
          if (session.stored.promptId)
            this.finish(session, error.message, 'codex_disconnected');
        }
      }),
      this.service.onLogout(async () => {
        await Promise.allSettled(
          [...this.sessions.values()].map(async (session) => {
            await this.cancel(session.stored.sessionId);
            session.loaded = false;
          }),
        );
      }),
    );
  }

  private attach(stored: StoredSession): LiveSession {
    const bus = new EventBus();
    bus.seedReplayEvents(stored.events);
    const session: LiveSession = {
      stored,
      attachments: new SessionAttachmentStore(
        path.join(this.directory, 'attachments'),
        stored.sessionId,
      ),
      bus,
      loaded: false,
      streamedItems: new Set(),
      retiredTurns: new Set(),
      permissions: new Map(),
    };
    this.sessions.set(stored.sessionId, session);
    return session;
  }

  owns(id: string) {
    return this.sessions.has(id.toLowerCase());
  }

  get(id: string): LiveSession {
    const session = this.sessions.get(id.toLowerCase());
    if (!session)
      throw new CodexSessionError(
        'Codex session not found.',
        404,
        'session_not_found',
      );
    return session;
  }

  private persist(session: LiveSession) {
    const file = path.join(this.directory, `${session.stored.sessionId}.json`);
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify(session.stored), { mode: 0o600 });
    renameSync(temporary, file);
  }

  private emit(session: LiveSession, type: string, data: unknown) {
    const event = session.bus.publish({
      type,
      data,
      ...(session.stored.promptId ? { promptId: session.stored.promptId } : {}),
      _meta: { serverTimestamp: Date.now() },
    });
    if (event) session.stored.events.push(event);
    session.stored.updatedAt = new Date().toISOString();
    this.persist(session);
  }

  private update(session: LiveSession, update: Record<string, unknown>) {
    this.emit(session, 'session_update', {
      sessionId: session.stored.sessionId,
      update,
    });
  }

  runtime(session: LiveSession): WorkspaceRuntime {
    const record = session.stored;
    const entry = this.registry.getEntryByWorkspaceId(record.workspaceId);
    if (
      !entry ||
      entry.workspaceCwd !== record.workspaceCwd ||
      entry.state !== 'active' ||
      !entry.current
    ) {
      throw new CodexSessionError(
        'The owning workspace is unavailable.',
        503,
        'workspace_runtime_unavailable',
      );
    }
    const runtime = entry.current.runtime;
    runtime.generationGuard?.assertOpen();
    if (!runtime.trusted)
      throw new CodexSessionError(
        'Workspace trust is required.',
        403,
        'untrusted_workspace',
      );
    return runtime;
  }

  async create(runtime: WorkspaceRuntime, input: Record<string, unknown>) {
    if (!runtime.trusted)
      throw new CodexSessionError(
        'Workspace trust is required.',
        403,
        'untrusted_workspace',
      );
    if (input['worktree'] || input['branch'])
      throw new CodexSessionError(
        'Codex session worktree and branch creation is not available.',
        409,
        'unsupported_engine_action',
      );
    const sessionId =
      typeof input['sessionId'] === 'string'
        ? input['sessionId'].toLowerCase()
        : randomUUID();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        sessionId,
      )
    )
      throw new CodexSessionError('Invalid session ID.');
    if (this.owns(sessionId) || this.creating.has(sessionId))
      throw new CodexSessionError(
        'Session already exists.',
        409,
        'session_conflict',
      );
    this.creating.add(sessionId);
    let tools: CodexTools | undefined;
    try {
      for (const owner of this.registry.listAll()) {
        if (
          await new SessionService(owner.workspaceCwd, {
            runtimeBaseDir: owner.sessionRuntimeBaseDir,
          }).sessionExistsInAnyState(sessionId)
        )
          throw new CodexSessionError(
            'Session ID belongs to Qwen.',
            409,
            'session_conflict',
          );
      }
      const models = await this.service.models();
      const requestedModelId =
        typeof input['modelServiceId'] === 'string'
          ? input['modelServiceId']
          : (models.find((model) => model.isDefault)?.id ?? models[0]?.id);
      const selected = models.find(
        (model) =>
          model.id === requestedModelId || model.model === requestedModelId,
      );
      if (!selected) throw new CodexSessionError('Codex model is unavailable.');
      const modelId = selected.model;
      const effort =
        typeof input['reasoningEffort'] === 'string'
          ? input['reasoningEffort']
          : selected.defaultReasoningEffort;
      if (
        effort &&
        !selected.supportedReasoningEfforts.some(
          (item) => item.reasoningEffort === effort,
        )
      )
        throw new CodexSessionError(
          'Reasoning effort is unavailable for this model.',
        );
      tools = await CodexTools.create(runtime, sessionId);
      runtime.generationGuard?.assertOpen();
      const response = await this.service.appServer.request<{
        thread: { id: string };
      }>('thread/start', {
        model: modelId,
        cwd: runtime.workspaceCwd,
        runtimeWorkspaceRoots: [runtime.workspaceCwd],
        approvalPolicy: 'on-request',
        approvalsReviewer: 'user',
        sandbox: 'workspace-write',
        dynamicTools: tools.declarations,
        config: {
          'orchestrator.mcp.enabled': false,
          'features.apps': false,
          'features.plugins': false,
          'features.multi_agent': false,
          'features.multi_agent_v2': false,
          'agents.enabled': false,
        },
        developerInstructions: harnessInstructions(runtime.workspaceCwd),
        allowProviderModelFallback: false,
      });
      const now = new Date().toISOString();
      const session = this.attach({
        engine: 'codex',
        sessionId,
        threadId: response.thread.id,
        workspaceCwd: runtime.workspaceCwd,
        workspaceId: runtime.workspaceId,
        modelId,
        createdAt: now,
        updatedAt: now,
        displayName: 'Codex',
        events: [],
        artifacts: [],
        ...(effort ? { reasoningEffort: effort } : {}),
        reasoningEfforts: selected.supportedReasoningEfforts.map(
          (item) => item.reasoningEffort,
        ),
        dynamicToolNames: tools.declarations.map((tool) => tool.name),
        ...(typeof input['sourceType'] === 'string'
          ? { sourceType: input['sourceType'] }
          : {}),
        ...(typeof input['sourceId'] === 'string'
          ? { sourceId: input['sourceId'] }
          : {}),
      });
      session.tools = tools;
      session.loaded = true;
      this.persist(session);
      return this.restore(sessionId, false);
    } catch (error) {
      await tools?.dispose();
      throw error;
    } finally {
      this.creating.delete(sessionId);
    }
  }

  summary(session: LiveSession): BridgeSessionSummary {
    const {
      events: _events,
      artifacts: _artifacts,
      threadId: _threadId,
      promptId,
      turnId: _turnId,
      workspaceId: _workspaceId,
      ...metadata
    } = session.stored;
    return {
      ...metadata,
      color: metadata.color as BridgeSessionSummary['color'],
      hasActivePrompt: !!promptId,
      clientCount: 0,
      isWaitingForPermission: session.permissions.size > 0,
      hasTurnError: !!metadata.turnError,
    };
  }

  list(workspaceCwd: string, archiveState: 'active' | 'archived' = 'active') {
    return [...this.sessions.values()]
      .filter(
        (session) =>
          session.stored.workspaceCwd === workspaceCwd &&
          !!session.stored.isArchived === (archiveState === 'archived'),
      )
      .map((session) => this.summary(session));
  }

  restore(id: string, attached = true) {
    const session = this.get(id);
    return {
      ...this.summary(session),
      attached,
      clientId: `codex-${id}`,
      eventEpoch: session.bus.epoch,
      lastEventId: session.stored.events.at(-1)?.id ?? 0,
      state: this.state(id),
      compactedReplay: session.stored.events,
      liveJournal: [],
      historyHasMore: false,
      fullTranscriptAvailable: true,
    };
  }

  state(id: string) {
    const session = this.get(id).stored;
    return {
      models: { currentModelId: session.modelId },
      configOptions: [
        {
          id: 'reasoning_effort',
          type: 'select',
          currentValue: session.reasoningEffort,
          options: (session.reasoningEfforts ?? []).map((value) => ({
            value,
            name: value,
          })),
          _meta: {
            'qwenCode/reasoning': {
              thinkingMandatory: !(session.reasoningEfforts ?? []).includes(
                'none',
              ),
              defaultEffort: session.reasoningEffort,
            },
          },
        },
      ],
    };
  }

  attachments(id: string) {
    const session = this.get(id);
    this.runtime(session);
    return session.attachments;
  }

  async prompt(id: string, prompt: unknown[]) {
    const session = this.get(id);
    const runtime = this.runtime(session);
    if (session.stored.isArchived)
      throw new CodexSessionError(
        'Session is archived.',
        409,
        'session_archived',
      );
    if (session.stored.promptId)
      throw new CodexSessionError(
        'Codex is already responding.',
        409,
        'session_busy',
      );
    session.attachments.assertReferences(prompt);
    for (const part of prompt)
      if (!isSessionAttachmentReference(part)) toCodexInput(part);
    const lastEventId = session.stored.events.at(-1)?.id ?? 0;
    const promptId = randomUUID();
    session.stored.promptId = promptId;
    session.stored.turnError = undefined;
    const abort = new AbortController();
    session.abort = abort;
    session.cancelRequested = false;
    session.streamedItems.clear();
    let submissionSettled!: () => void;
    session.submissionSettled = new Promise<void>((resolve) => {
      submissionSettled = resolve;
    });
    session.generationUnsubscribe = runtime.generationGuard?.onClose?.(() => {
      session.loaded = false;
      void this.cancel(id).catch(() => {});
    });
    this.persist(session);
    try {
      const input = await Promise.all(
        prompt.map(async (part) => {
          if (!isSessionAttachmentReference(part)) return toCodexInput(part);
          const [resolved] = await session.attachments.resolveContent([part]);
          return toCodexInput(
            resolved,
            path.join(
              this.directory,
              'attachments',
              `session-${encodeURIComponent(session.stored.sessionId)}`,
              part.attachmentId,
            ),
          );
        }),
      );
      abort.signal.throwIfAborted();
      await session.tools?.dispose();
      session.tools = await CodexTools.create(runtime, id, abort.signal);
      abort.signal.throwIfAborted();
      if (
        session.stored.dynamicToolNames &&
        session.tools.declarations.some(
          (tool) => !session.stored.dynamicToolNames!.includes(tool.name),
        )
      ) {
        throw new CodexSessionError(
          'В рабочей папке появились новые инструменты. Создайте новый чат Codex, чтобы подключить их.',
          409,
          'codex_tools_changed',
        );
      }
      if (!session.loaded) {
        await this.service.appServer.request('thread/resume', {
          threadId: session.stored.threadId,
          cwd: runtime.workspaceCwd,
          runtimeWorkspaceRoots: [runtime.workspaceCwd],
          model: session.stored.modelId,
          approvalPolicy: 'on-request',
          sandbox: 'workspace-write',
          developerInstructions: harnessInstructions(runtime.workspaceCwd),
        });
        session.loaded = true;
      }
      runtime.generationGuard?.assertOpen();
      abort.signal.throwIfAborted();
      for (const part of prompt)
        this.update(session, {
          sessionUpdate: 'user_message_chunk',
          content: part,
        });
      session.dispatching = true;
      const response = await this.service.appServer.request<{
        turn: { id: string };
      }>('turn/start', {
        threadId: session.stored.threadId,
        clientUserMessageId: promptId,
        input,
        model: session.stored.modelId,
        effort: session.stored.reasoningEffort,
        cwd: runtime.workspaceCwd,
        runtimeWorkspaceRoots: [runtime.workspaceCwd],
      });
      session.dispatching = false;
      if (abort.signal.reason === 'codex_cancelled') {
        session.retiredTurns.add(response.turn.id);
        await this.service.appServer.request('turn/interrupt', {
          threadId: session.stored.threadId,
          turnId: response.turn.id,
        });
        if (session.stored.promptId === promptId)
          this.finish(session, undefined, undefined, true);
      } else if (session.stored.promptId === promptId) {
        session.stored.turnId = response.turn.id;
        this.persist(session);
      }
    } catch (error) {
      session.dispatching = false;
      if (session.stored.promptId === promptId)
        this.finish(
          session,
          abort.signal.reason === 'codex_cancelled'
            ? undefined
            : error instanceof Error
              ? error.message
              : String(error),
          'codex_turn_failed',
          abort.signal.reason === 'codex_cancelled',
        );
      throw error;
    } finally {
      submissionSettled();
    }
    return { promptId, lastEventId, eventEpoch: session.bus.epoch };
  }

  async cancel(id: string) {
    const session = this.get(id);
    const promptId = session.stored.promptId;
    session.cancelRequested = true;
    session.abort?.abort('codex_cancelled');
    for (const respond of session.permissions.values()) respond(false);
    session.permissions.clear();
    if (session.stored.turnId) {
      try {
        await this.service.appServer.request('turn/interrupt', {
          threadId: session.stored.threadId,
          turnId: session.stored.turnId,
        });
      } finally {
        if (session.stored.promptId === promptId)
          this.finish(session, undefined, undefined, true);
      }
    }
  }

  private finish(
    session: LiveSession,
    message?: string,
    code?: string,
    cancelled = false,
  ) {
    if (!session.stored.promptId) return;
    session.generationUnsubscribe?.();
    session.generationUnsubscribe = undefined;
    if (session.stored.turnId) session.retiredTurns.add(session.stored.turnId);
    session.abort?.abort();
    for (const respond of session.permissions.values()) respond(false);
    session.permissions.clear();
    if (message) {
      session.stored.turnError = { message, code: code ?? 'codex_turn_failed' };
      this.emit(session, 'turn_error', {
        promptId: session.stored.promptId,
        ...session.stored.turnError,
      });
    } else
      this.emit(session, 'turn_complete', {
        promptId: session.stored.promptId,
        stopReason: cancelled ? 'cancelled' : 'end_turn',
      });
    session.stored.promptId = undefined;
    session.stored.turnId = undefined;
    this.persist(session);
    void this.service.refresh().catch(() => {});
  }

  private notification(method: string, params: Record<string, unknown>) {
    const session = [...this.sessions.values()].find(
      (item) => item.stored.threadId === params['threadId'],
    );
    if (!session || !session.stored.promptId) return;
    const turnId = isRecord(params['turn'])
      ? params['turn']['id']
      : params['turnId'];
    if (
      typeof turnId === 'string' &&
      (session.retiredTurns.has(turnId) ||
        (session.stored.turnId && session.stored.turnId !== turnId))
    )
      return;
    if (method === 'turn/started' && isRecord(params['turn'])) {
      session.stored.turnId = String(params['turn']['id']);
      this.persist(session);
    }
    if (
      method === 'item/agentMessage/delta' ||
      method === 'item/reasoning/summaryTextDelta' ||
      method === 'item/reasoning/textDelta'
    ) {
      const itemId = String(params['itemId']);
      session.streamedItems.add(itemId);
      this.update(session, {
        sessionUpdate:
          method === 'item/agentMessage/delta'
            ? 'agent_message_chunk'
            : 'agent_thought_chunk',
        content: { type: 'text', text: params['delta'] },
        _meta: { qwenTranscript: { sourceRecordIds: [itemId] } },
      });
    }
    if (method === 'turn/plan/updated')
      this.update(session, {
        sessionUpdate: 'plan',
        entries: Array.isArray(params['plan'])
          ? params['plan'].filter(isRecord).map((entry) => ({
              content: entry['step'],
              status:
                entry['status'] === 'inProgress'
                  ? 'in_progress'
                  : entry['status'],
              priority: 'medium',
            }))
          : [],
      });
    if (
      (method === 'item/started' || method === 'item/completed') &&
      isRecord(params['item'])
    ) {
      const item = params['item'];
      const id = String(item['id']);
      const toolName =
        typeof item['tool'] === 'string'
          ? (session.tools?.schedulerNames.get(item['tool']) ?? item['tool'])
          : item['type'];
      if (
        item['type'] === 'agentMessage' &&
        method === 'item/completed' &&
        !session.streamedItems.has(id)
      )
        this.update(session, {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: item['text'] },
        });
      if (
        [
          'commandExecution',
          'fileChange',
          'webSearch',
          'mcpToolCall',
          'dynamicToolCall',
        ].includes(String(item['type']))
      )
        this.update(session, {
          sessionUpdate:
            method === 'item/started' ? 'tool_call' : 'tool_call_update',
          toolCallId: id,
          toolName,
          title: item['command'] ?? toolName,
          kind: item['type'] === 'commandExecution' ? 'execute' : 'other',
          status:
            method === 'item/started'
              ? 'in_progress'
              : item['status'] === 'failed' || item['status'] === 'declined'
                ? 'failed'
                : 'completed',
          rawInput: item['arguments'] ?? item['changes'],
          rawOutput:
            item['aggregatedOutput'] ?? item['result'] ?? item['contentItems'],
        });
    }
    if (method === 'item/commandExecution/outputDelta')
      this.emit(session, 'shell_output', {
        text: params['delta'],
        toolCallId: params['itemId'],
      });
    if (method === 'turn/completed' && isRecord(params['turn'])) {
      const turn = params['turn'];
      const error = isRecord(turn['error'])
        ? String(turn['error']['message'])
        : undefined;
      this.finish(
        session,
        error,
        error ? 'codex_turn_failed' : undefined,
        turn['status'] === 'interrupted',
      );
    }
    if (method === 'error' && params['willRetry'] !== true)
      this.finish(
        session,
        isRecord(params['error'])
          ? String(params['error']['message'])
          : 'Codex request failed.',
        'codex_turn_failed',
      );
  }

  private ask(
    session: LiveSession,
    title: string,
    toolCallId: string,
  ): Promise<boolean> {
    const requestId = randomUUID();
    return new Promise((resolve) => {
      session.permissions.set(requestId, resolve);
      this.emit(session, 'permission_request', {
        sessionId: session.stored.sessionId,
        requestId,
        toolCall: { toolCallId, title },
        options: [
          { optionId: 'allow', name: 'Разрешить один раз', kind: 'allow_once' },
          { optionId: 'deny', name: 'Отклонить', kind: 'reject_once' },
        ],
      });
    });
  }

  respond(id: string, requestId: string, allow: boolean) {
    const session = this.get(id);
    const respond = session.permissions.get(requestId);
    if (!respond)
      throw new CodexSessionError(
        'Permission request is no longer pending.',
        404,
      );
    session.permissions.delete(requestId);
    this.emit(session, 'permission_resolved', {
      requestId,
      sessionId: id,
      outcome: { outcome: 'selected', optionId: allow ? 'allow' : 'deny' },
    });
    respond(allow);
  }

  private request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> | undefined {
    const session = [...this.sessions.values()].find(
      (item) => item.stored.threadId === params['threadId'],
    );
    if (!session) return undefined;
    const unavailable =
      !session.stored.promptId ||
      session.abort?.signal.aborted ||
      (typeof params['turnId'] === 'string' &&
        (session.retiredTurns.has(params['turnId']) ||
          (session.stored.turnId &&
            session.stored.turnId !== params['turnId'])));
    if (
      method === 'item/commandExecution/requestApproval' ||
      method === 'item/fileChange/requestApproval'
    )
      return unavailable
        ? Promise.resolve({ decision: 'decline' })
        : this.ask(
            session,
            String(
              params['command'] ?? params['reason'] ?? 'Изменение файлов Codex',
            ),
            String(params['itemId']),
          ).then((allow) => ({ decision: allow ? 'accept' : 'decline' }));
    if (method === 'item/tool/call') {
      this.runtime(session);
      const promptId = session.stored.promptId;
      const abort = session.abort;
      if (
        unavailable ||
        !session.tools ||
        !promptId ||
        !abort ||
        !isRecord(params['arguments'])
      )
        return Promise.resolve({
          success: false,
          contentItems: [
            {
              type: 'inputText',
              text: 'Tool request is not available in this session.',
            },
          ],
        });
      const isCurrent = () =>
        this.sessions.get(session.stored.sessionId) === session &&
        session.stored.promptId === promptId &&
        session.abort === abort &&
        !abort.signal.aborted;
      return session.tools.execute(
        String(params['tool']),
        params['arguments'],
        String(params['callId']),
        promptId,
        abort.signal,
        (call) => {
          if (isCurrent()) this.toolUpdate(session, call);
        },
        (call) =>
          isCurrent()
            ? this.ask(
                session,
                call.tool?.displayName ?? call.request.name,
                call.request.callId,
              )
            : Promise.resolve(false),
      );
    }
    return Promise.resolve({ decision: 'decline' });
  }

  private toolUpdate(session: LiveSession, call: ToolCall) {
    const response = 'response' in call ? call.response : undefined;
    this.update(session, {
      sessionUpdate: 'tool_call_update',
      toolCallId: call.request.callId,
      toolName: call.request.name,
      title: call.tool?.displayName ?? call.request.name,
      status:
        call.status === 'success'
          ? 'completed'
          : call.status === 'error' || call.status === 'cancelled'
            ? 'failed'
            : 'in_progress',
      rawInput: call.request.args,
      rawOutput: response?.resultDisplay,
    });
    if (response?.artifacts?.length) {
      for (const input of response.artifacts) {
        const id = stableSessionArtifactId(
          session.stored.sessionId,
          sessionArtifactIdentityKey(input) ?? input.title,
        );
        const index = session.stored.artifacts.findIndex(
          (item) => item.id === id,
        );
        const previous = session.stored.artifacts[index];
        const now = new Date().toISOString();
        const artifact: DaemonSessionArtifact = {
          ...input,
          id,
          kind:
            input.kind ??
            (input.workspacePath ? 'file' : input.url ? 'link' : 'other'),
          storage:
            input.storage ??
            (input.workspacePath
              ? 'workspace'
              : input.url
                ? 'external_url'
                : 'managed'),
          source: 'tool',
          status: 'available',
          retention: 'restorable',
          clientRetained: false,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
          persistedAt: now,
          toolCallId: call.request.callId,
          toolName: call.request.name,
        };
        if (index >= 0) session.stored.artifacts[index] = artifact;
        else session.stored.artifacts.push(artifact);
        this.emit(session, 'artifact_changed', {
          sessionId: session.stored.sessionId,
          change: {
            action: previous ? 'updated' : 'created',
            artifactId: id,
            artifact,
          },
        });
      }
      this.persist(session);
    }
  }

  async metadata(id: string, body: Record<string, unknown>) {
    const session = this.get(id);
    if (body['displayName'] !== undefined) {
      if (
        typeof body['displayName'] !== 'string' ||
        !body['displayName'].trim() ||
        // eslint-disable-next-line no-control-regex
        /[\x00-\x1f\x7f]/.test(body['displayName'])
      )
        throw new CodexSessionError('Invalid session name.');
      session.stored.displayName = body['displayName'].trim().slice(0, 256);
    }
    if (typeof body['isPinned'] === 'boolean') {
      session.stored.isPinned = body['isPinned'];
      session.stored.pinnedAt = body['isPinned']
        ? new Date().toISOString()
        : undefined;
    }
    if (typeof body['pinned'] === 'boolean') {
      session.stored.isPinned = body['pinned'];
      session.stored.pinnedAt = body['pinned']
        ? new Date().toISOString()
        : undefined;
    }
    if (body['groupId'] === null || typeof body['groupId'] === 'string')
      session.stored.groupId = body['groupId'];
    if (body['color'] === null || typeof body['color'] === 'string')
      session.stored.color = body['color'];
    this.emit(session, 'session_metadata_updated', this.summary(session));
    return this.summary(session);
  }

  async setModel(id: string, modelId: string, effort?: string) {
    const session = this.get(id);
    this.runtime(session);
    if (session.stored.promptId)
      throw new CodexSessionError(
        'Wait for the current Codex response before changing its model.',
        409,
        'session_busy',
      );
    const models = await this.service.models();
    if (session.stored.promptId)
      throw new CodexSessionError(
        'Wait for the current Codex response before changing its model.',
        409,
        'session_busy',
      );
    const model = models.find(
      (item) => item.id === modelId || item.model === modelId,
    );
    if (!model) throw new CodexSessionError('Codex model is unavailable.');
    if (
      effort &&
      !model.supportedReasoningEfforts.some(
        (item) => item.reasoningEffort === effort,
      )
    )
      throw new CodexSessionError(
        'Reasoning effort is unavailable for this model.',
      );
    session.stored.modelId = model.model;
    session.stored.reasoningEffort = effort ?? model.defaultReasoningEffort;
    session.stored.reasoningEfforts = model.supportedReasoningEfforts.map(
      (item) => item.reasoningEffort,
    );
    this.emit(session, 'model_switched', { modelId: model.model });
    return { modelId: model.model, applied: true };
  }

  async archive(id: string, archived: boolean) {
    const session = this.get(id);
    if (session.stored.promptId) await this.cancel(id);
    session.stored.isArchived = archived;
    this.persist(session);
  }

  async delete(id: string) {
    const session = this.get(id);
    await this.cancel(id);
    await session.submissionSettled;
    await this.service.appServer.request('thread/delete', {
      threadId: session.stored.threadId,
    });
    await session.tools?.dispose();
    session.bus.close();
    await session.attachments.delete();
    unlinkSync(path.join(this.directory, `${session.stored.sessionId}.json`));
    this.sessions.delete(session.stored.sessionId);
  }

  async close(id: string) {
    const session = this.get(id);
    await this.cancel(id);
    await session.submissionSettled;
    await session.tools?.dispose();
    await session.attachments.close();
    session.bus.close();
    this.attach(session.stored);
  }

  async dispose() {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    await Promise.allSettled(
      [...this.sessions.values()].map(async (session) => {
        await this.cancel(session.stored.sessionId);
        await session.submissionSettled;
        await session.tools?.dispose();
        await session.attachments.close();
        session.bus.close();
      }),
    );
  }
}
