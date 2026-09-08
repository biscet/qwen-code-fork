import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Part } from '@google/genai';
import { DiscoveredMCPTool, ToolRegistry } from '@qwen-code/qwen-code-core';
import { expect, it, vi } from 'vitest';
import type {
  WorkspaceRegistry,
  WorkspaceRuntime,
} from '../workspace-registry.js';

const mock = vi.hoisted(() => ({
  homeDir: '',
  request: vi.fn(),
  toolRequest: undefined as
    | ((method: string, params: Record<string, unknown>) => unknown)
    | undefined,
}));
vi.mock('./codex-service.js', () => ({
  getCodexService: () => ({
    homeDir: mock.homeDir,
    models: async () => [
      {
        id: 'test',
        model: 'test',
        isDefault: true,
        defaultReasoningEffort: 'high',
        supportedReasoningEfforts: [{ reasoningEffort: 'high' }],
      },
    ],
    refresh: async () => ({}),
    onLogout: () => () => {},
    appServer: {
      request: mock.request,
      onNotification: () => () => {},
      onDisconnect: () => () => {},
      onRequest: (listener: typeof mock.toolRequest) => {
        mock.toolRequest = listener;
        return () => {};
      },
    },
  }),
}));
vi.mock('../../config/settings.js', () => ({
  loadSettings: () => ({ merged: {} }),
}));
vi.mock('../../config/mcpServers.js', () => ({
  assembleMcpServers: () => ({}),
}));
vi.mock('../../config/mcpApprovals.js', () => ({
  getPendingGatedMcpServers: () => [],
}));
import { CodexSessionManager } from './codex-session-manager.js';

it('does not append late scheduler completion from a cancelled MCP call to the next prompt', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'codex-late-tools-'));
  mock.homeDir = root;
  let turn = 0;
  mock.request.mockImplementation(async (method: string) =>
    method === 'thread/start'
      ? { thread: { id: 'thread' } }
      : method === 'turn/start'
        ? { turn: { id: `turn-${++turn}` } }
        : {},
  );
  let resolveTool!: (parts: Part[]) => void;
  const callTool = vi.fn(
    () =>
      new Promise<Part[]>((resolve) => {
        resolveTool = resolve;
      }),
  );
  const tool = new DiscoveredMCPTool(
    { tool: async () => ({ functionDeclarations: [] }), callTool },
    'fixture',
    'slow',
    'A delayed MCP test response.',
    { type: 'object', properties: {} },
  );
  vi.spyOn(ToolRegistry.prototype, 'discoverMcpTools').mockImplementation(
    async function (this: ToolRegistry) {
      this.registerTool(tool);
    },
  );
  const runtime = {
    workspaceId: 'workspace',
    workspaceCwd: root,
    sessionRuntimeBaseDir: path.join(root, 'runtime'),
    trusted: true,
    env: { effectiveEnv: {} },
  } as unknown as WorkspaceRuntime;
  const registry = {
    listAll: () => [],
    getEntryByWorkspaceId: () => ({
      state: 'active',
      workspaceCwd: root,
      current: { runtime },
    }),
  } as unknown as WorkspaceRegistry;
  const manager = new CodexSessionManager(registry);
  try {
    const created = await manager.create(runtime, {});
    const first = await manager.prompt(created.sessionId, [
      { type: 'text', text: 'First request' },
    ]);
    const pending = mock.toolRequest?.('item/tool/call', {
      threadId: 'thread',
      turnId: 'turn-1',
      tool: 'homecode_mcp__fixture__slow',
      arguments: {},
      callId: 'old-call',
    });
    await vi.waitFor(() =>
      expect(manager.get(created.sessionId).permissions.size).toBe(1),
    );
    const requestId = [
      ...manager.get(created.sessionId).permissions.keys(),
    ][0]!;
    manager.respond(created.sessionId, requestId, true);
    await vi.waitFor(() => expect(callTool).toHaveBeenCalledOnce());
    await manager.cancel(created.sessionId);
    const snapshot = manager.restore(created.sessionId).compactedReplay.slice();
    const secondPending = manager.prompt(created.sessionId, [
      { type: 'text', text: 'Second request' },
    ]);
    resolveTool([
      {
        functionResponse: {
          name: 'slow',
          response: { content: [{ type: 'text', text: 'Late MCP result' }] },
        },
      },
    ]);
    await pending;
    const second = await secondPending;
    const events = manager.restore(created.sessionId).compactedReplay;
    expect(first.promptId).not.toBe(second.promptId);
    expect(
      events.filter((event) => JSON.stringify(event).includes('old-call')),
    ).toEqual(
      snapshot.filter((event) => JSON.stringify(event).includes('old-call')),
    );
    expect(manager.restore(created.sessionId).hasActivePrompt).toBe(true);
    expect(
      events
        .filter((event) => event.promptId === second.promptId)
        .map((event) => JSON.stringify(event))
        .join(''),
    ).not.toContain('old-call');
  } finally {
    await manager.dispose();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  }
});
