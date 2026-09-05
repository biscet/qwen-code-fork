/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSettings } from '../../config/settings.js';
import {
  createWorkspaceGenerationGuard,
  createWorkspaceRegistry,
  type WorkspaceRuntime,
} from '../workspace-registry.js';
import { registerWorkspaceModelSettingsRoutes } from './workspace-model-settings.js';
import type { WorkspaceSettingsWrite } from '../workspace-service/types.js';

let taskRoot: string;
let taskHome: string;
let previousQwenHome: string | undefined;

function writeSettings(directory: string, settings: object) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'settings.json'),
    JSON.stringify(settings),
  );
}

function model(baseUrl = 'http://192.168.1.20:8080/v1') {
  return {
    id: 'local-coder',
    name: 'Наша модель',
    baseUrl,
    envKey: 'LOCAL_API_KEY',
    generationConfig: {
      contextWindowSize: 131072,
      reasoning: { effort: 'medium' },
      samplingParams: {
        temperature: 0.4,
        max_tokens: 8192,
        repetition_penalty: 1.05,
        reasoning_effort: 'medium',
        chat_template_kwargs: {
          enable_thinking: true,
          preserve_thinking: true,
        },
      },
      customHeaders: { 'X-Private': 'private-header-value' },
    },
  };
}

function makeApp(
  options: {
    trusted?: boolean;
    afterPersist?: () => void;
    fetch?: typeof fetch;
  } = {},
) {
  const runtimes = ['primary', 'secondary'].map((id, index) => {
    const workspaceCwd = path.join(taskRoot, id);
    fs.mkdirSync(workspaceCwd, { recursive: true });
    return {
      workspaceId: id,
      workspaceCwd,
      primary: index === 0,
      trusted: options.trusted ?? true,
      generationGuard: createWorkspaceGenerationGuard(),
      env: { effectiveEnv: {} },
      bridge: { publishWorkspaceEvent: vi.fn() },
      workspaceService: {
        reloadModelProviders: vi.fn().mockResolvedValue({ status: 'applied' }),
      },
    } as unknown as WorkspaceRuntime;
  });
  const registry = createWorkspaceRegistry(runtimes);
  const app = express();
  app.use(express.json());
  const mutate = vi.fn(
    () => (_req: express.Request, _res: express.Response, next: () => void) =>
      next(),
  );
  const persistSettings = vi.fn(
    async (
      workspace: string,
      writes: WorkspaceSettingsWrite[],
      assertOpen?: () => void,
    ) => {
      loadSettings(workspace, {
        skipLoadEnvironment: true,
        workspaceTrusted: true,
      }).setValues(writes, assertOpen);
      options.afterPersist?.();
    },
  );
  registerWorkspaceModelSettingsRoutes(app, {
    workspaceRegistry: registry,
    mutate,
    persistSettings,
    request: options.fetch,
  });
  return { app, runtimes, registry, mutate, persistSettings };
}

beforeEach(() => {
  taskRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'model-settings-'));
  taskHome = path.join(taskRoot, 'qwen-home');
  previousQwenHome = process.env['QWEN_HOME'];
  process.env['QWEN_HOME'] = taskHome;
  writeSettings(taskHome, {
    modelProviders: { openai: [model()] },
    env: { LOCAL_API_KEY: 'user-secret' },
  });
});

afterEach(() => {
  if (previousQwenHome === undefined) delete process.env['QWEN_HOME'];
  else process.env['QWEN_HOME'] = previousQwenHome;
  fs.rmSync(taskRoot, { recursive: true, force: true });
});

describe('model settings routes', () => {
  it.each([undefined, ''])(
    'renames an existing default-endpoint model with baseUrl=%s',
    async (baseUrl) => {
      writeSettings(taskHome, {
        modelProviders: { openai: [{ ...model(), baseUrl: undefined }] },
        env: { LOCAL_API_KEY: 'user-secret' },
      });
      const { app, runtimes } = makeApp();
      const response = await request(app)
        .put('/workspace/model-settings')
        .send({
          scope: 'user',
          target: { providerId: 'openai', modelId: 'local-coder' },
          model: {
            providerId: 'openai',
            modelId: 'local-coder',
            name: 'Новое имя',
            baseUrl,
          },
        });
      expect(response.status).toBe(200);
      const saved = JSON.parse(
        fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'),
      );
      expect(saved.modelProviders.openai[0].name).toBe('Новое имя');
      expect(saved.modelProviders.openai[0]).not.toHaveProperty('baseUrl');
      expect(saved.env.LOCAL_API_KEY).toBe('user-secret');
      expect(
        runtimes[0].workspaceService.reloadModelProviders,
      ).toHaveBeenCalledWith(expect.anything(), undefined);
    },
  );

  it('deletes an inherited model only in the selected workspace and clears its inherited selection and fallback', async () => {
    const original = model();
    writeSettings(taskHome, {
      modelProviders: {
        openai: [original, { ...model(), id: 'other', name: 'Other' }],
      },
      env: { LOCAL_API_KEY: 'user-secret' },
      model: { name: original.id, baseUrl: original.baseUrl },
      modelFallbacks: 'local-coder,other',
    });
    const { app, runtimes } = makeApp();
    const response = await request(app)
      .delete('/workspaces/secondary/model-settings')
      .send({
        scope: 'workspace',
        target: {
          providerId: 'openai',
          modelId: original.id,
          baseUrl: original.baseUrl,
        },
      });
    expect(response.status).toBe(200);
    expect(
      response.body.models.map((entry: { modelId: string }) => entry.modelId),
    ).toEqual(['other']);
    const scoped = JSON.parse(
      fs.readFileSync(
        path.join(runtimes[1].workspaceCwd, '.qwen', 'settings.json'),
        'utf8',
      ),
    );
    expect(scoped.model).toMatchObject({ name: '', baseUrl: '' });
    expect(scoped.modelFallbacks).toBe('other');
    expect(
      JSON.parse(fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'))
        .modelProviders.openai,
    ).toHaveLength(2);
    expect(
      runtimes[0].workspaceService.reloadModelProviders,
    ).not.toHaveBeenCalled();
    expect(
      runtimes[1].workspaceService.reloadModelProviders,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'DELETE /workspaces/:workspace/model-settings',
      }),
      undefined,
    );
  });

  it('keeps empty provider arrays on user deletion and preserves independently owned workspace models', async () => {
    const original = model();
    writeSettings(taskHome, {
      modelProviders: { openai: [original] },
      env: { LOCAL_API_KEY: 'user-secret' },
      model: { name: original.id, baseUrl: original.baseUrl },
    });
    const { app, runtimes } = makeApp();
    const scoped = {
      modelProviders: { openai: [{ ...original, name: 'Workspace model' }] },
      model: { name: original.id, baseUrl: original.baseUrl },
    };
    writeSettings(path.join(runtimes[1].workspaceCwd, '.qwen'), scoped);
    const response = await request(app)
      .delete('/workspaces/secondary/model-settings')
      .send({
        scope: 'user',
        target: {
          providerId: 'openai',
          modelId: original.id,
          baseUrl: original.baseUrl,
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.models).toEqual([]);
    const user = JSON.parse(
      fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'),
    );
    expect(user.modelProviders.openai).toEqual([]);
    expect(user.model).toMatchObject({ name: '', baseUrl: '' });
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(runtimes[1].workspaceCwd, '.qwen', 'settings.json'),
          'utf8',
        ),
      ),
    ).toMatchObject(scoped);
  });

  it('refuses an inexact delete without changing settings', async () => {
    const { app, persistSettings } = makeApp();
    const response = await request(app)
      .delete('/workspace/model-settings')
      .send({
        scope: 'user',
        target: {
          providerId: 'openai',
          modelId: 'local-coder',
          baseUrl: 'https://wrong.example/v1',
        },
      });
    expect(response.status).toBe(404);
    expect(persistSettings).not.toHaveBeenCalled();
  });

  it('shows inherited user models and creates a workspace copy when editing them', async () => {
    const { app, runtimes } = makeApp();
    const original = model();
    const read = await request(app).get(
      '/workspaces/secondary/model-settings?scope=workspace',
    );
    expect(read.body.models[0]).toMatchObject({
      name: 'Наша модель',
      hasApiKey: true,
    });
    const saved = await request(app)
      .put('/workspaces/secondary/model-settings')
      .send({
        scope: 'workspace',
        target: {
          providerId: 'openai',
          modelId: original.id,
          baseUrl: original.baseUrl,
        },
        model: {
          providerId: 'openai',
          modelId: original.id,
          name: 'Только второй проект',
          baseUrl: original.baseUrl,
        },
      });
    expect(saved.status).toBe(200);
    expect(saved.body.models[0].name).toBe('Только второй проект');
    expect(
      JSON.parse(fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'))
        .modelProviders.openai[0].name,
    ).toBe('Наша модель');
    expect(
      runtimes[0].workspaceService.reloadModelProviders,
    ).not.toHaveBeenCalled();
  });

  it('rotates the credential slot and removes old headers when moving to another service', async () => {
    const { app, runtimes } = makeApp();
    const original = model();
    const response = await request(app)
      .put('/workspace/model-settings')
      .send({
        scope: 'user',
        target: {
          providerId: 'openai',
          modelId: original.id,
          baseUrl: original.baseUrl,
        },
        model: {
          providerId: 'openai',
          modelId: original.id,
          name: original.name,
          baseUrl: 'https://new.example/v1',
          envKey: original.envKey,
          apiKey: 'replacement-secret',
        },
      });
    expect(response.status).toBe(200);
    const saved = JSON.parse(
      fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'),
    );
    const entry = saved.modelProviders.openai[0];
    expect(entry.envKey).not.toBe('LOCAL_API_KEY');
    expect(saved.env[entry.envKey]).toBe('replacement-secret');
    expect(saved.env.LOCAL_API_KEY).toBe('user-secret');
    expect(entry.generationConfig.customHeaders).toBeUndefined();
    expect(
      runtimes[0].workspaceService.reloadModelProviders,
    ).toHaveBeenCalledWith(expect.anything(), {
      previous: {
        authType: 'openai',
        modelId: original.id,
        baseUrl: original.baseUrl,
      },
      next: {
        authType: 'openai',
        modelId: original.id,
        baseUrl: 'https://new.example/v1',
      },
    });
  });

  it('rejects unsupported Qwen efforts and avoids Qwen template parameters for generic endpoints', async () => {
    const { app } = makeApp();
    const base = {
      providerId: 'openai',
      name: 'Model',
      apiKey: 'new-secret',
      baseUrl: 'https://other.example/v1',
    };
    const rejected = await request(app)
      .put('/workspace/model-settings')
      .send({
        scope: 'user',
        model: {
          ...base,
          modelId: 'Qwen/Qwen3.8-27B',
          reasoningEffort: 'high',
        },
      });
    expect(rejected.status).toBe(400);
    const generic = await request(app)
      .put('/workspace/model-settings')
      .send({
        scope: 'user',
        model: {
          ...base,
          modelId: 'generic-reasoner',
          reasoningEffort: 'high',
        },
      });
    expect(generic.status).toBe(200);
    const saved = JSON.parse(
      fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'),
    ).modelProviders.openai[1];
    expect(saved.generationConfig.reasoning).toEqual({ effort: 'high' });
    expect(
      saved.generationConfig.samplingParams?.chat_template_kwargs,
    ).toBeUndefined();
  });

  it('reads the selected workspace without exposing secrets or making a provider request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const { app, runtimes } = makeApp({ fetch });
    writeSettings(path.join(runtimes[1].workspaceCwd, '.qwen'), {
      modelProviders: { openai: [{ ...model(), name: 'Второй проект' }] },
      env: { LOCAL_API_KEY: 'workspace-secret' },
    });
    const selected = await request(app).get(
      '/workspaces/secondary/model-settings',
    );
    expect(selected.status).toBe(200);
    expect(selected.body).toMatchObject({
      scope: 'workspace',
      workspaceCwd: runtimes[1].workspaceCwd,
      models: [
        {
          name: 'Второй проект',
          hasApiKey: true,
          thinking: true,
          reasoningEffort: 'medium',
        },
      ],
    });
    expect(JSON.stringify(selected.body)).not.toMatch(
      /user-secret|workspace-secret|private-header-value/,
    );
    expect(fetch).not.toHaveBeenCalled();
    const primary = await request(app).get('/workspace/model-settings');
    expect(primary.body.models[0].name).toBe('Наша модель');
  });

  it('edits one model, retains keys and unknown generation fields, and syncs user settings to all runtimes', async () => {
    const { app, runtimes, mutate } = makeApp();
    const original = model();
    const response = await request(app)
      .put('/workspaces/secondary/model-settings')
      .send({
        scope: 'user',
        target: {
          providerId: 'openai',
          modelId: original.id,
          baseUrl: original.baseUrl,
        },
        model: {
          providerId: 'openai',
          modelId: original.id,
          name: 'Qwen дома',
          baseUrl: original.baseUrl,
          apiKey: '',
          temperature: 0,
          topP: 0.8,
          thinking: false,
          reasoningEffort: 'high',
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.runtimeSync.status).toBe('applied');
    const saved = JSON.parse(
      fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'),
    );
    expect(saved.env.LOCAL_API_KEY).toBe('user-secret');
    expect(saved.modelProviders.openai[0]).toMatchObject({
      name: 'Qwen дома',
      generationConfig: {
        reasoning: false,
        contextWindowSize: 131072,
        customHeaders: { 'X-Private': 'private-header-value' },
        samplingParams: {
          temperature: 0,
          top_p: 0.8,
          repetition_penalty: 1.05,
          chat_template_kwargs: {
            enable_thinking: false,
            preserve_thinking: true,
            reasoning_effort: 'high',
          },
        },
      },
    });
    for (const runtime of runtimes) {
      expect(
        runtime.workspaceService.reloadModelProviders,
      ).toHaveBeenCalledOnce();
      expect(
        JSON.stringify(
          vi.mocked(runtime.bridge.publishWorkspaceEvent).mock.calls,
        ),
      ).not.toContain('user-secret');
    }
    expect(mutate).toHaveBeenCalledWith({ strict: true });
  });

  it('writes workspace models only to the selected workspace', async () => {
    const { app, runtimes } = makeApp();
    const response = await request(app)
      .put('/workspaces/secondary/model-settings')
      .send({
        scope: 'workspace',
        model: {
          providerId: 'openai',
          modelId: 'Qwen/Qwen3.8-27B',
          name: 'ModelScope',
          baseUrl: 'https://api-inference.modelscope.cn/v1',
          apiKey: 'modelscope-secret',
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.models[1]).toMatchObject({
      name: 'ModelScope',
      hasApiKey: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('modelscope-secret');
    expect(
      fs.existsSync(
        path.join(runtimes[0].workspaceCwd, '.qwen', 'settings.json'),
      ),
    ).toBe(false);
    expect(
      runtimes[0].workspaceService.reloadModelProviders,
    ).not.toHaveBeenCalled();
    expect(
      runtimes[1].workspaceService.reloadModelProviders,
    ).toHaveBeenCalledOnce();
    expect(
      JSON.parse(fs.readFileSync(path.join(taskHome, 'settings.json'), 'utf8'))
        .modelProviders.openai[0].name,
    ).toBe('Наша модель');
  });

  it('rejects endpoint changes without a new key and never falls back to a same-ID model', async () => {
    const { app, persistSettings } = makeApp();
    const original = model();
    const input = {
      scope: 'user',
      target: {
        providerId: 'openai',
        modelId: original.id,
        baseUrl: original.baseUrl,
      },
      model: {
        providerId: 'openai',
        modelId: original.id,
        name: original.name,
        baseUrl: 'https://other.example/v1',
      },
    };
    expect(
      (await request(app).put('/workspace/model-settings').send(input)).status,
    ).toBe(400);
    input.target.baseUrl = 'https://missing.example/v1';
    expect(
      (await request(app).put('/workspace/model-settings').send(input)).status,
    ).toBe(404);
    expect(persistSettings).not.toHaveBeenCalled();
  });

  it('fails closed for unknown, untrusted and closed workspaces', async () => {
    const { app, runtimes, persistSettings } = makeApp();
    expect(
      (await request(app).get('/workspaces/missing/model-settings')).status,
    ).toBe(400);
    runtimes[1].generationGuard?.close();
    expect(
      (await request(app).get('/workspaces/secondary/model-settings')).status,
    ).toBe(503);
    const untrusted = makeApp({ trusted: false });
    expect(
      (await request(untrusted.app).get('/workspace/model-settings')).status,
    ).toBe(403);
    expect(persistSettings).not.toHaveBeenCalled();
  });

  it('returns 503 if the generation closes after persistence', async () => {
    const { app, runtimes } = makeApp({
      afterPersist: () => runtimes[1].generationGuard?.close(),
    });
    const response = await request(app)
      .put('/workspaces/secondary/model-settings')
      .send({
        scope: 'workspace',
        model: {
          providerId: 'openai',
          modelId: 'new',
          name: 'New',
          baseUrl: 'https://model.example/v1',
          apiKey: 'new-key',
        },
      });
    expect(response.status).toBe(503);
    expect(runtimes[1].bridge.publishWorkspaceEvent).not.toHaveBeenCalled();
  });

  it('checks only the exact saved provider and reports ModelScope header values', async () => {
    const providerFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: {
          'modelscope-ratelimit-requests-limit': '2000',
          'modelscope-ratelimit-requests-remaining': '1987',
          'modelscope-ratelimit-model-requests-limit': '500',
          'modelscope-ratelimit-model-requests-remaining': '490',
        },
      }),
    );
    writeSettings(taskHome, {
      modelProviders: {
        openai: [model('https://api-inference.modelscope.cn/v1')],
      },
      env: { LOCAL_API_KEY: 'quota-secret' },
    });
    const { app } = makeApp({ fetch: providerFetch });
    const response = await request(app)
      .post('/workspaces/secondary/model-settings/check')
      .send({
        scope: 'user',
        target: {
          providerId: 'openai',
          modelId: 'local-coder',
          baseUrl: 'https://api-inference.modelscope.cn/v1',
        },
      });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      windows: [
        { label: 'Аккаунт', period: 'day', limit: 2000, remaining: 1987 },
        { label: 'Модель', period: 'day', limit: 500, remaining: 490 },
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain('quota-secret');
    expect(providerFetch).toHaveBeenCalledWith(
      'https://api-inference.modelscope.cn/v1/chat/completions',
      expect.objectContaining({
        redirect: 'error',
        body: JSON.stringify({
          model: 'local-coder',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
          stream: false,
        }),
      }),
    );
  });

  it('does not call arbitrary endpoints or invent missing quota values', async () => {
    const providerFetch = vi.fn<typeof fetch>();
    const { app } = makeApp({ fetch: providerFetch });
    const response = await request(app)
      .post('/workspace/model-settings/check')
      .send({
        scope: 'user',
        target: {
          providerId: 'openai',
          modelId: 'local-coder',
          baseUrl: model().baseUrl,
        },
      });
    expect(response.body).toMatchObject({ status: 'unavailable', windows: [] });
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
