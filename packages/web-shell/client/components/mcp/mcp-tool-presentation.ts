import type { DaemonWorkspaceMcpToolStatus } from '@qwen-code/web-shell/daemon-react-sdk';

const LOCALIZED_TOOL_KEYS = new Set([
  'find_declaration',
  'find_implementations',
  'find_referencing_symbols',
  'find_symbol',
  'get_diagnostics_for_file',
  'get_symbols_overview',
  'initial_instructions',
  'insert_after_symbol',
  'insert_before_symbol',
  'rename_symbol',
  'replace_symbol_body',
  'safe_delete_symbol',
]);

function serverToolName(tool: DaemonWorkspaceMcpToolStatus): string {
  const name = tool.serverToolName?.trim() || tool.name;
  return name.split('__').at(-1) || name;
}

export function mcpToolPresentation(
  tool: DaemonWorkspaceMcpToolStatus,
  t: (key: string) => string,
): { title: string; description: string; technicalId: string } {
  const key = serverToolName(tool);
  if (!LOCALIZED_TOOL_KEYS.has(key)) {
    return {
      title: tool.name,
      description: tool.description?.trim() || t('mcp.noDescription'),
      technicalId: tool.name,
    };
  }
  return {
    title: t(`mcp.tool.${key}.title`),
    description: t(`mcp.tool.${key}.description`),
    technicalId: tool.name,
  };
}
