/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { APIError } from 'openai';
import {
  ModelEmptyAnswerError,
  toModelEmptyAnswerError,
} from './model-empty-answer-error.js';

const providerError = {
  type: 'final_answer_not_formed',
  code: 'empty_answer',
  message: 'Финальный ответ не сформирован',
};

describe('toModelEmptyAnswerError', () => {
  it('recognizes the OpenAI SDK SSE error and ACP RequestError data', () => {
    const sdkError = new APIError(
      undefined,
      providerError,
      undefined,
      undefined,
    );
    for (const error of [
      sdkError,
      { cause: sdkError },
      {
        code: -32603,
        data: {
          details: providerError.message,
          errorKind: providerError.type,
          code: providerError.code,
        },
      },
    ]) {
      expect(toModelEmptyAnswerError(error)).toMatchObject({
        name: 'ModelEmptyAnswerError',
        errorKind: 'final_answer_not_formed',
        code: 'empty_answer',
        message: providerError.message,
      });
    }
  });

  it.each([
    new Error('final_answer_not_formed: empty_answer'),
    { ...providerError, code: 'unclosed_think' },
    { ...providerError, type: 'rate_limit_error' },
    { type: providerError.type, error: { code: providerError.code } },
  ])('requires the exact structured type and code pair', (error) => {
    expect(toModelEmptyAnswerError(error)).toBeUndefined();
  });

  it('bounds messages and safely handles cycles and hostile getters', () => {
    expect(
      toModelEmptyAnswerError({ ...providerError, message: 'm'.repeat(5_000) })
        ?.message,
    ).toHaveLength(4_096);
    const cyclic = { cause: undefined as unknown };
    cyclic.cause = cyclic;
    expect(toModelEmptyAnswerError(cyclic)).toBeUndefined();
    expect(
      toModelEmptyAnswerError(
        new Proxy(
          {},
          {
            get: () => {
              throw new Error('hostile');
            },
          },
        ),
      ),
    ).toBeUndefined();
    expect(
      toModelEmptyAnswerError(new ModelEmptyAnswerError('safe'))?.message,
    ).toBe('safe');
  });
});
