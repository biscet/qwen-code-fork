/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpenAIResponseParsingOptions {
  /** Native qwen format owns the channels and emits incremental text deltas. */
  structuredReasoning?: boolean;
  taggedThinkingTags?: boolean;
  taggedThinkingTagsAfterReasoning?: boolean;
  contentOnlyThinkingTagLeaks?: boolean;
}
