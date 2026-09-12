import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
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
import { buildRuntimeEnvironment } from '../config/environment.js';

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

  const provisionSerena = () => {
    const serena = {
      ...template,
      args: ['${HOMECODE_MCP_LAUNCHER}', 'serena'],
    };
    writeServers({ serena });
    writeFileSync(
      path.join(runtimeRoot, 'managed.json'),
      JSON.stringify({ serena }),
    );
    rmSync(path.join(runtimeRoot, 'node/bin/node'));
    symlinkSync(process.execPath, path.join(runtimeRoot, 'node/bin/node'));
    writeFileSync(
      path.join(runtimeRoot, 'mcp/launch.mjs'),
      `import fs from 'node:fs';
await new Promise(resolve => setTimeout(resolve, 20));
fs.mkdirSync('.serena', { recursive: true });
fs.writeFileSync('.serena/project.yml', JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));`,
    );
    return serena;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'desktop-workspace-defaults-'));
    runtimeRoot = path.join(root, 'App With Spaces');
    workspace = path.join(root, 'project-a');
    qwenHome = path.join(root, 'profile');
    for (const directory of ['lib', 'mcp', 'node/bin']) {
      mkdirSync(path.join(runtimeRoot, directory), { recursive: true });
    }
    mkdirSync(qwenHome);
    writeFileSync(path.join(runtimeRoot, 'package.json'), '{"type":"module"}');
    writeFileSync(path.join(runtimeRoot, 'mcp', 'launch.mjs'), '');
    writeFileSync(path.join(runtimeRoot, 'node/bin/node'), '');
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
    vi.stubEnv('HOMECODE_MCP_NODE', path.join(runtimeRoot, 'node/bin/node'));
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
    expect(servers['node-repl'].command).toBe(
      path.join(runtimeRoot, 'node/bin/node'),
    );
    expect(getPendingGatedMcpServers(servers, workspace)).toEqual(['custom']);
    expect(
      JSON.parse(readFileSync(path.join(runtimeRoot, 'called.json'), 'utf8')),
    ).toEqual({
      runtimeRoot,
      qwenHome,
      workspaceDir: workspace,
      rejectedMcpNames: [],
    });
    expect(loadMcpApprovals().getState(workspace, 'node-repl', template)).toBe(
      'pending',
    );
  });

  it('initializes the selected Serena project before completing bootstrap', async () => {
    provisionSerena();
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(
      JSON.parse(
        readFileSync(path.join(workspace, '.serena/project.yml'), 'utf8'),
      ),
    ).toEqual({
      cwd: realpathSync(workspace),
      args: ['serena', '--initialize-project'],
    });
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([]);
  });

  it('preserves an existing Serena project configuration', async () => {
    provisionSerena();
    mkdirSync(path.join(workspace, '.serena'));
    const projectFile = path.join(workspace, '.serena/project.yml');
    writeFileSync(projectFile, 'custom project configuration');
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(readFileSync(projectFile, 'utf8')).toBe(
      'custom project configuration',
    );
  });

  it.each([
    'excluded',
    'allowed',
    'disabled',
    'rejected',
    'custom',
    'untrusted',
  ])('does not initialize a %s Serena server', async (mode) => {
    const serena = provisionSerena();
    if (mode === 'excluded' || mode === 'allowed') {
      writeFileSync(
        path.join(workspace, '.qwen/settings.json'),
        JSON.stringify({
          mcpServers: { serena },
          mcp: { [mode]: mode === 'allowed' ? [] : ['serena'] },
        }),
      );
    } else if (mode === 'disabled' || mode === 'custom') {
      writeServers({
        serena: {
          ...serena,
          ...(mode === 'disabled'
            ? { disabled: true }
            : { command: 'custom-serena' }),
        },
      });
    } else if (mode === 'rejected') {
      await loadMcpApprovals().setState(
        workspace,
        'serena',
        serena,
        'rejected',
      );
    }
    await initializeDesktopWorkspaceDefaults(workspace, mode !== 'untrusted');
    expect(() =>
      readFileSync(path.join(workspace, '.serena/project.yml')),
    ).toThrow();
  });

  it('keeps the workspace available if early Serena setup fails', async () => {
    provisionSerena();
    writeFileSync(path.join(runtimeRoot, 'mcp/launch.mjs'), 'process.exit(1)');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      await expect(
        initializeDesktopWorkspaceDefaults(workspace, true),
      ).resolves.toBeUndefined();
      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining('Serena project initialization failed'),
      );
      expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual(
        [],
      );
    } finally {
      stderr.mockRestore();
    }
  });

  it.each([
    { mcp: { allowed: ['*'] }, initializes: true },
    { mcp: { allowed: ['ser*'] }, initializes: true },
    { mcp: { excluded: ['*'] }, initializes: false },
    { mcp: { excluded: ['ser*'] }, initializes: false },
  ])('honors MCP server patterns $mcp', async ({ mcp, initializes }) => {
    const serena = provisionSerena();
    writeFileSync(
      path.join(workspace, '.qwen/settings.json'),
      JSON.stringify({ mcpServers: { serena }, mcp }),
    );
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(existsSync(path.join(workspace, '.serena/project.yml'))).toBe(
      initializes,
    );
  });

  it('uses the home env key without expanding literal dollars twice', async () => {
    const research = {
      httpUrl: 'https://biscet-server.local:9454/research/mcp',
      headers: { Authorization: 'Bearer ${LOCAL_QWEN_API_KEY}' },
    };
    writeFileSync(
      path.join(qwenHome, '.env'),
      'LOCAL_QWEN_API_KEY=test-fixture-$DESKTOP_TEST_LITERAL',
    );
    vi.stubEnv('DESKTOP_TEST_LITERAL', 'must-not-be-substituted');
    writeFileSync(
      path.join(runtimeRoot, 'managed.json'),
      JSON.stringify({ 'home-ai-research': research }),
    );
    writeServers({ 'home-ai-research': research });
    await initializeDesktopWorkspaceDefaults(workspace, true);
    const servers = resolvedServers();
    expect(servers['home-ai-research'].headers?.['Authorization']).toBe(
      'Bearer test-fixture-$DESKTOP_TEST_LITERAL',
    );
    expect(getPendingGatedMcpServers(servers, workspace)).toEqual([]);
  });

  it.each(['user', 'workspace'])(
    'approves the runtime key from %s settings.env without changing the process environment',
    async (scope) => {
      const research = {
        httpUrl: 'https://biscet-server.local:9454/research/mcp',
        headers: { Authorization: 'Bearer ${LOCAL_QWEN_API_KEY}' },
      };
      const key = 'fixture-runtime-key';
      vi.stubEnv('LOCAL_QWEN_API_KEY', undefined);
      writeFileSync(
        path.join(runtimeRoot, 'managed.json'),
        JSON.stringify({ 'home-ai-research': research }),
      );
      writeServers({ 'home-ai-research': research });
      const settingsPath =
        scope === 'user'
          ? path.join(qwenHome, 'settings.json')
          : path.join(workspace, '.qwen/settings.json');
      writeFileSync(
        settingsPath,
        JSON.stringify({
          ...(scope === 'workspace'
            ? { mcpServers: { 'home-ai-research': research } }
            : {}),
          env: { LOCAL_QWEN_API_KEY: key },
        }),
      );

      await initializeDesktopWorkspaceDefaults(workspace, true);
      expect(process.env['LOCAL_QWEN_API_KEY']).toBeUndefined();
      const settings = loadSettings(workspace, {
        skipLoadEnvironment: true,
        workspaceTrusted: true,
      });
      const env = buildRuntimeEnvironment(
        settings.merged,
        workspace,
        process.env,
        true,
      );
      vi.stubEnv('LOCAL_QWEN_API_KEY', env.effectiveEnv['LOCAL_QWEN_API_KEY']);
      const servers = resolvedServers();
      expect(servers['home-ai-research'].headers?.['Authorization']).toBe(
        `Bearer ${key}`,
      );
      expect(getPendingGatedMcpServers(servers, workspace)).toEqual([]);
      resetMcpApprovalsForTesting();
      expect(getPendingGatedMcpServers(servers, workspace)).toEqual([]);
    },
  );

  it.each(['HOMECODE_MCP_NODE', 'HOMECODE_MCP_LAUNCHER'])(
    'does not approve a bundled template redirected through %s',
    async (key) => {
      vi.stubEnv(key, path.join(workspace, 'untrusted-executable'));
      await initializeDesktopWorkspaceDefaults(workspace, true);
      expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
        'node-repl',
      ]);
    },
  );

  it('does not approve a launcher redirected through workspace settings.env', async () => {
    vi.stubEnv('HOMECODE_MCP_LAUNCHER', undefined);
    writeFileSync(
      path.join(workspace, '.qwen/settings.json'),
      JSON.stringify({
        mcpServers: { 'node-repl': template },
        env: {
          HOMECODE_MCP_LAUNCHER: path.join(workspace, 'untrusted-launcher'),
        },
      }),
    );
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(loadMcpApprovals().file.config[workspace]).toBeUndefined();
  });

  it('does not approve relative paths resolved against the daemon instead of the selected workspace', async () => {
    vi.stubEnv(
      'HOMECODE_MCP_NODE',
      path.relative(process.cwd(), path.join(runtimeRoot, 'node/bin/node')),
    );
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([
      'node-repl',
    ]);
  });

  it('keeps the packaged launcher when project env attempts to override it', async () => {
    writeFileSync(
      path.join(workspace, '.qwen/settings.json'),
      JSON.stringify({
        mcpServers: { 'node-repl': template },
        env: {
          HOMECODE_MCP_LAUNCHER: path.join(workspace, 'untrusted-launcher'),
        },
      }),
    );
    await initializeDesktopWorkspaceDefaults(workspace, true);
    expect(getPendingGatedMcpServers(resolvedServers(), workspace)).toEqual([]);
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
