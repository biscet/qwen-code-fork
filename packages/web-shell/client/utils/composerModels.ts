/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DaemonModelInfo } from '../daemon/session/types';

export function findConfiguredComposerModel(
  model: DaemonModelInfo,
  previousModels: readonly DaemonModelInfo[],
  configuredModels: readonly DaemonModelInfo[],
): DaemonModelInfo | undefined {
  const exact = configuredModels.find((entry) => entry.id === model.id);
  if (exact) return exact;
  const previous = previousModels.find((entry) => entry.id === model.id);
  if (
    !previous?.authType ||
    !previous.baseModelId ||
    previous.registryBaseUrl === undefined
  )
    return undefined;
  const matches = configuredModels.filter(
    (entry) =>
      entry.authType === previous.authType &&
      entry.baseModelId === previous.baseModelId &&
      entry.registryBaseUrl === previous.registryBaseUrl &&
      entry.baseUrl === previous.baseUrl &&
      entry.envKey === previous.envKey,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Model IDs hidden from the composer's model picker — internal / duplicate
 * entries that must not be user-selectable. Shared by the main chat composer
 * (App) and the split-view pane composers (ChatPane) so both hide the same set.
 */
export const HIDDEN_COMPOSER_MODEL_IDS = new Set(['coder-model(qwen-oauth)']);

export function isHiddenQwenOAuthModelAlias(model: {
  id?: string;
  modelId?: string;
  baseModelId?: string;
  authType?: string;
}): boolean {
  return (
    (model.id !== undefined && HIDDEN_COMPOSER_MODEL_IDS.has(model.id)) ||
    (model.authType === 'qwen-oauth' &&
      (model.baseModelId ?? model.modelId ?? model.id) === 'coder-model')
  );
}

export function isHiddenQwenOAuthModelValue(
  value: string,
  visibleBaseModelIds?: ReadonlySet<string>,
): boolean {
  const selector = value.split('\0', 1)[0]?.trim();
  return (
    (selector === 'coder-model' && !visibleBaseModelIds?.has(selector)) ||
    selector === 'qwen-oauth:coder-model' ||
    selector === 'coder-model(qwen-oauth)'
  );
}

/** Whether a model may appear in the composer's model picker. */
export function isVisibleComposerModel(model: { id: string }): boolean {
  return !isHiddenQwenOAuthModelAlias(model);
}

/**
 * Whether the model picker is unavailable for a fresh standalone draft: no
 * session attached yet and the hydrated catalog has no user-selectable
 * models. Shared by every picker entry point (composer toolbar, StatusBar
 * button, /model command) so the gates never drift apart.
 */
export function isStandaloneModelPickerUnavailable(input: {
  sessionId: string | null | undefined;
  sessionContextKind: string | undefined;
  models: readonly { id: string }[] | undefined;
}): boolean {
  return (
    !input.sessionId &&
    input.sessionContextKind === 'standalone' &&
    (input.models ?? []).filter(isVisibleComposerModel).length === 0
  );
}
