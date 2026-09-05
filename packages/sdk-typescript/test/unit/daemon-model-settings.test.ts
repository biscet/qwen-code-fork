/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { DaemonClient } from '../../src/daemon/DaemonClient.js';

describe('model settings client routing', () => {
  it('keeps all selected-workspace operations on the exact workspace', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async () => new Response('{}'));
    const client = new DaemonClient({
      baseUrl: 'http://localhost:4170',
      fetch,
    });
    const selected = client.workspaceById('second workspace');
    await selected.modelSettings('workspace');
    await selected.saveModelSettings({
      scope: 'workspace',
      model: {
        providerId: 'openai',
        modelId: 'local-coder',
        name: 'Наша модель',
        baseUrl: 'http://192.168.1.20:8080/v1',
        apiKey: 'new-key',
      },
    });
    await selected.checkModelLimits({
      scope: 'workspace',
      target: { providerId: 'openai', modelId: 'local-coder' },
    });
    await selected.deleteModelSettings({
      scope: 'workspace',
      target: { providerId: 'openai', modelId: 'local-coder' },
    });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:4170/workspaces/second%20workspace/model-settings?scope=workspace',
      'http://localhost:4170/workspaces/second%20workspace/model-settings',
      'http://localhost:4170/workspaces/second%20workspace/model-settings/check',
      'http://localhost:4170/workspaces/second%20workspace/model-settings',
    ]);
    expect(fetch.mock.calls[1][1]?.method).toBe('PUT');
    expect(fetch.mock.calls[2][1]?.method).toBe('POST');
    expect(fetch.mock.calls[3][1]?.method).toBe('DELETE');
  });

  it('uses the explicit primary aliases only on the unscoped client', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async () => new Response('{}'));
    const client = new DaemonClient({
      baseUrl: 'http://localhost:4170',
      fetch,
    });
    await client.modelSettings('user');
    await client.checkModelLimits({
      scope: 'user',
      target: { providerId: 'openai', modelId: 'local-coder' },
    });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:4170/workspace/model-settings?scope=user',
      'http://localhost:4170/workspace/model-settings/check',
    ]);
  });
});
