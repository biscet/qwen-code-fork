/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import {
  resolveProviderProtocol,
  REASONING_EFFORT_TIERS,
  type ModelProvidersConfig,
  type ReasoningEffort,
} from '@qwen-code/qwen-code-core';
import type { LoadedSettings } from '../config/settings.js';
import { SettingScope } from '../config/settings.js';
import { getModelProvidersOwnerScope } from '../config/modelProvidersScope.js';
import type {
  WorkspaceSettingsWrite,
  ServeModelProviderReplacement,
} from './workspace-service/types.js';
import { getModelConfiguration } from '../acp-integration/model-configuration.js';

type ModelConfig = ModelProvidersConfig[string][number];

function supportedModelEfforts(
  model: ModelConfig,
): readonly ReasoningEffort[] | undefined {
  const reasoning = getModelConfiguration(
    model.id,
    model.generationConfig,
  )?.reasoning;
  return reasoning && 'efforts' in reasoning ? reasoning.efforts : undefined;
}

export type ModelSettingsScope = 'user' | 'workspace';
export interface ModelSettingsTarget {
  providerId: string;
  modelId: string;
  baseUrl?: string;
}
export interface ModelSettingsFields extends ModelSettingsTarget {
  name: string;
  envKey?: string;
  contextWindowSize?: number;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  thinking?: boolean;
  reasoningEffort?: ReasoningEffort;
}
export interface ModelSettingsEntry extends ModelSettingsFields {
  authType: string;
  hasApiKey: boolean;
  supportedEfforts?: readonly ReasoningEffort[];
}
export interface ModelSettingsSnapshot {
  v: 1;
  workspaceCwd: string;
  scope: ModelSettingsScope;
  models: ModelSettingsEntry[];
}
export interface ModelSettingsSaveRequest {
  scope: ModelSettingsScope;
  target?: ModelSettingsTarget;
  model: ModelSettingsFields & { apiKey?: string };
}
export interface ModelLimitsCheckResult {
  checkedAt: string;
  status: 'ok' | 'limited' | 'unavailable';
  windows: Array<{
    label: string;
    limit?: number;
    remaining?: number;
    resetAt?: string;
    period?: 'day' | 'week' | 'minute';
  }>;
  message?: string;
}

export class ModelSettingsInputError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseModelScope(
  value: unknown,
  settings?: LoadedSettings,
): ModelSettingsScope {
  if (value === 'user' || value === 'workspace') return value;
  if (value === undefined && settings) {
    return getModelProvidersOwnerScope(settings) === SettingScope.Workspace
      ? 'workspace'
      : 'user';
  }
  throw new ModelSettingsInputError(
    'Выберите настройки пользователя или проекта.',
  );
}

export function settingScope(scope: ModelSettingsScope): SettingScope {
  return scope === 'workspace' ? SettingScope.Workspace : SettingScope.User;
}

function field(value: unknown, name: string, required = true): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > 4096) {
    throw new ModelSettingsInputError(`Некорректное поле: ${name}.`);
  }
  const trimmed = value.trim();
  if (
    (required && !trimmed) ||
    [...trimmed].some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new ModelSettingsInputError(`Некорректное поле: ${name}.`);
  }
  return trimmed;
}

export function publicModelUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function parseModelTarget(value: unknown): ModelSettingsTarget {
  const input = record(value);
  const providerId = field(input['providerId'], 'provider ID');
  if (
    !/^[a-zA-Z0-9_-]+$/.test(providerId) ||
    ['__proto__', 'constructor', 'prototype'].includes(providerId)
  ) {
    throw new ModelSettingsInputError('Некорректный ID провайдера.');
  }
  if (
    input['baseUrl'] !== undefined &&
    input['baseUrl'] !== '' &&
    !publicModelUrl(field(input['baseUrl'], 'base URL'))
  ) {
    throw new ModelSettingsInputError('Некорректный адрес API.');
  }
  return {
    providerId,
    modelId: field(input['modelId'], 'model ID'),
    ...(input['baseUrl'] !== undefined
      ? { baseUrl: field(input['baseUrl'], 'base URL', false) }
      : {}),
  };
}

export function findSettingsModel(
  providers: ModelProvidersConfig,
  target: ModelSettingsTarget,
): { model: ModelConfig; index: number } {
  const matches = (providers[target.providerId] ?? []).flatMap(
    (model, index) =>
      model.id === target.modelId &&
      publicModelUrl(model.baseUrl) === publicModelUrl(target.baseUrl)
        ? [{ model, index }]
        : [],
  );
  if (matches.length !== 1) {
    throw new ModelSettingsInputError(
      matches.length
        ? 'Найдено несколько одинаковых подключений. Уточните настройки.'
        : 'Модель не найдена. Обновите список моделей.',
      matches.length ? 409 : 404,
    );
  }
  return matches[0];
}

export function modelSettingsSnapshot(
  settings: LoadedSettings,
  workspaceCwd: string,
  scope: ModelSettingsScope,
  env: Readonly<NodeJS.ProcessEnv>,
): ModelSettingsSnapshot {
  const scoped = settings.forScope(settingScope(scope)).settings;
  const models: ModelSettingsEntry[] = [];
  for (const [providerId, entries] of Object.entries(
    scoped.modelProviders ??
      (scope === 'workspace' ? settings.merged.modelProviders : undefined) ??
      {},
  )) {
    for (const model of entries) {
      const config = model.generationConfig ?? {};
      const sampling = config.samplingParams ?? {};
      const template = {
        ...record(sampling['chat_template_kwargs']),
        ...record(config.extra_body?.['chat_template_kwargs']),
      };
      const rawEffort =
        (config.reasoning && config.reasoning.effort) ||
        sampling['reasoning_effort'] ||
        template['reasoning_effort'];
      const effort = REASONING_EFFORT_TIERS.includes(
        rawEffort as ReasoningEffort,
      )
        ? (rawEffort as ReasoningEffort)
        : undefined;
      const thinking =
        template['enable_thinking'] ?? config.extra_body?.['enable_thinking'];
      models.push({
        providerId,
        authType:
          resolveProviderProtocol(
            providerId,
            settings.merged.providerProtocol,
          ) ?? providerId,
        modelId: model.id,
        name: model.name ?? model.id,
        baseUrl: publicModelUrl(model.baseUrl),
        envKey: model.envKey,
        supportedEfforts: supportedModelEfforts(model),
        hasApiKey: !!(
          model.envKey &&
          (scoped.env?.[model.envKey] ||
            (scope === 'workspace' && settings.merged.env?.[model.envKey]) ||
            ((scope === 'workspace' ||
              parseModelScope(undefined, settings) === scope) &&
              env[model.envKey]))
        ),
        contextWindowSize: config.contextWindowSize,
        maxTokens: sampling.max_tokens,
        temperature: sampling.temperature,
        topP: sampling.top_p,
        ...(typeof thinking === 'boolean'
          ? { thinking }
          : config.reasoning === false
            ? { thinking: false }
            : {}),
        ...(effort ? { reasoningEffort: effort } : {}),
      });
    }
  }
  return { v: 1, workspaceCwd, scope, models };
}

export function buildModelSettingsWrites(
  settings: LoadedSettings,
  body: Record<string, unknown>,
): {
  scope: ModelSettingsScope;
  writes: WorkspaceSettingsWrite[];
  replacement?: ServeModelProviderReplacement;
} {
  const scope = parseModelScope(body['scope']);
  const destination = settingScope(scope);
  const scoped = settings.forScope(destination).settings;
  const providers =
    scoped.modelProviders ??
    (scope === 'workspace' ? settings.merged.modelProviders : undefined) ??
    {};
  const input = record(body['model']);
  const identity = parseModelTarget(input);
  const target =
    body['target'] === undefined ? undefined : parseModelTarget(body['target']);
  const previous = target ? findSettingsModel(providers, target) : undefined;
  if (
    (!previous && identity.providerId !== 'openai') ||
    (target && identity.providerId !== target.providerId)
  ) {
    throw new ModelSettingsInputError(
      'Новые подключения используют протокол OpenAI-compatible.',
    );
  }
  const name = field(input['name'], 'display name');
  const baseUrl = field(
    input['baseUrl'],
    'base URL',
    !previous || !!previous.model.baseUrl,
  );
  const normalizedUrl = publicModelUrl(baseUrl);
  const url = normalizedUrl ? new URL(baseUrl) : undefined;
  const keepsDefaultEndpoint =
    !!previous && !previous.model.baseUrl && !baseUrl;
  if (
    !keepsDefaultEndpoint &&
    (!url || url.username || url.password || url.search || url.hash)
  ) {
    throw new ModelSettingsInputError(
      'Укажите HTTP(S) адрес API без ключей, логина и параметров запроса.',
    );
  }
  const apiKey = field(input['apiKey'], 'API key', false);
  if (!previous && !apiKey)
    throw new ModelSettingsInputError(
      'Введите API-ключ для нового подключения.',
    );
  const oldUrl = previous?.model.baseUrl;
  const endpointChanged =
    !!previous && publicModelUrl(oldUrl) !== normalizedUrl;
  if (endpointChanged && !apiKey) {
    throw new ModelSettingsInputError(
      'При смене адреса API введите ключ заново.',
    );
  }
  let envKey =
    field(input['envKey'], 'environment variable', false) ||
    previous?.model.envKey;
  if (endpointChanged && envKey === previous?.model.envKey) envKey = undefined;
  if (
    envKey &&
    (!/^[A-Z_][A-Z0-9_]*$/.test(envKey) ||
      !/(?:^|_)(?:API_KEY|TOKEN|SECRET|KEY)(?:_|$)/.test(envKey))
  ) {
    throw new ModelSettingsInputError(
      'Укажите имя переменной заглавными буквами, содержащее API_KEY, TOKEN, SECRET или KEY.',
    );
  }
  if (!envKey && apiKey) {
    envKey = `QWEN_MODEL_${createHash('sha256')
      .update(normalizedUrl ?? `${identity.providerId}:default`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase()}_API_KEY`;
  }
  if (previous?.model.envKey && envKey !== previous.model.envKey && !apiKey) {
    throw new ModelSettingsInputError(
      'При смене переменной окружения введите API-ключ заново.',
    );
  }
  const generationConfig = structuredClone(
    previous?.model.generationConfig ?? {},
  );
  if (
    endpointChanged &&
    (!publicModelUrl(oldUrl) ||
      new URL(publicModelUrl(oldUrl)!).origin !== url?.origin)
  ) {
    delete generationConfig.customHeaders;
  }
  const sampling = { ...generationConfig.samplingParams };
  const numeric = (
    key: string,
    min: number,
    max: number,
    integer = false,
  ): number | undefined => {
    const value = input[key];
    if (value === undefined || value === '') return undefined;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    ) {
      throw new ModelSettingsInputError(`Некорректное поле: ${key}.`);
    }
    return value;
  };
  const context = numeric('contextWindowSize', 1, 10_000_000, true);
  if (context !== undefined) generationConfig.contextWindowSize = context;
  const maxTokens = numeric('maxTokens', 1, 10_000_000, true);
  if (maxTokens !== undefined) sampling.max_tokens = maxTokens;
  const temperature = numeric('temperature', 0, 2);
  if (temperature !== undefined) sampling.temperature = temperature;
  const topP = numeric('topP', 0, 1);
  if (topP !== undefined) sampling.top_p = topP;
  const thinking = input['thinking'];
  if (thinking !== undefined && typeof thinking !== 'boolean')
    throw new ModelSettingsInputError('Некорректное значение thinking.');
  const effort = input['reasoningEffort'];
  if (
    effort !== undefined &&
    !REASONING_EFFORT_TIERS.includes(effort as ReasoningEffort)
  )
    throw new ModelSettingsInputError('Некорректный уровень размышления.');
  const supportedEfforts = supportedModelEfforts({
    id: identity.modelId,
    generationConfig,
  });
  if (
    effort !== undefined &&
    supportedEfforts &&
    !supportedEfforts.includes(effort as ReasoningEffort)
  )
    throw new ModelSettingsInputError(
      'Модель не поддерживает этот уровень размышления.',
    );
  if (typeof thinking === 'boolean' || effort !== undefined) {
    if (typeof thinking === 'boolean')
      generationConfig.reasoning = thinking
        ? generationConfig.reasoning || {}
        : false;
    if (effort !== undefined && generationConfig.reasoning !== false)
      generationConfig.reasoning = {
        ...generationConfig.reasoning,
        effort: effort as ReasoningEffort,
      };
    const hasTemplate =
      'chat_template_kwargs' in sampling ||
      (!!generationConfig.extra_body &&
        'chat_template_kwargs' in generationConfig.extra_body);
    const qwenTemplate =
      hasTemplate ||
      /^(?:qwen\/)?qwen3\.8-27b(?:-free|:free)?$/i.test(identity.modelId);
    if (qwenTemplate) {
      const template = { ...record(sampling['chat_template_kwargs']) };
      if (typeof thinking === 'boolean') template['enable_thinking'] = thinking;
      if (effort !== undefined) {
        sampling['reasoning_effort'] = effort;
        template['reasoning_effort'] = effort;
      }
      sampling['chat_template_kwargs'] = template;
      if (
        generationConfig.extra_body &&
        'chat_template_kwargs' in generationConfig.extra_body
      ) {
        generationConfig.extra_body['chat_template_kwargs'] = {
          ...record(generationConfig.extra_body['chat_template_kwargs']),
          ...template,
        };
      }
    }
    if (
      typeof thinking === 'boolean' &&
      generationConfig.extra_body &&
      'enable_thinking' in generationConfig.extra_body
    )
      generationConfig.extra_body['enable_thinking'] = thinking;
  }
  if (Object.keys(sampling).length) generationConfig.samplingParams = sampling;
  const model: ModelConfig = {
    ...previous?.model,
    id: identity.modelId,
    name,
    baseUrl: normalizedUrl,
    ...(envKey ? { envKey } : {}),
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  };
  const models = [...(providers[identity.providerId] ?? [])];
  if (
    models.some(
      (candidate, index) =>
        index !== previous?.index &&
        candidate.id === model.id &&
        publicModelUrl(candidate.baseUrl) === normalizedUrl,
    )
  ) {
    throw new ModelSettingsInputError(
      'Такое подключение модели уже существует.',
      409,
    );
  }
  if (previous) models[previous.index] = model;
  else models.push(model);
  const writes: WorkspaceSettingsWrite[] = [
    ...(apiKey && envKey
      ? [{ scope: destination, key: `env.${envKey}`, value: apiKey }]
      : []),
    {
      scope: destination,
      key: 'modelProviders',
      value: { ...providers, [identity.providerId]: models },
    },
  ];
  const active = settings.merged.model;
  if (
    previous &&
    active?.name === previous.model.id &&
    (!active.baseUrl ||
      publicModelUrl(active.baseUrl) ===
        publicModelUrl(previous.model.baseUrl)) &&
    (!settings.merged.security?.auth?.selectedType ||
      settings.merged.security.auth.selectedType ===
        resolveProviderProtocol(
          identity.providerId,
          settings.merged.providerProtocol,
        ))
  ) {
    writes.push(
      { scope: destination, key: 'model.name', value: model.id },
      { scope: destination, key: 'model.baseUrl', value: model.baseUrl },
    );
  }
  const authType =
    resolveProviderProtocol(
      identity.providerId,
      settings.merged.providerProtocol,
    ) ?? identity.providerId;
  const replacement =
    previous &&
    (previous.model.id !== model.id ||
      publicModelUrl(previous.model.baseUrl) !== model.baseUrl)
      ? {
          previous: {
            authType,
            modelId: previous.model.id,
            baseUrl: previous.model.baseUrl,
          },
          next: { authType, modelId: model.id, baseUrl: model.baseUrl },
        }
      : undefined;
  return { scope, writes, ...(replacement ? { replacement } : {}) };
}

export function buildModelSettingsDeleteWrites(
  settings: LoadedSettings,
  body: Record<string, unknown>,
): {
  scope: ModelSettingsScope;
  writes: WorkspaceSettingsWrite[];
  replacement?: undefined;
} {
  const scope = parseModelScope(body['scope']);
  const destination = settingScope(scope);
  const scoped = settings.forScope(destination).settings;
  const providers =
    scoped.modelProviders ??
    (scope === 'workspace' ? settings.merged.modelProviders : undefined) ??
    {};
  const target = parseModelTarget(body['target']);
  const removed = findSettingsModel(providers, target);
  const next = {
    ...providers,
    [target.providerId]: providers[target.providerId].filter(
      (_, index) => index !== removed.index,
    ),
  };
  const writes: WorkspaceSettingsWrite[] = [
    { scope: destination, key: 'modelProviders', value: next },
  ];
  const authType =
    resolveProviderProtocol(
      target.providerId,
      settings.merged.providerProtocol,
    ) ?? target.providerId;
  const stillConfigured = Object.values(next).some((models) =>
    models.some((model) => model.id === target.modelId),
  );
  const cleanup = (writeScope: SettingScope, selection: typeof scoped) => {
    const active = selection.model;
    if (
      active?.name === removed.model.id &&
      (!active.baseUrl ||
        publicModelUrl(active.baseUrl) ===
          publicModelUrl(removed.model.baseUrl)) &&
      (!selection.security?.auth?.selectedType ||
        selection.security.auth.selectedType === authType)
    ) {
      writes.push(
        { scope: writeScope, key: 'model.name', value: '' },
        { scope: writeScope, key: 'model.baseUrl', value: '' },
      );
    }
    if (!stillConfigured && typeof selection.modelFallbacks === 'string') {
      const ids = selection.modelFallbacks
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const kept = ids.filter((id) => id !== target.modelId);
      if (ids.length !== kept.length)
        writes.push({
          scope: writeScope,
          key: 'modelFallbacks',
          value: kept.join(','),
        });
    }
  };
  cleanup(destination, scope === 'workspace' ? settings.merged : scoped);
  if (
    scope === 'user' &&
    settings.isTrusted &&
    settings.workspace.settings.modelProviders === undefined
  )
    cleanup(SettingScope.Workspace, settings.workspace.settings);
  return { scope, writes };
}

export async function checkModelLimits(
  model: ModelConfig,
  apiKey: string | undefined,
  request: typeof fetch = fetch,
): Promise<ModelLimitsCheckResult> {
  const result: ModelLimitsCheckResult = {
    checkedAt: new Date().toISOString(),
    status: 'unavailable',
    windows: [],
  };
  const endpoint = publicModelUrl(model.baseUrl);
  if (
    ![
      'https://api-inference.modelscope.cn/v1',
      'https://api.orcarouter.ai/v1',
    ].includes(endpoint ?? '')
  ) {
    return {
      ...result,
      message: 'Проверка лимитов доступна для ModelScope и OrcaRouter.',
    };
  }
  if (!apiKey) return { ...result, message: 'Сначала сохраните API-ключ.' };
  try {
    const response = await request(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        stream: false,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
    const value = (name: string): number | undefined => {
      const raw = response.headers.get(name);
      if (raw === null || raw.trim() === '') return undefined;
      const number = Number(raw);
      return Number.isFinite(number) && number >= 0 ? number : undefined;
    };
    const headers = endpoint!.includes('modelscope')
      ? [
          {
            label: 'Аккаунт',
            prefix: 'modelscope-ratelimit-requests',
            period: 'day' as const,
          },
          {
            label: 'Модель',
            prefix: 'modelscope-ratelimit-model-requests',
            period: 'day' as const,
          },
        ]
      : [{ label: 'Запросы', prefix: 'x-ratelimit', period: undefined }];
    for (const window of headers) {
      const limit = value(`${window.prefix}-limit`);
      const remaining = value(`${window.prefix}-remaining`);
      if (limit !== undefined || remaining !== undefined)
        result.windows.push({
          label: window.label,
          limit,
          remaining,
          ...(window.period ? { period: window.period } : {}),
        });
    }
    await response.body?.cancel();
    result.status =
      response.status === 429 ? 'limited' : response.ok ? 'ok' : 'unavailable';
    result.message =
      response.status === 401 || response.status === 403
        ? 'Сервис отклонил API-ключ или доступ к модели.'
        : !response.ok
          ? `Сервис ответил HTTP ${response.status}.`
          : result.windows.length
            ? 'Остаток получен из заголовков ответа сервиса.'
            : 'Сервис принял запрос, но не сообщил остаток дневной или недельной квоты.';
    return result;
  } catch {
    return {
      ...result,
      message: 'Не удалось проверить лимиты сервиса. Повторите позже.',
    };
  }
}
