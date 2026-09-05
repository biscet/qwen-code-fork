/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  isHiddenQwenOAuthModelAlias,
  isHiddenQwenOAuthModelValue,
  isStandaloneModelPickerUnavailable,
} from './composerModels';

describe('isHiddenQwenOAuthModelAlias', () => {
  it('hides only the built-in Qwen OAuth coder alias', () => {
    expect(isHiddenQwenOAuthModelAlias({ id: 'coder-model(qwen-oauth)' })).toBe(
      true,
    );
    expect(
      isHiddenQwenOAuthModelAlias({
        authType: 'qwen-oauth',
        modelId: 'coder-model',
      }),
    ).toBe(true);
    expect(
      isHiddenQwenOAuthModelAlias({
        authType: 'openai',
        modelId: 'coder-model',
      }),
    ).toBe(false);
  });

  it('recognizes persisted aliases, including a vision endpoint suffix', () => {
    expect(isHiddenQwenOAuthModelValue('coder-model')).toBe(true);
    expect(
      isHiddenQwenOAuthModelValue('coder-model', new Set(['coder-model'])),
    ).toBe(false);
    expect(isHiddenQwenOAuthModelValue('qwen-oauth:coder-model')).toBe(true);
    expect(isHiddenQwenOAuthModelValue('coder-model(qwen-oauth)')).toBe(true);
    expect(
      isHiddenQwenOAuthModelValue(
        'qwen-oauth:coder-model\0https://example.com/v1',
      ),
    ).toBe(true);
    expect(isHiddenQwenOAuthModelValue('qwen3.7-plus')).toBe(false);
  });
});

describe('isStandaloneModelPickerUnavailable', () => {
  it('is available when a session is attached', () => {
    expect(
      isStandaloneModelPickerUnavailable({
        sessionId: 'session-1',
        sessionContextKind: 'standalone',
        models: undefined,
      }),
    ).toBe(false);
  });

  it('is available outside standalone contexts', () => {
    expect(
      isStandaloneModelPickerUnavailable({
        sessionId: undefined,
        sessionContextKind: 'workspace',
        models: [],
      }),
    ).toBe(false);
  });

  it('is unavailable before the catalog hydrates', () => {
    expect(
      isStandaloneModelPickerUnavailable({
        sessionId: undefined,
        sessionContextKind: 'standalone',
        models: undefined,
      }),
    ).toBe(true);
  });

  it('is unavailable when the hydrated catalog is empty', () => {
    expect(
      isStandaloneModelPickerUnavailable({
        sessionId: undefined,
        sessionContextKind: 'standalone',
        models: [],
      }),
    ).toBe(true);
  });

  it('is unavailable when the catalog only holds hidden models', () => {
    expect(
      isStandaloneModelPickerUnavailable({
        sessionId: undefined,
        sessionContextKind: 'standalone',
        models: [{ id: 'coder-model(qwen-oauth)' }],
      }),
    ).toBe(true);
  });

  it('is available when the catalog has a user-selectable model', () => {
    expect(
      isStandaloneModelPickerUnavailable({
        sessionId: undefined,
        sessionContextKind: 'standalone',
        models: [
          { id: 'coder-model(qwen-oauth)' },
          { id: 'qwen3-max(USE_OPENAI)' },
        ],
      }),
    ).toBe(false);
  });
});
