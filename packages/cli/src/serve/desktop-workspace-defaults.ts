import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { MCPServerConfig } from '@qwen-code/qwen-code-core';
import { resolveEnvVarsInObject } from '@qwen-code/qwen-code-core/envVarResolver';
import { buildRuntimeEnvironment } from '../config/environment.js';

function isBundledPath(
  candidate: string | undefined,
  expected: string,
): boolean {
  return (
    typeof candidate === 'string' &&
    path.isAbsolute(candidate) &&
    existsSync(expected) &&
    (path.resolve(candidate) === path.resolve(expected) ||
      candidate === realpathSync(expected))
  );
}

export async function initializeDesktopWorkspaceDefaults(
  workspaceDir: string,
  trusted: boolean,
): Promise<void> {
  const runtimeRoot = process.env['QWEN_CODE_DESKTOP_RUNTIME_ROOT'];
  if (
    process.env['QWEN_CODE_DESKTOP'] !== '1' ||
    !trusted ||
    !runtimeRoot ||
    !existsSync(path.join(runtimeRoot, 'mcp', 'launch.mjs'))
  ) {
    return;
  }
  const { Storage } = await import('@qwen-code/qwen-code-core/storage');
  const { loadMcpApprovals } = await import('../config/mcpApprovals.js');
  const approvals = loadMcpApprovals({ reload: true });
  if (approvals.errors.length > 0) {
    throw new Error(
      'Cannot approve desktop MCP defaults: invalid MCP approvals file.',
    );
  }
  const projectRoot =
    process.platform === 'win32'
      ? path.resolve(workspaceDir).toLowerCase()
      : path.resolve(workspaceDir);
  const rejectedMcpNames = Object.entries(
    approvals.file.config[projectRoot] ?? {},
  )
    .filter(([, record]) => record?.status === 'rejected')
    .map(([name]) => name);
  const installer = (await import(
    pathToFileURL(path.join(runtimeRoot, 'lib', 'desktop-defaults.js')).href
  )) as {
    installDesktopWorkspaceDefaults(options: {
      runtimeRoot: string;
      qwenHome: string;
      workspaceDir: string;
      rejectedMcpNames: string[];
    }): Record<string, MCPServerConfig>;
  };
  const installed = installer.installDesktopWorkspaceDefaults({
    runtimeRoot,
    qwenHome: Storage.getGlobalQwenDir(),
    workspaceDir,
    rejectedMcpNames,
  });
  if (Object.keys(installed).length === 0) return;

  const { loadSettings } = await import('../config/settings.js');
  const settings = loadSettings(workspaceDir, {
    skipLoadEnvironment: true,
    workspaceTrusted: true,
  });
  const runtimeEnv = Object.fromEntries(
    Object.entries(
      buildRuntimeEnvironment(settings.merged, workspaceDir, process.env, true)
        .effectiveEnv,
    ).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  for (const [name, template] of Object.entries(installed)) {
    const original = settings.workspace.originalSettings.mcpServers?.[name];
    const merged = settings.merged.mcpServers?.[name];
    if (
      !isDeepStrictEqual(original, template) ||
      merged?.scope !== 'workspace' ||
      rejectedMcpNames.includes(name)
    ) {
      continue;
    }
    let resolved: MCPServerConfig = {
      ...resolveEnvVarsInObject(template, runtimeEnv),
      scope: 'workspace',
    };
    if (name === 'home-ai-research') {
      if (
        resolved.httpUrl !== 'https://biscet-server.local:9454/research/mcp' ||
        original?.headers?.['Authorization'] !== 'Bearer ${LOCAL_QWEN_API_KEY}'
      )
        continue;
      // Vane's saved credential takes precedence over the environment key.
      if (
        merged.headers?.['Authorization'] !==
        settings.workspace.settings.mcpServers?.[name]?.headers?.[
          'Authorization'
        ]
      ) {
        resolved = {
          ...resolved,
          headers: { ...resolved.headers, ...merged.headers },
        };
      }
    } else if (
      !['node-repl', 'serena', 'playwright', 'chrome-devtools'].includes(
        name,
      ) ||
      !isBundledPath(
        resolved.command,
        path.join(runtimeRoot, 'node/bin/node'),
      ) ||
      resolved.args?.length !== 2 ||
      resolved.args[1] !== name ||
      !isBundledPath(resolved.args[0], path.join(runtimeRoot, 'mcp/launch.mjs'))
    ) {
      continue;
    }
    if (approvals.getState(projectRoot, name, resolved) === 'approved')
      continue;
    await approvals.setState(projectRoot, name, resolved, 'approved');
  }
}
