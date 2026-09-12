/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

export const MODEL_EMPTY_ANSWER_ERROR_KIND = 'final_answer_not_formed';
export const MODEL_EMPTY_ANSWER_ERROR_CODE = 'empty_answer';
const MAX_ERROR_MESSAGE_CHARS = 4_096;

export class ModelEmptyAnswerError extends Error {
  readonly errorKind = MODEL_EMPTY_ANSWER_ERROR_KIND;
  readonly code = MODEL_EMPTY_ANSWER_ERROR_CODE;

  constructor(message: string, cause?: unknown) {
    super(message.slice(0, MAX_ERROR_MESSAGE_CHARS), { cause });
    this.name = 'ModelEmptyAnswerError';
  }
}

function readField(value: object, field: string): unknown {
  try {
    return Reflect.get(value, field);
  } catch {
    return undefined;
  }
}

export function toModelEmptyAnswerError(
  error: unknown,
): ModelEmptyAnswerError | undefined {
  const pending: unknown[] = [error];
  const seen = new Set<object>();
  for (let index = 0; index < pending.length && seen.size < 8; index++) {
    const value = pending[index];
    if (typeof value !== 'object' || value === null || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (
      (readField(value, 'type') === MODEL_EMPTY_ANSWER_ERROR_KIND ||
        readField(value, 'errorKind') === MODEL_EMPTY_ANSWER_ERROR_KIND) &&
      readField(value, 'code') === MODEL_EMPTY_ANSWER_ERROR_CODE
    ) {
      const message =
        readField(value, 'message') ?? readField(value, 'details');
      return new ModelEmptyAnswerError(
        typeof message === 'string' && message.trim().length > 0
          ? message
          : 'The model did not produce a usable response.',
        error,
      );
    }
    pending.push(
      readField(value, 'error'),
      readField(value, 'cause'),
      readField(value, 'data'),
    );
  }
  return undefined;
}
