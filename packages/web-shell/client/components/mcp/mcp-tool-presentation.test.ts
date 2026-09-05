import { describe, expect, it } from 'vitest';
import type { DaemonWorkspaceMcpToolStatus } from '@qwen-code/web-shell/daemon-react-sdk';
import { mcpToolPresentation } from './mcp-tool-presentation';

const tool = (
  overrides: Partial<DaemonWorkspaceMcpToolStatus> = {},
): DaemonWorkspaceMcpToolStatus => ({
  name: 'mcp__serena__find_symbol',
  serverToolName: 'find_symbol',
  description: 'Finds symbols.',
  isValid: true,
  ...overrides,
});

describe('mcpToolPresentation', () => {
  it('localizes known Serena tools without changing the executable id', () => {
    const t = (key: string) =>
      ({
        'mcp.tool.find_symbol.title': 'Найти символ',
        'mcp.tool.find_symbol.description': 'Ищет сущности по имени.',
      })[key] ?? key;

    expect(mcpToolPresentation(tool(), t)).toEqual({
      title: 'Найти символ',
      description: 'Ищет сущности по имени.',
      technicalId: 'mcp__serena__find_symbol',
    });
  });

  it('keeps unknown server tools unchanged', () => {
    expect(
      mcpToolPresentation(
        tool({
          name: 'mcp__custom__inspect',
          serverToolName: 'inspect',
          description: 'Inspect a value.',
        }),
        (key) => key,
      ),
    ).toEqual({
      title: 'mcp__custom__inspect',
      description: 'Inspect a value.',
      technicalId: 'mcp__custom__inspect',
    });
  });
});
