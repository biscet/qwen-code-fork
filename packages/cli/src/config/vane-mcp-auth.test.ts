/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import request from 'supertest';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthType, resolveModelConfig } from '@qwen-code/qwen-code-core';
import { assembleMcpServers } from './mcpServers.js';
import { loadSettings, type Settings } from './settings.js';
import { registerHomeChatRoutes } from '../serve/routes/homechat.js';
import { HomeChatStateStore } from '../serve/routes/homechat-state.js';

const fixture = vi.hoisted(() => ({ home: '' }));

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => fixture.home || actual.homedir() };
});

vi.mock('../serve/codex/codex-service.js', () => ({
  getCodexService: () => ({ models: async () => [] }),
}));

describe('Vane key and desktop research MCP authentication', () => {
  let workspace: string;
  let settingsPath: string;
  const readConfig = () =>
    loadSettings(workspace, {
      skipLoadEnvironment: true,
      workspaceTrusted: true,
    });
  const researchAuthorization = () =>
    assembleMcpServers(readConfig().merged.mcpServers, workspace)[
      'home-ai-research'
    ].headers?.['Authorization'];
  const harnessApiKey = (settings: Settings) =>
    resolveModelConfig({
      authType: AuthType.USE_OPENAI,
      modelProvider: settings.modelProviders?.['openai']?.[0],
      env: process.env,
    }).config.apiKey;
  const saveKey = () =>
    new HomeChatStateStore().update((state) => {
      state.backendApiKey = 'vane-mcp-regression-key';
    });

  beforeEach(() => {
    fixture.home = mkdtempSync(join(tmpdir(), 'vane-mcp-auth-'));
    workspace = join(fixture.home, 'workspace');
    const qwenHome = join(fixture.home, '.qwen');
    settingsPath = join(qwenHome, 'settings.json');
    mkdirSync(workspace);
    mkdirSync(qwenHome);
    vi.stubEnv('QWEN_HOME', qwenHome);
    vi.stubEnv('QWEN_RUNTIME_DIR', join(fixture.home, 'runtime'));
    vi.stubEnv('QWEN_CODE_DESKTOP', '1');
    vi.stubEnv('LOCAL_QWEN_API_KEY', 'harness-fallback-test-key');
    vi.stubEnv(
      'QWEN_CODE_SYSTEM_SETTINGS_PATH',
      join(fixture.home, 'system.json'),
    );
    vi.stubEnv(
      'QWEN_CODE_SYSTEM_DEFAULTS_PATH',
      join(fixture.home, 'defaults.json'),
    );
    const defaults = JSON.parse(
      readFileSync(
        new URL(
          '../../../desktop-shell/defaults/settings.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as Settings;
    writeFileSync(
      settingsPath,
      JSON.stringify({
        $version: 4,
        mcpServers: {
          'home-ai-research': defaults.mcpServers?.['home-ai-research'],
        },
        env: { LOCAL_QWEN_API_KEY: 'harness-fallback-test-key' },
        modelProviders: {
          openai: [{ id: 'qwen-test', envKey: 'LOCAL_QWEN_API_KEY' }],
        },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(fixture.home, { recursive: true, force: true });
    fixture.home = '';
  });

  it('uses a saved Vane key for research while preserving Harness credentials', async () => {
    expect(researchAuthorization()).toBe('Bearer harness-fallback-test-key');

    const app = express();
    app.use(express.json());
    const store = new HomeChatStateStore();
    registerHomeChatRoutes(app, {
      mutate: () => (_req, _res, next) => next(),
      stateStore: store,
    });
    const saved = await request(app).put('/homechat/connection').send({
      apiKey: 'vane-mcp-regression-key',
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      apiKeyConfigured: true,
      requiresApiKey: true,
    });
    expect(saved.text).not.toContain('vane-mcp-regression-key');
    expect(new HomeChatStateStore().read().backendApiKey).toBe(
      'vane-mcp-regression-key',
    );

    const reloaded = readConfig();
    expect(reloaded.merged.env?.['LOCAL_QWEN_API_KEY']).toBe(
      'harness-fallback-test-key',
    );
    expect(process.env['LOCAL_QWEN_API_KEY']).toBe('harness-fallback-test-key');
    expect(harnessApiKey(reloaded.merged)).toBe('harness-fallback-test-key');
    expect(
      assembleMcpServers(reloaded.merged.mcpServers, workspace)[
        'home-ai-research'
      ].headers?.['Authorization'],
    ).toBe('Bearer vane-mcp-regression-key');
  });

  it('uses the private key when no fallback key is configured', () => {
    vi.stubEnv('LOCAL_QWEN_API_KEY', undefined);
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Settings;
    delete settings.env;
    writeFileSync(settingsPath, JSON.stringify(settings));
    saveKey();
    expect(researchAuthorization()).toBe('Bearer vane-mcp-regression-key');
    expect(process.env['LOCAL_QWEN_API_KEY']).toBeUndefined();
  });

  it('preserves the configured fallback when no private Vane key exists', () => {
    expect(researchAuthorization()).toBe('Bearer harness-fallback-test-key');
  });

  it('keeps settings available when the private HomeChat state is malformed', () => {
    const directory = new HomeChatStateStore().directory;
    mkdirSync(directory, { recursive: true });
    const statePath = join(directory, 'state.json');
    writeFileSync(statePath, 'invalid json');
    expect(researchAuthorization()).toBe('Bearer harness-fallback-test-key');
    expect(harnessApiKey(readConfig().merged)).toBe(
      'harness-fallback-test-key',
    );
    expect(readFileSync(statePath, 'utf8')).toBe('invalid json');
  });

  it('preserves non-desktop MCP authentication', () => {
    vi.stubEnv('QWEN_CODE_DESKTOP', undefined);
    saveKey();
    expect(researchAuthorization()).toBe('Bearer harness-fallback-test-key');
  });

  it.each([
    {
      description: 'a different server URL',
      httpUrl: 'https://custom.example/research/mcp',
      authorization: 'Bearer ${LOCAL_QWEN_API_KEY}',
      expected: 'Bearer harness-fallback-test-key',
    },
    {
      description: 'explicit custom authentication',
      httpUrl: 'https://biscet-server.local:9454/research/mcp',
      authorization: 'Bearer custom-research-test-key',
      expected: 'Bearer custom-research-test-key',
    },
  ])('preserves $description', ({ httpUrl, authorization, expected }) => {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Settings;
    settings.mcpServers = {
      'home-ai-research': {
        httpUrl,
        headers: { Authorization: authorization },
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings));
    saveKey();
    expect(researchAuthorization()).toBe(expected);
  });
});
