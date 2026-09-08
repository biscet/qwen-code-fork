import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Config,
  DiscoveredMCPTool,
  ToolRegistry,
} from '@qwen-code/qwen-code-core';
import type { WorkspaceRuntime } from '../workspace-registry.js';

vi.mock('../../config/settings.js', () => ({
  loadSettings: () => ({ merged: {} }),
}));
vi.mock('../../config/mcpServers.js', () => ({
  assembleMcpServers: () => ({}),
}));
vi.mock('../../config/mcpApprovals.js', () => ({
  getPendingGatedMcpServers: () => [],
}));
import { CodexTools } from './codex-tools.js';

describe('Codex scheduler without Qwen LLM', () => {
  const roots: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0))
      rmSync(root, { recursive: true, force: true });
  });

  it('executes the existing findings tool with only the three HomeCode additions', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'codex-tools-'));
    roots.push(root);
    const refreshAuth = vi.spyOn(Config.prototype, 'refreshAuth');
    const runtime = {
      workspaceCwd: root,
      sessionRuntimeBaseDir: path.join(root, 'runtime'),
      trusted: true,
      env: { effectiveEnv: {} },
    } as unknown as WorkspaceRuntime;
    const tools = await CodexTools.create(
      runtime,
      '00000000-0000-4000-8000-000000000001',
    );
    try {
      expect(tools.declarations.map((tool) => tool.name).sort()).toEqual([
        'display_image',
        'record_artifact',
        'report_findings',
      ]);
      const result = await tools.execute(
        'report_findings',
        { findings: [] },
        'call-1',
        'prompt-1',
        new AbortController().signal,
        () => {},
        async () => true,
      );
      expect(result.success).toBe(true);
      expect(JSON.stringify(result.contentItems)).toContain(
        'Reported an empty findings list',
      );
      expect(refreshAuth).not.toHaveBeenCalled();
    } finally {
      await tools.dispose();
    }
  });

  it('aliases reserved MCP names for Codex while executing and approving the original scheduler tool', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'codex-mcp-alias-'));
    roots.push(root);
    const callTool = vi.fn().mockResolvedValue([
      {
        functionResponse: {
          name: 'find_declaration',
          response: { content: [{ type: 'text', text: 'MCP_ALIAS_OK' }] },
        },
      },
    ]);
    const callable = {
      tool: async () => ({ functionDeclarations: [] }),
      callTool,
    };
    const mcpTool = new DiscoveredMCPTool(
      callable,
      'serena',
      'find_declaration',
      'Find a declaration.',
      {
        type: 'object',
        properties: { symbol: { type: 'string' } },
        required: ['symbol'],
      },
    );
    const longTool = new DiscoveredMCPTool(
      callable,
      'serena',
      `find_declaration_${'long_'.repeat(30)}`,
      'Long tool.',
      { type: 'object', properties: {} },
    );
    vi.spyOn(ToolRegistry.prototype, 'discoverMcpTools').mockImplementation(
      async function (this: ToolRegistry) {
        this.registerTool(mcpTool);
        this.registerTool(longTool);
      },
    );
    const runtime = {
      workspaceCwd: root,
      sessionRuntimeBaseDir: path.join(root, 'runtime'),
      trusted: true,
      env: { effectiveEnv: {} },
    } as unknown as WorkspaceRuntime;
    const tools = await CodexTools.create(
      runtime,
      '00000000-0000-4000-8000-000000000002',
    );
    try {
      const names = tools.declarations.map((tool) => tool.name);
      expect(names).toContain('homecode_mcp__serena__find_declaration');
      expect(names).toContain(`homecode_${longTool.name}`);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) {
        expect(name).toMatch(/^[a-zA-Z0-9_-]{1,128}$/);
        expect(name).not.toMatch(/^mcp(?:__|$)/);
      }
      const onUpdate = vi.fn();
      const ask = vi.fn(async () => true);
      const result = await tools.execute(
        'homecode_mcp__serena__find_declaration',
        { symbol: 'testSymbol' },
        'mcp-call',
        'mcp-prompt',
        new AbortController().signal,
        onUpdate,
        ask,
      );
      expect(result).toMatchObject({
        success: true,
      });
      expect(JSON.stringify(result.contentItems)).toContain('MCP_ALIAS_OK');
      expect(callTool).toHaveBeenCalledWith([
        { name: 'find_declaration', args: { symbol: 'testSymbol' } },
      ]);
      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({ name: mcpTool.name }),
        }),
      );
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({ name: mcpTool.name }),
        }),
      );
      await expect(
        tools.execute(
          mcpTool.name,
          { symbol: 'testSymbol' },
          'raw-call',
          'raw-prompt',
          new AbortController().signal,
          onUpdate,
          ask,
        ),
      ).rejects.toThrow('Codex tool is unavailable');
      expect(callTool).toHaveBeenCalledTimes(1);
    } finally {
      await tools.dispose();
    }
  });
});
