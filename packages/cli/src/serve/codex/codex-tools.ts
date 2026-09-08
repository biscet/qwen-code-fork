import {
  ApprovalMode,
  Config,
  CoreToolScheduler,
  DiscoveredMCPTool,
  ToolConfirmationOutcome,
  type CompletedToolCall,
  type ToolCall,
} from '@qwen-code/qwen-code-core';
import { loadSettings } from '../../config/settings.js';
import { assembleMcpServers } from '../../config/mcpServers.js';
import { getPendingGatedMcpServers } from '../../config/mcpApprovals.js';
import type { WorkspaceRuntime } from '../workspace-registry.js';
import { runWithWorkspaceRuntimeStorage } from '../workspace-runtime-storage.js';

const ADDITIONS = ['report_findings', 'record_artifact', 'display_image'];

export interface CodexToolSpec {
  type: 'function';
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface CodexToolResult {
  success: boolean;
  contentItems: Array<
    | { type: 'inputText'; text: string }
    | { type: 'inputImage'; imageUrl: string }
  >;
}

export class CodexTools {
  private constructor(
    private readonly config: Config,
    readonly declarations: CodexToolSpec[],
    readonly schedulerNames: ReadonlyMap<string, string>,
  ) {}

  static async create(
    runtime: WorkspaceRuntime,
    sessionId: string,
    signal?: AbortSignal,
  ) {
    return runWithWorkspaceRuntimeStorage(runtime, async () => {
      runtime.generationGuard?.assertOpen();
      const settings = loadSettings(runtime.workspaceCwd, {
        skipLoadEnvironment: true,
        workspaceTrusted: runtime.trusted,
      }).merged;
      const mcpServers = assembleMcpServers(
        settings.mcpServers,
        runtime.workspaceCwd,
      );
      const config = new Config({
        sessionId,
        targetDir: runtime.workspaceCwd,
        cwd: runtime.workspaceCwd,
        debugMode: false,
        interactive: true,
        model: 'codex-external-engine',
        coreTools: ADDITIONS,
        disabledTools: settings.tools?.disabled,
        pendingMcpServers: getPendingGatedMcpServers(
          mcpServers,
          runtime.workspaceCwd,
        ),
        approvalMode: ApprovalMode.DEFAULT,
        permissions: settings.permissions,
        mcpServers: Object.fromEntries(
          Object.entries(mcpServers).map(([name, server]) => [
            name,
            {
              ...server,
              env: {
                ...Object.fromEntries(
                  Object.entries(runtime.env.effectiveEnv ?? {}).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === 'string',
                  ),
                ),
                ...server.env,
              },
            },
          ]),
        ),
        chatRecording: false,
        sessionWriterLeaseEnabled: false,
        folderTrust: runtime.trusted,
        disableAllHooks: true,
        toolInvocationGuard: () => {
          runtime.generationGuard?.assertOpen();
          return { allowed: runtime.trusted };
        },
        terminalImageRenderSupportProvider: async () => ({ available: true }),
      });
      try {
        await config.initialize({
          toolsOnly: true,
          skipLlmInitialization: true,
          signal,
        });
        runtime.generationGuard?.assertOpen();
        const schedulerNames = new Map<string, string>();
        const declarations = config
          .getToolRegistry()
          .getAllTools()
          .filter(
            (tool) =>
              ADDITIONS.includes(tool.name) ||
              tool instanceof DiscoveredMCPTool,
          )
          .map((tool): CodexToolSpec => {
            // Codex reserves mcp__ names for its own MCP transport.
            const name =
              tool instanceof DiscoveredMCPTool
                ? `homecode_${tool.name}`
                : tool.name;
            schedulerNames.set(name, tool.name);
            return {
              type: 'function',
              name,
              description: tool.description,
              inputSchema: tool.parameterSchema,
            };
          });
        return new CodexTools(config, declarations, schedulerNames);
      } catch (error) {
        await config.shutdown({ shutdownTelemetry: false });
        throw error;
      }
    });
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    callId: string,
    promptId: string,
    signal: AbortSignal,
    onUpdate: (call: ToolCall) => void,
    ask: (call: ToolCall) => Promise<boolean>,
  ): Promise<CodexToolResult> {
    const schedulerName = this.schedulerNames.get(name);
    if (!schedulerName) {
      throw new Error(`Codex tool is unavailable: ${name}`);
    }
    return new Promise<CodexToolResult>((resolve, reject) => {
      const asking = new Set<string>();
      const scheduler = new CoreToolScheduler({
        config: this.config,
        nativeMedia: true,
        hasSkillTool: () => false,
        getPreferredEditor: () => undefined,
        onEditorClose: () => {},
        onToolCallsUpdate: (calls) => {
          for (const call of calls) {
            onUpdate(call);
            if (call.status === 'awaiting_approval' && !asking.has(callId)) {
              asking.add(callId);
              void ask(call)
                .then((allow) =>
                  scheduler.handleConfirmationResponse(
                    callId,
                    call.confirmationDetails.onConfirm,
                    allow
                      ? ToolConfirmationOutcome.ProceedOnce
                      : ToolConfirmationOutcome.Cancel,
                    signal,
                  ),
                )
                .catch(reject);
            }
          }
        },
        onAllToolCallsComplete: async (calls: CompletedToolCall[]) => {
          const call = calls.find((item) => item.request.callId === callId);
          if (!call) return;
          const contentItems: CodexToolResult['contentItems'] = [];
          for (const part of call.response.responseParts) {
            if (part.text)
              contentItems.push({ type: 'inputText', text: part.text });
            if (part.functionResponse?.response) {
              contentItems.push({
                type: 'inputText',
                text: JSON.stringify(part.functionResponse.response),
              });
            }
            if (part.inlineData?.data) {
              contentItems.push({
                type: 'inputImage',
                imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              });
            }
            for (const nested of part.functionResponse?.parts ?? []) {
              if (nested.inlineData?.data)
                contentItems.push({
                  type: 'inputImage',
                  imageUrl: `data:${nested.inlineData.mimeType};base64,${nested.inlineData.data}`,
                });
            }
          }
          resolve({ success: call.status === 'success', contentItems });
        },
      });
      void scheduler
        .schedule(
          {
            name: schedulerName,
            args,
            callId,
            prompt_id: promptId,
            isClientInitiated: false,
          },
          signal,
        )
        .catch(reject);
    });
  }

  dispose() {
    return this.config.shutdown({ shutdownTelemetry: false });
  }
}
