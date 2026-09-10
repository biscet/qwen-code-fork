import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import type { MCPServerConfig } from '@qwen-code/qwen-code-core';

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
  const installer = (await import(
    pathToFileURL(path.join(runtimeRoot, 'lib', 'desktop-defaults.js')).href
  )) as {
    installDesktopWorkspaceDefaults(options: {
      runtimeRoot: string;
      qwenHome: string;
      workspaceDir: string;
    }): Record<string, MCPServerConfig>;
  };
  const installed = installer.installDesktopWorkspaceDefaults({
    runtimeRoot,
    qwenHome: Storage.getGlobalQwenDir(),
    workspaceDir,
  });
  if (Object.keys(installed).length === 0) return;

  const { loadSettings } = await import('../config/settings.js');
  const { loadMcpApprovals } = await import('../config/mcpApprovals.js');
  const settings = loadSettings(workspaceDir, {
    skipLoadEnvironment: true,
    workspaceTrusted: true,
  });
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
  for (const [name, template] of Object.entries(installed)) {
    const original = settings.workspace.originalSettings.mcpServers?.[name];
    const resolved = settings.merged.mcpServers?.[name];
    if (
      !isDeepStrictEqual(original, template) ||
      resolved?.scope !== 'workspace' ||
      approvals.file.config[projectRoot]?.[name]?.status === 'rejected' ||
      approvals.getState(projectRoot, name, resolved) === 'approved'
    ) {
      continue;
    }
    await approvals.setState(projectRoot, name, resolved, 'approved');
  }
}
