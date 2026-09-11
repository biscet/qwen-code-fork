/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const runSideQueryMock = vi.fn();
const resolveForModelMock = vi.fn();
const debugLoggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../utils/sideQuery.js', () => ({
  runSideQuery: (...args: unknown[]) => runSideQueryMock(...args),
}));

vi.mock('../utils/debugLogger.js', () => ({
  createDebugLogger: () => debugLoggerMock,
}));

import {
  classifyAction,
  sanitizeClassifierReason,
  STAGE1_TIMEOUT_MS,
  STAGE1_THINKING_TIMEOUT_MS,
  STAGE2_TIMEOUT_MS,
  type ClassifierInput,
} from './classifier.js';
import type { Config } from '../config/config.js';
import type { ToolRegistry } from '../tools/tool-registry.js';
import { expectWithinLatencyBudget } from '../test-utils/latency-budget.js';
import { DEFAULT_QWEN_MODEL } from '../utils/default-qwen-model.js';

function makeConfig(
  autoModeSettings: ReturnType<Config['getAutoModeSettings']> = {},
): Config {
  return {
    getFastModel: () => 'qwen-turbo-test',
    getModel: () => 'qwen-max-test',
    getBaseLlmClient: () => ({ resolveForModel: resolveForModelMock }),
    getContentGeneratorConfig: () => ({ thinkingMandatory: false }),
    getAutoModeSettings: () => autoModeSettings,
    getToolRegistry: () =>
      ({ getTool: () => undefined }) as unknown as ToolRegistry,
  } as unknown as Config;
}

function makeInput(over: Partial<ClassifierInput> = {}): ClassifierInput {
  return {
    toolName: 'run_shell_command',
    toolParams: { command: 'ls' },
    messages: [],
    config: makeConfig(),
    signal: new AbortController().signal,
    ...over,
  };
}

beforeEach(() => {
  runSideQueryMock.mockReset();
  resolveForModelMock
    .mockReset()
    .mockResolvedValue({ contentGeneratorConfig: {} });
  debugLoggerMock.debug.mockReset();
  debugLoggerMock.warn.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('classifyAction — stage 1 happy path', () => {
  it('returns allow without calling stage 2 when stage 1 says shouldBlock=false', async () => {
    runSideQueryMock.mockResolvedValueOnce({ shouldBlock: false });

    const result = await classifyAction(makeInput());

    expect(result.shouldBlock).toBe(false);
    expect(result.reason).toBe('');
    expect(result.unavailable).toBeUndefined();
    expect(result.stage).toBe('fast');
    expect(runSideQueryMock).toHaveBeenCalledTimes(1);
  });

  it('passes the fast-stage purpose to sideQuery', async () => {
    runSideQueryMock.mockResolvedValueOnce({ shouldBlock: false });
    await classifyAction(makeInput());
    const call = runSideQueryMock.mock.calls[0]?.[1] as { purpose?: string };
    expect(call?.purpose).toBe('permission_classifier_stage1');
  });
});

describe('classifyAction — stage 1 escalates to stage 2', () => {
  it('sends the same trusted-answer transcript to both stages', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockResolvedValueOnce({ thinking: 't', shouldBlock: false, reason: '' });

    await classifyAction(
      makeInput({
        messages: [
          {
            role: 'model',
            parts: [
              {
                functionCall: {
                  id: 'ask-1',
                  name: 'ask_user_question',
                  args: {},
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: 'ask-1',
                  name: 'ask_user_question',
                  response: {},
                },
              },
            ],
          },
        ],
        trustedUserAnswers: [
          {
            callId: 'ask-1',
            omitted: false,
            answers: [
              {
                question: 'Create marker?',
                answer: 'No',
              },
            ],
          },
        ],
      }),
    );

    const stage1 = runSideQueryMock.mock.calls[0]?.[1] as {
      contents: unknown;
    };
    const stage2 = runSideQueryMock.mock.calls[1]?.[1] as {
      contents: unknown;
    };
    expect(stage2.contents).toBe(stage1.contents);
    expect(JSON.stringify(stage1.contents)).toContain('Create marker?');
    expect(JSON.stringify(stage1.contents)).toContain('No');
  });

  it('returns stage 2 verdict (block + reason) when stage 2 confirms block', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockResolvedValueOnce({
        thinking: 'rm -rf / destroys the root filesystem',
        shouldBlock: true,
        reason: 'Irreversible filesystem destruction',
      });

    const result = await classifyAction(makeInput());

    expect(result.shouldBlock).toBe(true);
    expect(result.reason).toBe('Irreversible filesystem destruction');
    expect(result.thinking).toContain('rm -rf');
    expect(result.unavailable).toBeUndefined();
    expect(result.stage).toBe('thinking');
    expect(runSideQueryMock).toHaveBeenCalledTimes(2);
  });

  it('downgrades stage 1 block to allow when stage 2 says shouldBlock=false', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockResolvedValueOnce({
        thinking: 'cleanup of node_modules is consistent with user intent',
        shouldBlock: false,
        reason: 'safe cleanup',
      });

    const result = await classifyAction(makeInput());

    expect(result.shouldBlock).toBe(false);
    // Allow path discards the reason field.
    expect(result.reason).toBe('');
    expect(result.stage).toBe('thinking');
  });

  it('passes the thinking-stage purpose for the second call', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockResolvedValueOnce({ thinking: 't', shouldBlock: false, reason: '' });
    await classifyAction(makeInput());
    const call = runSideQueryMock.mock.calls[1]?.[1] as { purpose?: string };
    expect(call?.purpose).toBe('permission_classifier_stage2');
  });
});

describe('classifyAction — unavailable on stage 1 failure', () => {
  it('fails closed when resolving the stage 1 generator throws', async () => {
    resolveForModelMock.mockRejectedValueOnce(new Error('Model unavailable'));

    const result = await classifyAction(makeInput());

    expect(result.shouldBlock).toBe(true);
    expect(result.unavailable).toBe(true);
    expect(result.stage).toBe('fast');
    expect(result.reason).toBe('Classifier stage 1 unavailable');
    expect(runSideQueryMock).not.toHaveBeenCalled();
  });

  it('returns unavailable=true when stage 1 throws an API error', async () => {
    runSideQueryMock.mockRejectedValueOnce(new Error('API 500'));
    const result = await classifyAction(makeInput());
    expect(result.shouldBlock).toBe(true);
    expect(result.unavailable).toBe(true);
    expect(result.stage).toBe('fast');
    expect(result.reason).toBe('Classifier stage 1 unavailable');
  });

  it('surfaces a context-overflow reason when stage 1 fails with that error', async () => {
    runSideQueryMock.mockRejectedValueOnce(
      new Error('Prompt is too long: 200000 tokens > 128000 maximum'),
    );
    const result = await classifyAction(makeInput());
    expect(result.shouldBlock).toBe(true);
    expect(result.unavailable).toBe(true);
    expect(result.reason).toMatch(/context window/i);
  });

  it('re-throws when the user signal is aborted (not converted to block)', async () => {
    const controller = new AbortController();
    runSideQueryMock.mockImplementationOnce(async () => {
      controller.abort();
      throw new Error('aborted');
    });
    await expect(
      classifyAction(makeInput({ signal: controller.signal })),
    ).rejects.toThrow();
  });
});

describe('classifyAction — unavailable on stage 2 failure', () => {
  it('honors stage 1 block when stage 2 fails (unavailable=true)', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockRejectedValueOnce(new Error('API 500'));

    const result = await classifyAction(makeInput());

    expect(result.shouldBlock).toBe(true);
    expect(result.unavailable).toBe(true);
    expect(result.stage).toBe('thinking');
    expect(result.reason).toMatch(/Stage 1 flagged/i);
  });

  it('re-throws when the user signal aborts during stage 2', async () => {
    const controller = new AbortController();
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockImplementationOnce(async () => {
        controller.abort();
        throw new Error('aborted');
      });
    await expect(
      classifyAction(makeInput({ signal: controller.signal })),
    ).rejects.toThrow();
  });
});

describe('classifier configuration', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
  });

  it.each([false, true])(
    'uses configured stage timeouts when mandatory thinking is %s',
    async (thinkingMandatory) => {
      resolveForModelMock.mockResolvedValueOnce({
        contentGeneratorConfig: { thinkingMandatory },
      });
      const timeoutSpy = vi
        .spyOn(AbortSignal, 'timeout')
        .mockImplementation(() => new AbortController().signal);
      runSideQueryMock
        .mockResolvedValueOnce({ shouldBlock: true })
        .mockResolvedValueOnce({
          thinking: 't',
          shouldBlock: false,
          reason: '',
        });

      await classifyAction(
        makeInput({
          config: makeConfig({
            classifier: {
              timeouts: {
                stage1Ms: 12_345,
                stage2Ms: 67_890,
              },
            },
          }),
        }),
      );

      expect(timeoutSpy).toHaveBeenNthCalledWith(1, 12_345);
      expect(timeoutSpy).toHaveBeenNthCalledWith(2, 67_890);
    },
  );

  it.each([false, true])(
    'falls back for too-low timeouts when mandatory thinking is %s',
    async (thinkingMandatory) => {
      resolveForModelMock.mockResolvedValueOnce({
        contentGeneratorConfig: { thinkingMandatory },
      });
      const timeoutSpy = vi
        .spyOn(AbortSignal, 'timeout')
        .mockImplementation(() => new AbortController().signal);
      runSideQueryMock
        .mockResolvedValueOnce({ shouldBlock: true })
        .mockResolvedValueOnce({
          thinking: 't',
          shouldBlock: false,
          reason: '',
        });

      await classifyAction(
        makeInput({
          config: makeConfig({
            classifier: {
              timeouts: {
                stage1Ms: 1,
                stage2Ms: 999,
              },
            },
          }),
        }),
      );

      const stage1Timeout = thinkingMandatory
        ? STAGE1_THINKING_TIMEOUT_MS
        : STAGE1_TIMEOUT_MS;
      expect(timeoutSpy).toHaveBeenNthCalledWith(1, stage1Timeout);
      expect(timeoutSpy).toHaveBeenNthCalledWith(2, STAGE2_TIMEOUT_MS);
      expect(debugLoggerMock.warn).toHaveBeenCalledWith(
        `Classifier timeout 1ms below 1000ms floor, using default ${stage1Timeout}ms`,
      );
      expect(debugLoggerMock.warn).toHaveBeenCalledWith(
        `Classifier timeout 999ms below 1000ms floor, using default ${STAGE2_TIMEOUT_MS}ms`,
      );
    },
  );

  it('counts model resolution time against an explicit stage 1 deadline', async () => {
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => new AbortController().signal);
    resolveForModelMock.mockImplementationOnce(async () => {
      vi.mocked(Date.now).mockReturnValue(750);
      return { contentGeneratorConfig: { thinkingMandatory: true } };
    });
    runSideQueryMock.mockResolvedValueOnce({ shouldBlock: false });

    await classifyAction(
      makeInput({
        config: makeConfig({ classifier: { timeouts: { stage1Ms: 2000 } } }),
      }),
    );

    expect(timeoutSpy).toHaveBeenCalledWith(1250);
  });

  it('fails closed if model resolution exhausts the stage 1 deadline', async () => {
    resolveForModelMock.mockImplementationOnce(async () => {
      vi.mocked(Date.now).mockReturnValue(2000);
      return { contentGeneratorConfig: { thinkingMandatory: true } };
    });

    const result = await classifyAction(
      makeInput({
        config: makeConfig({ classifier: { timeouts: { stage1Ms: 2000 } } }),
      }),
    );

    expect(result.shouldBlock).toBe(true);
    expect(result.unavailable).toBe(true);
    expect(runSideQueryMock).not.toHaveBeenCalled();
  });

  it('uses temperature 0 and max_output_tokens=256 with thinking disabled for stage 1', async () => {
    runSideQueryMock.mockResolvedValueOnce({ shouldBlock: false });
    await classifyAction(makeInput());
    const opts = runSideQueryMock.mock.calls[0]?.[1] as {
      config?: {
        temperature?: number;
        maxOutputTokens?: number;
        thinkingConfig?: { includeThoughts?: boolean };
      };
    };
    expect(opts.config?.temperature).toBe(0);
    expect(opts.config?.maxOutputTokens).toBe(256);
    expect(opts.config?.thinkingConfig?.includeThoughts).toBe(false);
  });

  it('uses max_output_tokens=4096 with thinking disabled for stage 2', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockResolvedValueOnce({ thinking: 't', shouldBlock: false, reason: '' });
    await classifyAction(makeInput());
    const opts = runSideQueryMock.mock.calls[1]?.[1] as {
      config?: {
        maxOutputTokens?: number;
        thinkingConfig?: { includeThoughts?: boolean };
      };
    };
    expect(opts.config?.maxOutputTokens).toBe(4096);
    // Thinking is disabled in every stage (latency-sensitive permission gate).
    expect(opts.config?.thinkingConfig?.includeThoughts).toBe(false);
  });

  it('enables API thinking only for stage 2 when configured', async () => {
    runSideQueryMock
      .mockResolvedValueOnce({ shouldBlock: true })
      .mockResolvedValueOnce({ thinking: 't', shouldBlock: false, reason: '' });

    await classifyAction(
      makeInput({
        config: makeConfig({
          classifier: {
            thinking: {
              stage2Enabled: true,
            },
          },
        }),
      }),
    );

    const stage1 = runSideQueryMock.mock.calls[0]?.[1] as {
      config?: { thinkingConfig?: { includeThoughts?: boolean } };
    };
    const stage2 = runSideQueryMock.mock.calls[1]?.[1] as {
      config?: { thinkingConfig?: { includeThoughts?: boolean } };
    };

    expect(stage1.config?.thinkingConfig?.includeThoughts).toBe(false);
    expect(stage2.config?.thinkingConfig?.includeThoughts).toBe(true);
  });

  it.each([
    ['fast-test', false, true, 'fast-test', 2048],
    ['fast-test', true, false, 'fast-test', 256],
    ['fast-test', true, undefined, 'fast-test', 256],
    [undefined, true, true, 'qwen-max-test', 2048],
    [undefined, false, false, 'qwen-max-test', 256],
  ])(
    'uses the resolved generator budget: fast=%s mainMandatory=%s resolvedMandatory=%s',
    async (fastModel, mainMandatory, resolvedMandatory, model, tokens) => {
      const timeoutSpy = vi
        .spyOn(AbortSignal, 'timeout')
        .mockImplementation(() => new AbortController().signal);
      const config = makeConfig();
      vi.spyOn(config, 'getFastModel').mockReturnValue(fastModel);
      vi.spyOn(config, 'getContentGeneratorConfig').mockReturnValue({
        ...config.getContentGeneratorConfig(),
        thinkingMandatory: mainMandatory,
      });
      resolveForModelMock.mockResolvedValueOnce({
        contentGeneratorConfig: { thinkingMandatory: resolvedMandatory },
      });
      runSideQueryMock.mockResolvedValueOnce({ shouldBlock: false });

      await classifyAction(makeInput({ config }));

      expect(resolveForModelMock).toHaveBeenCalledWith(model);
      expect(timeoutSpy).toHaveBeenCalledWith(
        resolvedMandatory === true
          ? STAGE1_THINKING_TIMEOUT_MS
          : STAGE1_TIMEOUT_MS,
      );
      expect(runSideQueryMock).toHaveBeenCalledWith(
        config,
        expect.objectContaining({
          model,
          config: expect.objectContaining({ maxOutputTokens: tokens }),
        }),
      );
    },
  );

  it('pins the default side-query model when neither model is configured', async () => {
    runSideQueryMock.mockResolvedValueOnce({ shouldBlock: false });
    const config = {
      ...makeConfig(),
      getFastModel: undefined,
      getModel: () => undefined,
    } as unknown as Config;
    await classifyAction(makeInput({ config }));
    const opts = runSideQueryMock.mock.calls[0]?.[1] as { model?: string };
    expect(resolveForModelMock).toHaveBeenCalledWith(DEFAULT_QWEN_MODEL);
    expect(opts.model).toBe(DEFAULT_QWEN_MODEL);
  });
});

// Context-overflow detection now delegated to the shared
// `isContextLengthExceededError` utility; tests covering its behavior live
// alongside that module (utils/contextLengthError.test.ts).

describe('sanitizeClassifierReason', () => {
  // Security-critical: the classifier reason is LLM-generated and gets
  // interpolated into the main model's tool-error message. A hostile
  // reason can stage a prompt injection if not sanitized.

  it('passes empty / falsy through unchanged', () => {
    expect(sanitizeClassifierReason('')).toBe('');
  });

  it('strips simple pseudo-tags like <system>...</system>', () => {
    expect(sanitizeClassifierReason('safe <system>danger</system> tail')).toBe(
      'safe danger tail',
    );
  });

  it('iterates strip until stable — no complete <...> tag can survive', () => {
    // The threat is a pseudo-tag like `<system>...` confusing the
    // downstream model. A single /<[^>]*>/g pass on a nested input
    // like `<scr<script>extra>` leaves `>` orphaned tokens which is
    // fine — what must NOT survive is any complete `<...>` pair.
    const result = sanitizeClassifierReason('<scr<script>extra>payload');
    expect(result).not.toMatch(/<[^>]*>/);
  });

  it('bounds iteration so adversarial inputs cannot create unbounded work', () => {
    // 8-iteration cap means the function is O(n) regardless of how the
    // attacker structures the input. Even a degenerate string with many
    // overlapping tags terminates promptly.
    const adversarial = '<a'.repeat(2000) + '>'.repeat(2000);
    const t0 = Date.now();
    sanitizeClassifierReason(adversarial);
    expectWithinLatencyBudget(Date.now() - t0, 1000, { poolMultiplier: 20 });
  });

  it('collapses whitespace and newlines to single spaces', () => {
    expect(sanitizeClassifierReason('line1\nline2\n\n\nline3')).toBe(
      'line1 line2 line3',
    );
  });

  it('hard-caps length at 200 characters', () => {
    expect(sanitizeClassifierReason('a'.repeat(500)).length).toBe(200);
  });

  it('trims surrounding whitespace after collapse', () => {
    expect(sanitizeClassifierReason('   leading  trailing   ')).toBe(
      'leading trailing',
    );
  });
});
