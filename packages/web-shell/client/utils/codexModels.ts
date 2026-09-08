import type { CodexModel, ReasoningSelection } from '@qwen-code/sdk/daemon';
import type { DaemonReasoningControls } from '../daemon/session/types';

export function codexModelValue(modelId: string): string {
  return `codex:${modelId}`;
}

export function parseEngineModel(value: string): {
  engine: 'qwen' | 'codex';
  modelId: string;
} {
  return value.startsWith('codex:')
    ? { engine: 'codex', modelId: value.slice(6) }
    : { engine: 'qwen', modelId: value };
}

export function codexReasoning(model: CodexModel): DaemonReasoningControls {
  const efforts = model.supportedReasoningEfforts
    .map((entry) => entry.reasoningEffort)
    .filter(
      (value) => value !== 'none' && value !== 'default',
    ) as DaemonReasoningControls['efforts'];
  return {
    enabled: model.defaultReasoningEffort !== 'none',
    effort: model.defaultReasoningEffort as ReasoningSelection,
    efforts,
    defaultEffort: efforts.find(
      (value) => value === model.defaultReasoningEffort,
    ),
    canDisable: model.supportedReasoningEfforts.some(
      (entry) => entry.reasoningEffort === 'none',
    ),
  };
}
