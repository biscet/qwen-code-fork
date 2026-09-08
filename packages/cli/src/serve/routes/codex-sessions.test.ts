import express from 'express';
import request from 'supertest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  WorkspaceRegistry,
  WorkspaceRuntime,
} from '../workspace-registry.js';

const mock = vi.hoisted(() => ({
  homeDir: '',
  request: vi.fn(),
  qwenBatch: vi.fn(),
}));
vi.mock('../codex/codex-service.js', () => ({
  getCodexService: () => ({
    homeDir: mock.homeDir,
    models: async () => [
      {
        id: 'catalog-id',
        model: 'codex-model',
        isDefault: true,
        defaultReasoningEffort: 'high',
        supportedReasoningEfforts: [
          { reasoningEffort: 'none' },
          { reasoningEffort: 'high' },
        ],
      },
    ],
    refresh: async () => ({}),
    onLogout: () => () => {},
    appServer: {
      request: mock.request,
      onNotification: () => () => {},
      onDisconnect: () => () => {},
      onRequest: () => () => {},
    },
  }),
}));
vi.mock('../codex/codex-tools.js', () => ({
  CodexTools: {
    create: async () => ({ declarations: [], dispose: async () => {} }),
  },
}));
vi.mock('../server/session-list.js', () => ({
  listWorkspaceSessionsForResponse: async () => ({ sessions: [] }),
  searchWorkspaceSessionsForResponse: async () => ({ results: [] }),
}));
import { registerCodexSessionRoutes } from './codex-sessions.js';

describe('Codex session REST contracts', () => {
  let app: express.Application;
  let manager: ReturnType<typeof registerCodexSessionRoutes>;
  let registry: WorkspaceRegistry;
  beforeEach(() => {
    mock.homeDir = mkdtempSync(path.join(os.tmpdir(), 'codex-routes-'));
    mock.request
      .mockReset()
      .mockImplementation(async (method: string) =>
        method === 'thread/start' ? { thread: { id: 'thread-1' } } : {},
      );
    const runtime = {
      workspaceId: 'workspace-a',
      workspaceCwd: '/workspace/a',
      trusted: true,
    } as WorkspaceRuntime;
    const entry = {
      workspaceId: runtime.workspaceId,
      workspaceCwd: runtime.workspaceCwd,
      state: 'active',
      current: { runtime },
    };
    registry = {
      primaryEntry: entry,
      listAll: () => [],
      getEntryByWorkspaceId: (id: string) =>
        id === runtime.workspaceId ? entry : undefined,
      getEntryByWorkspaceCwd: (cwd: string) =>
        cwd === runtime.workspaceCwd ? entry : undefined,
    } as unknown as WorkspaceRegistry;
    mock.qwenBatch
      .mockReset()
      .mockResolvedValue({ removed: ['qwen-session'], errors: [] });
    app = express();
    app.use(express.json());
    manager = registerCodexSessionRoutes(app, {
      workspaceRegistry: registry,
      mutateQwenBatch: mock.qwenBatch,
      mutate: () => (_req, _res, next) => next(),
    });
    app.use((_req, res) => res.status(418).json({ reachedQwen: true }));
  });
  afterEach(async () => {
    await manager.dispose();
    rmSync(mock.homeDir, { recursive: true, force: true });
  });
  const create = async () => {
    const response = await request(app)
      .post('/session')
      .send({
        engine: 'codex',
        cwd: '/workspace/a',
        modelServiceId: 'codex-model',
        reasoningEffort: 'high',
      })
      .expect(201);
    return String(response.body.sessionId);
  };
  it('preserves engine, context, organization and history across close/load', async () => {
    const id = await create();
    const status = await request(app).get(`/session/${id}/status`).expect(200);
    expect(status.body).toMatchObject({
      sessionId: id,
      engine: 'codex',
      workspaceCwd: '/workspace/a',
      modelId: 'codex-model',
      createdAt: expect.any(String),
    });
    const context = await request(app)
      .get(`/session/${id}/context`)
      .expect(200);
    expect(context.body).toMatchObject({
      sessionId: id,
      state: {
        configOptions: [{ id: 'reasoning_effort', currentValue: 'high' }],
      },
    });
    const organization = await request(app)
      .patch(`/session/${id}/organization`)
      .send({ isPinned: true, groupId: 'group-1' })
      .expect(200);
    expect(organization.body).toMatchObject({
      isPinned: true,
      groupId: 'group-1',
    });
    const artifacts = await request(app)
      .get(`/session/${id}/artifacts`)
      .expect(200);
    expect(artifacts.body).toMatchObject({
      v: 1,
      sessionId: id,
      generatedAt: expect.any(String),
      limits: { maxArtifacts: expect.any(Number) },
      artifacts: [],
    });
    await request(app).delete(`/session/${id}`).expect(204);
    const loaded = await request(app)
      .post(`/session/${id}/load`)
      .send({})
      .expect(200);
    expect(loaded.body).toMatchObject({
      engine: 'codex',
      isPinned: true,
      groupId: 'group-1',
    });
    const deleted = await request(app)
      .post('/sessions/delete')
      .send({ sessionIds: [id] })
      .expect(200);
    expect(deleted.body.removed).toEqual([id]);
    expect(mock.request).toHaveBeenLastCalledWith('thread/delete', {
      threadId: 'thread-1',
    });
  });
  it('restores the catalog reasoning default while rejecting unknown efforts', async () => {
    const id = await create();
    await request(app)
      .post(`/session/${id}/config-option`)
      .send({ configId: 'reasoning_effort', value: 'none' })
      .expect(200);
    const response = await request(app)
      .post(`/session/${id}/config-option`)
      .send({ configId: 'reasoning_effort', value: 'default' })
      .expect(200);
    expect(response.body).toMatchObject({
      configOptions: [{ id: 'reasoning_effort', currentValue: 'high' }],
      persisted: true,
    });
    await request(app)
      .post(`/session/${id}/config-option`)
      .send({ configId: 'reasoning_effort', value: 'unknown-effort' })
      .expect(400);
    const context = await request(app)
      .get(`/session/${id}/context`)
      .expect(200);
    expect(context.body.state.configOptions).toMatchObject([
      { id: 'reasoning_effort', currentValue: 'high' },
    ]);
  });
  it('uploads, prompts with, restores and removes Codex-owned attachments', async () => {
    mock.request.mockImplementation(async (method: string) => {
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') return { turn: { id: 'turn-1' } };
      return {};
    });
    const id = await create();
    const image = Buffer.from([1, 2, 3]);
    const pdf = Buffer.from('%PDF-1.7\n%binary\u0000\u00ff\n');
    const refs = [];
    for (const [name, mimeType, data] of [
      ['image.png', 'image/png', image],
      ['notes.txt', 'text/plain', Buffer.from('Attached note content')],
      ['report.pdf', 'application/pdf', pdf],
    ] as const) {
      const uploaded = await request(app)
        .post(`/session/${id}/attachments`)
        .query({ name })
        .set('Content-Type', mimeType)
        .send(data)
        .expect(201);
      expect(uploaded.body).toMatchObject({
        type: name === 'image.png' ? 'image' : 'resource',
        attachmentId: expect.any(String),
        mimeType,
        size: data.length,
      });
      refs.push(uploaded.body);
    }
    await request(app)
      .post(`/session/${id}/prompt`)
      .send({
        prompt: [{ type: 'text', text: 'Inspect the attachments' }, ...refs],
      })
      .expect(202);

    const turn = mock.request.mock.calls.find(
      ([method]) => method === 'turn/start',
    )?.[1];
    expect(turn).toMatchObject({
      cwd: '/workspace/a',
      runtimeWorkspaceRoots: ['/workspace/a'],
      input: expect.arrayContaining([
        {
          type: 'image',
          url: `data:image/png;base64,${image.toString('base64')}`,
        },
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Attached note content'),
        }),
      ]),
    });
    const storedPdf = readdirSync(mock.homeDir, { recursive: true }).find(
      (name) => typeof name === 'string' && name.endsWith('report.pdf'),
    );
    expect(storedPdf).toBeDefined();
    const storedPdfPath = path.join(mock.homeDir, String(storedPdf));
    expect(readFileSync(storedPdfPath)).toEqual(pdf);
    expect(JSON.stringify(turn.input)).toContain(storedPdfPath);

    await request(app).delete(`/session/${id}`).expect(204);
    await request(app).post(`/session/${id}/load`).send({}).expect(200);
    const downloaded = await request(app)
      .get(
        `/session/${id}/attachments/${encodeURIComponent(refs[2].attachmentId)}`,
      )
      .expect(200);
    expect(downloaded.headers['content-type']).toContain('application/pdf');
    expect(downloaded.body).toEqual(pdf);
    const removed = await request(app)
      .delete(
        `/session/${id}/attachments/${encodeURIComponent(refs[2].attachmentId)}`,
      )
      .expect(200);
    expect(removed.body).toEqual({ removed: true });
    await request(app)
      .get(
        `/session/${id}/attachments/${encodeURIComponent(refs[2].attachmentId)}`,
      )
      .expect(404);
  });

  it('denies attachment access from another workspace', async () => {
    const id = await create();
    const uploaded = await request(app)
      .post(`/session/${id}/attachments?name=notes.txt`)
      .set('Content-Type', 'text/plain')
      .send(Buffer.from('private note'))
      .expect(201);
    const ownerLookup = registry.getEntryByWorkspaceId.bind(registry);
    registry.getEntryByWorkspaceId = (workspaceId) =>
      workspaceId === 'workspace-b'
        ? ({
            state: 'active',
            workspaceCwd: '/workspace/b',
            current: { runtime: { workspaceCwd: '/workspace/b' } },
          } as ReturnType<WorkspaceRegistry['getEntryByWorkspaceId']>)
        : ownerLookup(workspaceId);
    const otherRoot = `/workspaces/workspace-b/session/${id}/attachments`;
    for (const method of ['get', 'delete'] as const) {
      const denied = await request(app)
        [method](
          `${otherRoot}/${encodeURIComponent(uploaded.body.attachmentId)}`,
        )
        .expect(409);
      expect(denied.body.code).toBe('workspace_mismatch');
    }
    const deniedUpload = await request(app)
      .post(`${otherRoot}?name=other.txt`)
      .set('Content-Type', 'text/plain')
      .send(Buffer.from('other'))
      .expect(409);
    expect(deniedUpload.body.code).toBe('workspace_mismatch');
    await request(app)
      .get(
        `/session/${id}/attachments/${encodeURIComponent(uploaded.body.attachmentId)}`,
      )
      .expect(200);
  });
  it('never routes owned Codex actions or mismatched workspaces through Qwen', async () => {
    const id = await create();
    const unsupported = await request(app)
      .post(`/session/${id}/compact`)
      .send({})
      .expect(409);
    expect(unsupported.body.code).toBe('unsupported_engine_action');
    const mismatched = await request(app)
      .post(`/session/${id}/load`)
      .send({ cwd: '/workspace/other' })
      .expect(409);
    expect(mismatched.body.code).toBe('workspace_mismatch');
    await request(app)
      .post('/session')
      .send({ engine: 'qwen', sessionId: id })
      .expect(409);
    await request(app).post('/session').send({ engine: 'qwen' }).expect(418);
  });
  it.each(['/workspace/%2Fworkspace%2Fa', '/workspaces/workspace-a'])(
    'lists restored sessions without source metadata in the default sidebar at %s',
    async (route) => {
      const id = await create();
      const channel = await request(app)
        .post('/session')
        .send({ engine: 'codex', cwd: '/workspace/a', sourceType: 'channel' })
        .expect(201);
      await manager.dispose();
      app = express();
      app.use(express.json());
      manager = registerCodexSessionRoutes(app, {
        workspaceRegistry: registry,
        mutate: () => (_req, _res, next) => next(),
      });
      const page = await request(app)
        .get(`${route}/sessions?sourceType=default`)
        .expect(200);
      expect(page.body.sessions).toEqual([
        expect.objectContaining({ sessionId: id, engine: 'codex' }),
      ]);
      const channels = await request(app)
        .get(`${route}/sessions?sourceType=channel`)
        .expect(200);
      expect(channels.body.sessions).toEqual([
        expect.objectContaining({ sessionId: channel.body.sessionId }),
      ]);
    },
  );
  it('includes Codex history in search and splits mixed batches by engine ownership', async () => {
    const id = await create();
    await request(app)
      .patch(`/session/${id}/metadata`)
      .send({ displayName: 'Saved Codex needle' })
      .expect(200);
    const found = await request(app)
      .get('/workspaces/workspace-a/sessions/search?q=needle')
      .expect(200);
    expect(found.body.results).toEqual([
      expect.objectContaining({
        session: expect.objectContaining({ sessionId: id, engine: 'codex' }),
        snippet: expect.stringContaining('needle'),
      }),
    ]);
    const removed = await request(app)
      .post('/workspaces/workspace-a/sessions/delete')
      .send({ sessionIds: [id, 'qwen-session'] })
      .expect(200);
    expect(removed.body.removed).toEqual(['qwen-session', id]);
    expect(mock.qwenBatch.mock.calls[0]?.slice(2)).toEqual([
      ['qwen-session'],
      'delete',
      'workspace-a',
    ]);
  });
});
