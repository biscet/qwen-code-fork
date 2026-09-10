import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolCall } from '@qwen-code/qwen-code-core';
import type { CodexTools } from './codex-tools.js';
import type {
  WorkspaceRegistry,
  WorkspaceRuntime,
} from '../workspace-registry.js';

const mock = vi.hoisted(() => ({
  homeDir: '',
  outputLanguage: 'Russian',
  request: vi.fn(),
  execute: vi.fn<CodexTools['execute']>(),
  notify: undefined as
    | ((method: string, params: Record<string, unknown>) => void)
    | undefined,
  disconnect: undefined as ((error: Error) => void) | undefined,
  toolRequest: undefined as
    | ((method: string, params: Record<string, unknown>) => unknown)
    | undefined,
}));
vi.mock('../../config/settings.js', () => ({
  loadSettings: vi.fn(() => ({
    merged: { general: { outputLanguage: mock.outputLanguage } },
  })),
}));
vi.mock('./codex-service.js', () => ({
  getCodexService: () => ({
    homeDir: mock.homeDir,
    models: async () => [
      {
        id: 'test-codex',
        model: 'test-codex',
        isDefault: true,
        defaultReasoningEffort: 'high',
        supportedReasoningEfforts: [{ reasoningEffort: 'high' }],
      },
    ],
    refresh: async () => ({}),
    onLogout: () => () => {},
    appServer: {
      request: mock.request,
      onNotification: (listener: typeof mock.notify) => {
        mock.notify = listener;
        return () => {};
      },
      onDisconnect: (listener: typeof mock.disconnect) => {
        mock.disconnect = listener;
        return () => {};
      },
      onRequest: (listener: typeof mock.toolRequest) => {
        mock.toolRequest = listener;
        return () => {};
      },
    },
  }),
}));
vi.mock('./codex-tools.js', () => ({
  CodexTools: {
    create: async () => ({
      execute: mock.execute,
      schedulerNames: new Map([
        [
          'homecode_mcp__serena__find_declaration',
          'mcp__serena__find_declaration',
        ],
      ]),
      declarations: [
        { type: 'function', name: 'report_findings', inputSchema: {} },
      ],
      dispose: async () => {},
    }),
  },
}));

import { CodexSessionManager } from './codex-session-manager.js';
import { createWorkspaceGenerationGuard } from '../workspace-registry.js';
import { loadSettings } from '../../config/settings.js';

describe('Codex Harness session ownership and persistence', () => {
  let manager: CodexSessionManager;
  let runtime: WorkspaceRuntime;
  let registry: WorkspaceRegistry;
  beforeEach(() => {
    mock.homeDir = mkdtempSync(path.join(os.tmpdir(), 'homecode-codex-test-'));
    mock.request.mockReset();
    mock.outputLanguage = 'Russian';
    mock.execute
      .mockReset()
      .mockResolvedValue({ success: true, contentItems: [] });
    mock.request.mockImplementation(async (method: string) => {
      if (method === 'thread/start') return { thread: { id: 'codex-thread' } };
      if (method === 'turn/start') return { turn: { id: 'codex-turn' } };
      return {};
    });
    runtime = {
      workspaceId: 'workspace-a',
      workspaceCwd: '/workspace/a',
      trusted: true,
      generationGuard: { closed: false, assertOpen() {}, close() {} },
    } as WorkspaceRuntime;
    registry = {
      listAll: () => [],
      getEntryByWorkspaceId: () => ({
        state: 'active',
        workspaceCwd: runtime.workspaceCwd,
        current: { runtime },
      }),
    } as unknown as WorkspaceRegistry;
    manager = new CodexSessionManager(registry);
  });
  afterEach(async () => {
    await manager.dispose();
    rmSync(mock.homeDir, { recursive: true, force: true });
  });

  it('persists engine, model, complete history and organization without starting Qwen', async () => {
    const created = await manager.create(runtime, {
      modelServiceId: 'test-codex',
    });
    expect(loadSettings).toHaveBeenCalledWith(runtime.workspaceCwd, {
      skipLoadEnvironment: true,
      workspaceTrusted: true,
    });
    expect(mock.request).toHaveBeenCalledWith(
      'thread/start',
      expect.objectContaining({
        developerInstructions: expect.stringContaining(
          'You MUST always respond in **Russian**',
        ),
      }),
    );
    for (const instruction of [
      'connected tool inventory',
      'Chrome DevTools (--slim)',
      'localhost refers to this Mac',
      "Serena's active project matches",
      'requires LOCAL_QWEN_API_KEY',
    ]) {
      expect(mock.request).toHaveBeenCalledWith(
        'thread/start',
        expect.objectContaining({
          developerInstructions: expect.stringContaining(instruction),
        }),
      );
    }
    const admitted = await manager.prompt(created.sessionId, [
      { type: 'text', text: 'Hello' },
    ]);
    mock.notify?.('item/agentMessage/delta', {
      threadId: 'codex-thread',
      itemId: 'answer',
      delta: 'Hello back',
    });
    mock.notify?.('item/completed', {
      threadId: 'codex-thread',
      item: { type: 'agentMessage', id: 'answer', text: 'Hello back' },
    });
    mock.notify?.('turn/completed', {
      threadId: 'codex-thread',
      turn: { id: 'codex-turn', status: 'completed', error: null },
    });
    await manager.metadata(created.sessionId, {
      displayName: 'Saved task',
      pinned: true,
    });
    await manager.archive(created.sessionId, true);
    await manager.dispose();
    manager = new CodexSessionManager(registry);
    const restored = manager.restore(created.sessionId);
    expect(restored).toMatchObject({
      engine: 'codex',
      modelId: 'test-codex',
      displayName: 'Saved task',
      isPinned: true,
      isArchived: true,
      hasActivePrompt: false,
    });
    expect(
      restored.compactedReplay.filter((event) =>
        JSON.stringify(event).includes('Hello back'),
      ),
    ).toHaveLength(1);
    expect(
      restored.compactedReplay.some(
        (event) =>
          event.type === 'turn_complete' &&
          event.promptId === admitted.promptId,
      ),
    ).toBe(true);
    expect(
      mock.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });

  it('accepts text file attachments together with image and text prompts', async () => {
    const created = await manager.create(runtime, {});
    const attachment = {
      type: 'resource',
      resource: {
        uri: 'attachment:///notes.txt',
        mimeType: 'text/plain',
        text: 'Attached note content',
      },
    };
    await manager.prompt(created.sessionId, [
      { type: 'text', text: 'Read this\n\n@attachment:///notes.txt' },
      { type: 'image', data: 'aW1hZ2U=', mimeType: 'image/png' },
      attachment,
    ]);

    const turn = mock.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    )?.[1];
    expect(turn).toMatchObject({
      cwd: '/workspace/a',
      runtimeWorkspaceRoots: ['/workspace/a'],
      input: [
        {
          type: 'text',
          text: 'Read this\n\n@attachment:///notes.txt',
          text_elements: [],
        },
        { type: 'image', url: 'data:image/png;base64,aW1hZ2U=' },
        {
          type: 'text',
          text: expect.stringContaining('Attached note content'),
          text_elements: [],
        },
      ],
    });
    expect(turn.input[2].text).toContain('attachment:///notes.txt');
    expect(manager.restore(created.sessionId).compactedReplay).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            update: expect.objectContaining({
              sessionUpdate: 'user_message_chunk',
              content: attachment,
            }),
          }),
        }),
      ]),
    );
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    [
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['bundle.zip', 'application/zip'],
  ])('gives Codex a readable durable path for %s', async (name, mimeType) => {
    const created = await manager.create(runtime, {});
    const data = Buffer.from([0x50, 0x4b, 0, 0xff, 0x42]);
    const reference = await manager
      .attachments(created.sessionId)
      .putAttachment(data, mimeType, name);
    await manager.prompt(created.sessionId, [reference]);

    const turn = mock.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    )?.[1];
    expect(turn.input).toHaveLength(1);
    expect(turn.input[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Attached file: '),
    });
    const filePath = turn.input[0].text.slice('Attached file: '.length);
    expect(path.isAbsolute(filePath)).toBe(true);
    expect(path.basename(filePath)).toBe(name);
    expect(readFileSync(filePath)).toEqual(data);
    await manager.dispose();
    expect(readFileSync(filePath)).toEqual(data);
  });

  it('rejects a binary file resource before submitting a turn', async () => {
    const created = await manager.create(runtime, {});
    await expect(
      manager.prompt(created.sessionId, [
        {
          type: 'resource',
          resource: {
            uri: 'attachment:///archive.zip',
            mimeType: 'application/zip',
            blob: 'YmluYXJ5',
          },
        },
      ]),
    ).rejects.toMatchObject({ code: 'unsupported_input' });
    expect(
      mock.request.mock.calls.some(([method]) => method === 'turn/start'),
    ).toBe(false);
    expect(manager.restore(created.sessionId).hasActivePrompt).toBe(false);
  });

  it('keeps an accepted turn interrupted on process loss and never resubmits it on restore', async () => {
    const created = await manager.create(runtime, {});
    await manager.prompt(created.sessionId, [{ type: 'text', text: 'Work' }]);
    mock.disconnect?.(new Error('stdio closed'));
    const restored = manager.restore(created.sessionId);
    expect(restored).toMatchObject({
      engine: 'codex',
      hasTurnError: true,
      hasActivePrompt: false,
    });
    expect(
      mock.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
    mock.outputLanguage = 'English';
    await manager.prompt(created.sessionId, [
      { type: 'text', text: 'Continue' },
    ]);
    expect(
      mock.request.mock.calls.filter(([method]) => method === 'thread/resume'),
    ).toHaveLength(1);
    expect(mock.request).toHaveBeenCalledWith(
      'thread/resume',
      expect.objectContaining({
        developerInstructions: expect.stringContaining(
          'You MUST always respond in **English**',
        ),
      }),
    );
    expect(mock.request).toHaveBeenCalledWith(
      'thread/resume',
      expect.objectContaining({
        developerInstructions: expect.stringContaining(
          '## Workspace MCPs and agents',
        ),
      }),
    );
  });

  it('rejects unavailable owner before sending any new turn', async () => {
    const created = await manager.create(runtime, {});
    registry.getEntryByWorkspaceId = () => undefined;
    await expect(
      manager.prompt(created.sessionId, [{ type: 'text', text: 'Read file' }]),
    ).rejects.toMatchObject({ code: 'workspace_runtime_unavailable' });
    expect(
      mock.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(0);
    expect(manager.restore(created.sessionId).engine).toBe('codex');
  });

  it('routes Codex approval through the session permission owner', async () => {
    const created = await manager.create(runtime, {});
    await manager.prompt(created.sessionId, [
      { type: 'text', text: 'Run command' },
    ]);
    const pending = mock.toolRequest?.(
      'item/commandExecution/requestApproval',
      { threadId: 'codex-thread', itemId: 'command', command: 'git status' },
    );
    const event = manager.restore(created.sessionId).compactedReplay.at(-1)!;
    const requestId = (event.data as { requestId: string }).requestId;
    manager.respond(created.sessionId, requestId, true);
    await expect(pending).resolves.toEqual({ decision: 'accept' });
    expect(() => manager.respond(created.sessionId, requestId, true)).toThrow(
      'no longer pending',
    );
  });

  it.each(['commandExecution', 'fileChange'])(
    'projects a declined native %s as a failed tool card',
    async (type) => {
      const created = await manager.create(runtime, {});
      await manager.prompt(created.sessionId, [
        { type: 'text', text: 'Request permission' },
      ]);
      mock.notify?.('item/completed', {
        threadId: 'codex-thread',
        turnId: 'codex-turn',
        item: {
          id: 'declined-tool',
          type,
          status: 'declined',
          aggregatedOutput: null,
          exitCode: null,
        },
      });
      expect(
        manager.restore(created.sessionId).compactedReplay.at(-1)?.data,
      ).toMatchObject({
        update: { toolCallId: 'declined-tool', status: 'failed' },
      });
    },
  );

  it('reserves a session ID and prompt before asynchronous work', async () => {
    const id = '00000000-0000-4000-8000-000000000002';
    const first = manager.create(runtime, { sessionId: id });
    await expect(
      manager.create(runtime, { sessionId: id }),
    ).rejects.toMatchObject({ code: 'session_conflict' });
    await first;
    const prompt = manager.prompt(id, [{ type: 'text', text: 'First' }]);
    await expect(
      manager.prompt(id, [{ type: 'text', text: 'Second' }]),
    ).rejects.toMatchObject({ code: 'session_busy' });
    await prompt;
    expect(
      mock.request.mock.calls.filter(([method]) => method === 'turn/start'),
    ).toHaveLength(1);
  });

  it('interrupts the accepted turn when cancellation precedes its response', async () => {
    const created = await manager.create(runtime, {});
    let resolveTurn: ((value: unknown) => void) | undefined;
    mock.request.mockImplementation(async (method: string) => {
      if (method === 'turn/start')
        return new Promise((resolve) => {
          resolveTurn = resolve;
        });
      return {};
    });
    const pending = manager.prompt(created.sessionId, [
      { type: 'text', text: 'Start' },
    ]);
    await vi.waitFor(() => expect(resolveTurn).toBeDefined());
    await manager.cancel(created.sessionId);
    await expect(
      manager.prompt(created.sessionId, [{ type: 'text', text: 'New' }]),
    ).rejects.toMatchObject({ code: 'session_busy' });
    resolveTurn?.({ turn: { id: 'late-turn' } });
    await pending;
    expect(mock.request).toHaveBeenCalledWith('turn/interrupt', {
      threadId: 'codex-thread',
      turnId: 'late-turn',
    });
    expect(manager.restore(created.sessionId).hasActivePrompt).toBe(false);
  });
  it('ignores late events and approvals from an interrupted turn', async () => {
    const created = await manager.create(runtime, {});
    await manager.prompt(created.sessionId, [{ type: 'text', text: 'First' }]);
    await expect(
      manager.setModel(created.sessionId, 'test-codex'),
    ).rejects.toMatchObject({ code: 'session_busy' });
    await manager.cancel(created.sessionId);
    mock.request.mockImplementation(async (method: string) =>
      method === 'turn/start' ? { turn: { id: 'second-turn' } } : {},
    );
    await manager.prompt(created.sessionId, [{ type: 'text', text: 'Second' }]);
    mock.notify?.('item/agentMessage/delta', {
      threadId: 'codex-thread',
      turnId: 'codex-turn',
      itemId: 'late-answer',
      delta: 'Stale answer',
    });
    mock.notify?.('turn/completed', {
      threadId: 'codex-thread',
      turn: { id: 'codex-turn', status: 'interrupted' },
    });
    expect(
      await mock.toolRequest?.('item/commandExecution/requestApproval', {
        threadId: 'codex-thread',
        turnId: 'codex-turn',
        itemId: 'late-command',
        command: 'touch stale',
      }),
    ).toEqual({ decision: 'decline' });
    expect(manager.restore(created.sessionId).hasActivePrompt).toBe(true);
    expect(
      JSON.stringify(manager.restore(created.sessionId).compactedReplay),
    ).not.toContain('Stale answer');
  });

  it('closes live resources while preserving history, and deletes native history before the projection', async () => {
    const created = await manager.create(runtime, {});
    await manager.close(created.sessionId);
    expect(manager.restore(created.sessionId).engine).toBe('codex');
    mock.request.mockRejectedValueOnce(new Error('native deletion failed'));
    await expect(manager.delete(created.sessionId)).rejects.toThrow(
      'native deletion failed',
    );
    expect(manager.owns(created.sessionId)).toBe(true);
    await manager.delete(created.sessionId);
    expect(mock.request).toHaveBeenLastCalledWith('thread/delete', {
      threadId: 'codex-thread',
    });
    expect(manager.owns(created.sessionId)).toBe(false);
  });
  it('interrupts an active Codex turn when its workspace generation closes', async () => {
    const guard = createWorkspaceGenerationGuard();
    runtime = { ...runtime, generationGuard: guard };
    const created = await manager.create(runtime, {});
    await manager.prompt(created.sessionId, [
      { type: 'text', text: 'Start work' },
    ]);
    guard.close();
    await vi.waitFor(() =>
      expect(manager.restore(created.sessionId).hasActivePrompt).toBe(false),
    );
    expect(mock.request).toHaveBeenLastCalledWith('turn/interrupt', {
      threadId: 'codex-thread',
      turnId: 'codex-turn',
    });
    await expect(
      manager.prompt(created.sessionId, [
        { type: 'text', text: 'After closure' },
      ]),
    ).rejects.toMatchObject({ code: 'workspace_generation_closed' });
  });
  it('keeps original MCP tool names in native completion cards', async () => {
    const created = await manager.create(runtime, {});
    await manager.prompt(created.sessionId, [
      { type: 'text', text: 'Find declaration' },
    ]);
    mock.notify?.('item/completed', {
      threadId: 'codex-thread',
      turnId: 'codex-turn',
      item: {
        id: 'mcp-card',
        type: 'dynamicToolCall',
        tool: 'homecode_mcp__serena__find_declaration',
        status: 'completed',
      },
    });
    expect(
      manager.restore(created.sessionId).compactedReplay.at(-1)?.data,
    ).toMatchObject({
      update: {
        toolCallId: 'mcp-card',
        toolName: 'mcp__serena__find_declaration',
        title: 'mcp__serena__find_declaration',
        status: 'completed',
      },
    });
  });
  it.each(['cancel', 'close', 'delete'] as const)(
    'drops stale tool updates, artifacts and permission callbacks after %s',
    async (action) => {
      const created = await manager.create(runtime, {});
      const first = await manager.prompt(created.sessionId, [
        { type: 'text', text: 'First' },
      ]);
      await mock.toolRequest?.('item/tool/call', {
        threadId: 'codex-thread',
        turnId: 'codex-turn',
        tool: 'report_findings',
        arguments: {},
        callId: 'late-call',
      });
      const [, , , , , onUpdate, ask] = mock.execute.mock.calls[0]!;
      await manager[action](created.sessionId);
      if (action !== 'delete')
        await manager.prompt(created.sessionId, [
          { type: 'text', text: 'Next' },
        ]);
      const previousEvents =
        action === 'delete'
          ? []
          : manager.restore(created.sessionId).compactedReplay.slice();
      const lateCall: ToolCall = {
        status: 'error',
        request: {
          name: 'report_findings',
          args: {},
          callId: 'late-call',
          prompt_id: first.promptId,
          isClientInitiated: false,
        },
        response: {
          callId: 'late-call',
          responseParts: [],
          resultDisplay: 'Late result',
          error: undefined,
          errorType: undefined,
          artifacts: [
            { title: 'Late artifact', url: 'https://example.com/late' },
          ],
        },
      };
      onUpdate(lateCall);
      await expect(ask(lateCall)).resolves.toBe(false);
      if (action === 'delete')
        expect(manager.owns(created.sessionId)).toBe(false);
      else {
        expect(manager.restore(created.sessionId).compactedReplay).toEqual(
          previousEvents,
        );
        expect(manager.get(created.sessionId).stored.artifacts).toEqual([]);
        expect(manager.get(created.sessionId).permissions.size).toBe(0);
      }
    },
  );
});
