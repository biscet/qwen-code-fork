import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MCPServerConfig } from '@qwen-code/qwen-code-core';
import { loadSettings } from '../config/settings.js';
import {
  getPendingGatedMcpServers,
  loadMcpApprovals,
  resetMcpApprovalsForTesting,
} from '../config/mcpApprovals.js';
import { initializeDesktopWorkspaceDefaults } from './desktop-workspace-defaults.js';
import { HomeChatStateStore } from './routes/homechat-state.js';

describe('desktop workspace MCP initialization', () => {
  let root: string;
  let runtimeRoot: string;
  let workspace: string;
  let qwenHome: string;
  const template: MCPServerConfig = {
    command: '${HOMECODE_MCP_NODE}',
    args: ['${HOMECODE_MCP_LAUNCHER}', 'node-repl'],
  };

  const writeServers = (
    servers: Record<string, MCPServerConfig>,
    directory = workspace,
  ) => {
    mkdirSync(path.join(directory, '.qwen'), { recursive: true });
    writeFileSync(
      path.join(directory, '.qwen', 'settings.json'),
      JSON.stringify({ mcpServers: servers }),
    );
  };
  const resolvedServers = (directory = workspace) =>
    loadSettings(directory, {
      skipLoadEnvironment: true,
      workspaceTrusted: true,
    }).merged.mcpServers!;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'desktop-workspace-defaults-'));
    runtimeRoot = path.join(root, 'App With Spaces');
    workspace = path.join(root, 'project-a');
    qwenHome = path.join(root, 'profile');
    for (const directory of ['lib', 'mcp']) {
      mkdirSync(path.join(runtimeRoot, directory), { recursive: true });
    }
    mkdirSync(qwenHome);
    writeFileSync(path.join(runtimeRoot, 'package.json'), '{"type":"module"}');
    writeFileSync(path.join(runtimeRoot, 'mcp', 'launch.mjs'), '');
    writeFileSync(
      path.join(runtimeRoot, 'managed.json'),
      JSON.stringify({ 'node-repl': template }),
    );
    writeFileSync(
      path.join(runtimeRoot, 'lib', 'desktop-defaults.js'),
      `import fs from 'node:fs';
import path from 'node:path';
export function installDesktopWorkspaceDefaults(options) {
  fs.writeFileSync(path.join(options.runtimeRoot, 'called.json'), JSON.stringify(options));
  return JSON.parse(fs.readFileSync(path.join(options.runtimeRoot, 'managed.json'), 'utf8'));
}`,
    );
    vi.stubEnv('QWEN_HOME', qwenHome);
    vi.stubEnv('QWEN_CODE_DESKTOP', '1');
    vi.stubEnv('QWEN_CODE_DESKTOP_RUNTIME_ROOT', runtimeRoot);
    vi.stubEnv('HOMECODE_MCP_NODE', process.execPath);
    vi.stubEnv(
      'HOMECODE_MCP_LAUNCHER',
      path.join(runtimeRoot, 'mcp', 'launch.mjs'),
    );
    vi.stubEnv(
      'QWEN_CODE_SYSTEM_SETTINGS_PATH',
      path.join(root, 'system.json'),
    );
    vi.stubEnv(
      'QWEN_CODE_SYSTEM_DEFAULTS_PATH',
      path.join(root, 'defaults.json'),
    );
    vi.stubEnv(
      'QWEN_CODE_MCP_APPROVALS_PATH',
      path.join(qwenHome, 'mcpApprovals.json'),
    );
    resetMcpApprovalsForTesting();
    writeServers({ 'node-repl': template });
  });

  afterEach(() => {
    resetMcpApprovalsForTesting();
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it('approves only exact installer-owned definitions using resolved runtime paths', async () => {
    writeServers({ 'node-repl': template, custom: { command: 'custom-mcp' } });
    await initializeDesktopWorkspaceDefaults(workspace, true);
    const servers = resolvedServers();
    expect(servers['node-repl'].command).toBe(process.execPath);
    expect(getPendingGatedMcpServers(servers, workspace)).toEqual(['custom']);
    expect(
      JSON.parse(readFileSync(path.join(runtimeRoot, 'called.json'), 'utf8')),
    ).toEqual({ runtimeRoot, qwenHome, workspaceDir: workspace });
    expect(loadMcpApprovals().getState(workspace, 'node-repl', template)).toBe(
      'pending',
    );
  });

  it('uses the home env fallback for an owned authenticated server', async () => {
    const research = {
      httpUrl: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer ${DESKTOP_TEST_MCP_KEY}' },
    };
    writeFileSync(
      path.join(qwenHome, '.env'),
      'DESKTOP_TEST_MCP_KEY=test-fixture',
    );
    writeFileSync(
      path.join(runtimeRoot, 'managed.json'),
      JSON.stringify({ research }),
    );
    writeServers({ research });
    await initializeDesktopWorkspaceDefaults(workspace, true);
    const servers = resolvedServers();
    expect(servers['research'].headers?.['Authorization']).toBe(
      'Bearer test-fixture',
    );
    expect(getPendingGatedMcpServers(servers, workspace)).toEqual([]);
  });

  it.each(['untrusted', 'cli', 'legacy-runtime'])(
    'does not install for %s',
    async (mode) => {
      if (mode === 'cli') vi.stubEnv('QWEN_CODE_DESKTOP', undefined);
      if (mode === 'legacy-runtime')
        rmSync(path.join(runtimeRoot, 'mcp', 'launch.mjs'));
      await initializeDesktopWorkspaceDefaults(workspace, mode !== 'untrusted');
      expect(() =>
        readFileSync(path.join(runtimeRoot, 'called.json')),
      ).toThrow();
      expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
        'node-repl',
      ]);
    },
  );

  it('keeps independent approvals for two workspaces and retries idempotently', async () => {
    const other = path.join(root, 'project-b');
    writeServers({ 'node-repl': template }, other);
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(getPendingGatedMcpServers(resolvedServers(other), other)).toEqual([
      'node-repl',
    ]);
    await initializeDesktopWorkspaceDefaults(other, true);
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(getPendingGatedMcpServers(resolvedServers(other), other)).toEqual(
      [],
    );
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([]);
  });

  it('refreshes managed research approval after Vane key rotation without undoing another workspace rejection', async () => {
    const other = path.join(root, 'project-b');
    const research: MCPServerConfig = {
      httpUrl: 'https://biscet-server.local:9454/research/mcp',
      headers: { Authorization: 'Bearer ${LOCAL_QWEN_API_KEY}' },
    };
    vi.stubEnv('LOCAL_QWEN_API_KEY', 'previous-research-test-key');
    writeFileSync(
      path.join(runtimeRoot, 'managed.json'),
      JSON.stringify({ 'home-ai-research': research }),
    );
    for (const directory of [workspace, other]) {
      writeServers({ 'home-ai-research': research }, directory);
      await initializeDesktopWorkspaceDefaults(directory, true);
      expect(
        getPendingGatedMcpServers(resolvedServers(directory), directory),
      ).toEqual([]);
    }
    await loadMcpApprovals().setState(
      other,
      'home-ai-research',
      resolvedServers(other)['home-ai-research'],
      'rejected',
    );
    new HomeChatStateStore(path.join(qwenHome, 'homechat')).update((state) => {
      state.backendApiKey = 'rotated-research-test-key';
    });
    expect(
      resolvedServers()['home-ai-research'].headers?.['Authorization'],
    ).toBe('Bearer rotated-research-test-key');
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
      'home-ai-research',
    ]);

    for (const directory of [workspace, other]) {
      await initializeDesktopWorkspaceDefaults(directory, true);
    }
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([]);
    expect(getPendingGatedMcpServers(resolvedServers(other), other)).toEqual([
      'home-ai-research',
    ]);
    expect(
      loadMcpApprovals().file.config[path.resolve(other)]?.['home-ai-research']
        .status,
    ).toBe('rejected');
  });

  it('never replaces a rejection even when its saved configuration hash is old', async () => {
    await loadMcpApprovals().setState(
      workspace,
      'node-repl',
      { command: 'older-node' },
      'rejected',
    );
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(
      loadMcpApprovals().file.config[path.resolve(workspace)]?.['node-repl']
        .status,
    ).toBe('rejected');
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
      'node-repl',
    ]);
  });

  it('preserves a rejection written by another process after approvals were cached', async () => {
    await initializeDesktopWorkspaceDefaults(workspace, true);
    const approvalsPath = path.join(qwenHome, 'mcpApprovals.json');
    const persisted = JSON.parse(readFileSync(approvalsPath, 'utf8'));
    persisted[path.resolve(workspace)]['node-repl'].status = 'rejected';
    writeFileSync(approvalsPath, JSON.stringify(persisted));
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([]);
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
      'node-repl',
    ]);
    expect(
      JSON.parse(readFileSync(approvalsPath, 'utf8'))[path.resolve(workspace)][
        'node-repl'
      ].status,
    ).toBe('rejected');
  });

  it('does not approve a configuration changed after the ownership receipt', async () => {
    writeServers({ 'node-repl': { command: 'custom-node' } });
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
      'node-repl',
    ]);
  });

  it('preserves a malformed approval store and fails closed', async () => {
    const approvalsPath = path.join(qwenHome, 'mcpApprovals.json');
    writeFileSync(approvalsPath, 'invalid json');
    await expect(
      initializeDesktopWorkspaceDefaults(workspace, true),
    ).rejects.toThrow('invalid MCP approvals file');
    expect(readFileSync(approvalsPath, 'utf8')).toBe('invalid json');
  });

  it('propagates installer errors instead of continuing with inherited defaults', async () => {
    writeFileSync(path.join(runtimeRoot, 'managed.json'), 'invalid json');
    await expect(
      initializeDesktopWorkspaceDefaults(workspace, true),
    ).rejects.toThrow();
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
      'node-repl',
    ]);
  });
});
