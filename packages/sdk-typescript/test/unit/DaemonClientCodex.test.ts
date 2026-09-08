import { describe, expect, it, vi } from 'vitest';
import { DaemonClient } from '../../src/daemon/DaemonClient.js';
import { DaemonSessionClient } from '../../src/daemon/DaemonSessionClient.js';
import type { DaemonTransport } from '../../src/daemon/DaemonTransport.js';

const sessionId = '99a95e3c-ec34-4dfb-bd64-dd3929e4c18b';
const state = {
  configOptions: [{ id: 'reasoning_effort', currentValue: 'high' }],
};
const session = {
  sessionId,
  engine: 'codex',
  workspaceCwd: '/workspace/a',
  modelId: 'codex-model',
  state,
  attached: false,
  clientId: 'client',
  eventEpoch: 'epoch',
  compactedReplay: [],
  liveJournal: [],
  lastEventId: 0,
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function acpTransport(): DaemonTransport & { fetch: ReturnType<typeof vi.fn> } {
  return {
    type: 'acp-http',
    connected: true,
    supportsReplay: true,
    fetch: vi.fn(async () => {
      throw new Error('ACP must not receive this Codex request');
    }),
    subscribeEvents() {
      throw new Error('ACP must not subscribe to Codex');
    },
    dispose() {},
  };
}

describe('Codex session transport ownership', () => {
  it.each(['legacy', 'qualified'] as const)(
    'reads the merged %s catalog through REST before any session is attached',
    async (route) => {
      const transport = acpTransport();
      transport.fetch.mockImplementation(async (url) => {
        if (String(url).endsWith('/capabilities'))
          return json({ features: ['session_source_metadata'] });
        throw new Error('ACP must not receive the mixed session catalog');
      });
      const requests: string[] = [];
      const sessions = [session, { sessionId: 'qwen-history', engine: 'qwen' }];
      const fetch: typeof globalThis.fetch = async (url) => {
        if (String(url).endsWith('/capabilities'))
          return json({ features: ['session_source_metadata'] });
        requests.push(String(url));
        return json({ sessions, nextCursor: 'codex-v1:2' });
      };
      const client = new DaemonClient({
        baseUrl: 'http://daemon',
        transport,
        fetch,
      });
      const options = {
        sourceType: 'default',
        pageSize: 50,
        view: 'organized' as const,
        group: 'all',
      };
      const page =
        route === 'legacy'
          ? await client.listWorkspaceSessionsPage('/workspace/a', options)
          : await client
              .workspaceByCwd('/workspace/a')
              .listWorkspaceSessionsPage(options);
      expect(page).toEqual({ sessions, nextCursor: 'codex-v1:2' });
      const rows =
        route === 'legacy'
          ? await client.listWorkspaceSessions('/workspace/a', options)
          : await client
              .workspaceByCwd('/workspace/a')
              .listWorkspaceSessions(options);
      expect(rows).toEqual(sessions);
      expect(requests).toEqual([
        `http://daemon/${route === 'legacy' ? 'workspace' : 'workspaces'}/%2Fworkspace%2Fa/sessions?size=50&view=organized&group=all&sourceType=default`,
        `http://daemon/${route === 'legacy' ? 'workspace' : 'workspaces'}/%2Fworkspace%2Fa/sessions?size=50&view=organized&group=all&sourceType=default`,
      ]);
      expect(
        transport.fetch.mock.calls.every(([url]) =>
          String(url).endsWith('/capabilities'),
        ),
      ).toBe(true);
      client.dispose();
    },
  );
  it('keeps create, model, prompt and events on authenticated REST with an ACP host transport', async () => {
    const transport = acpTransport();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith('/capabilities'))
        return json({ features: ['codex_sessions'] });
      if (String(url).endsWith('/session')) return json(session, 201);
      if (String(url).endsWith('/prompt'))
        return json({ promptId: 'prompt', lastEventId: 0 }, 202);
      if (String(url).endsWith('/shell'))
        return json({ error: 'Unsupported in Codex' }, 400);
      if (String(url).includes('/events'))
        return new Response(
          'id: 1\ndata: {"id":1,"v":1,"type":"turn_complete","data":{"promptId":"prompt","stopReason":"end_turn"}}\n\n',
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'X-Qwen-Event-Epoch': 'epoch',
              'X-Qwen-Sse-Stream-Id': sessionId,
            },
          },
        );
      return json({ modelId: 'codex-next' });
    };
    const client = new DaemonClient({
      baseUrl: 'http://daemon',
      token: 'test-token',
      transport,
      fetch,
    });
    const created = await DaemonSessionClient.createOrAttach(client, {
      engine: 'codex',
      modelServiceId: 'codex-model',
      workspaceCwd: '/workspace/a',
    });
    expect(created.state).toEqual(state);
    await created.setModel('codex-next');
    await client.promptNonBlocking(sessionId, {
      prompt: [{ type: 'text', text: 'Hello' }],
    });
    const events = [];
    for await (const event of created.subscribeEvents({
      lastEventId: 0,
      epoch: 'epoch',
    }))
      events.push(event);
    expect(events).toHaveLength(1);
    for await (const event of created.subscribeEvents()) events.push(event);
    const streams = requests.filter((request) =>
      request.url.includes('/events'),
    );
    expect(new URL(streams[1]!.url).searchParams.get('connectReason')).toBe(
      'resume',
    );
    expect(new URL(streams[1]!.url).searchParams.get('previousStreamId')).toBe(
      sessionId,
    );
    await expect(created.shellCommand('echo unsafe')).rejects.toThrow(
      'Unsupported in Codex',
    );
    expect(transport.fetch).not.toHaveBeenCalled();
    for (const request of requests)
      expect(new Headers(request.init?.headers).get('authorization')).toBe(
        'Bearer test-token',
      );
    expect(
      JSON.parse(
        String(
          requests.find((request) => request.url.endsWith('/session'))?.init
            ?.body,
        ),
      ),
    ).toMatchObject({
      engine: 'codex',
      modelServiceId: 'codex-model',
      cwd: '/workspace/a',
    });
    client.dispose();
  });

  it('resolves persisted ownership via REST before restoration, including after a client restart', async () => {
    const transport = acpTransport();
    const requests: string[] = [];
    const fetch: typeof globalThis.fetch = async (url) => {
      requests.push(String(url));
      return String(url).endsWith('/status')
        ? json(session)
        : json({ ...session, attached: true });
    };
    const client = new DaemonClient({
      baseUrl: 'http://daemon',
      transport,
      fetch,
    });
    const restored = await DaemonSessionClient.load(client, sessionId, {
      workspaceCwd: '/workspace/a',
    });
    expect(restored.session.engine).toBe('codex');
    expect(restored.state).toEqual(state);
    expect(requests).toEqual([
      `http://daemon/session/${sessionId}/status`,
      `http://daemon/session/${sessionId}/load`,
    ]);
    expect(transport.fetch).not.toHaveBeenCalled();
    client.dispose();
  });

  it('never attempts ACP after an ownership lookup error or a Codex restore failure', async () => {
    for (const failure of [
      { failStatus: true, status: 401 },
      { failStatus: true, status: 403 },
      { failStatus: true, status: 503 },
      { failStatus: false, status: 404 },
      { failStatus: false, status: 503 },
    ]) {
      const transport = acpTransport();
      const fetch: typeof globalThis.fetch = async (url) =>
        String(url).endsWith('/status') && !failure.failStatus
          ? json(session)
          : json({ error: 'Unavailable' }, failure.status);
      const client = new DaemonClient({
        baseUrl: 'http://daemon',
        transport,
        fetch,
      });
      await expect(client.loadSession(sessionId)).rejects.toThrow();
      expect(transport.fetch).not.toHaveBeenCalled();
      client.dispose();
    }
  });

  it.each([200, 404])(
    'preserves legacy Qwen restore after status %s and rejects old daemons before Codex create',
    async (status) => {
      const transport = acpTransport();
      transport.fetch.mockResolvedValue(
        json({
          sessionId: 'qwen-session',
          workspaceCwd: '/workspace/a',
          state: {},
        }),
      );
      const fetch: typeof globalThis.fetch = async (url) =>
        String(url).endsWith('/capabilities')
          ? json({ features: [] })
          : status === 404
            ? json(
                { error: 'Session not found', code: 'session_not_found' },
                404,
              )
            : json({ sessionId: 'qwen-session', workspaceCwd: '/workspace/a' });
      const client = new DaemonClient({
        baseUrl: 'http://daemon',
        transport,
        fetch,
      });
      await client.loadSession('qwen-session');
      expect(transport.fetch).toHaveBeenCalledOnce();
      expect(transport.fetch.mock.calls[0]?.[0]).toBe(
        'http://daemon/session/qwen-session/load',
      );
      await expect(
        client.createOrAttachSession({ engine: 'codex' }),
      ).rejects.toThrow('codex_sessions');
      expect(transport.fetch).toHaveBeenCalledOnce();
      client.dispose();
    },
  );
  it('keeps mixed workspace history mutations on selected-workspace REST while preserving legacy global ACP ownership', async () => {
    const transport = acpTransport();
    transport.fetch.mockResolvedValue(
      json({ removed: ['qwen-history'], notFound: [], errors: [] }),
    );
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: typeof globalThis.fetch = async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith('/capabilities'))
        return json({ features: ['codex_sessions'] });
      if (String(url).endsWith('/session')) return json(session, 201);
      return json({
        removed: [],
        archived: [],
        unarchived: [],
        notFound: [],
        errors: [],
      });
    };
    const client = new DaemonClient({
      baseUrl: 'http://daemon',
      token: 'test-token',
      fetch,
      transport,
    });
    const workspace = client.workspaceById('workspace-a');
    const ids = [sessionId, 'qwen-history'];
    await workspace.archiveSessionsData(
      ids,
      { resolveConflicts: true },
      'client-a',
    );
    await workspace.unarchiveSessionsData(ids, 'client-a');
    await workspace.deleteSessionsData(ids, 'client-a');
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/workspaces/workspace-a/sessions/archive',
      '/workspaces/workspace-a/sessions/unarchive',
      '/workspaces/workspace-a/sessions/delete',
    ]);
    for (const request of requests) {
      expect(JSON.parse(String(request.init?.body))).toMatchObject({
        sessionIds: ids,
      });
      expect(new Headers(request.init?.headers).get('Authorization')).toBe(
        'Bearer test-token',
      );
      expect(new Headers(request.init?.headers).get('X-Qwen-Client-Id')).toBe(
        'client-a',
      );
    }
    expect(JSON.parse(String(requests[0]?.init?.body)).resolveConflicts).toBe(
      true,
    );
    expect(transport.fetch).not.toHaveBeenCalled();
    await client.deleteSessionsData(['qwen-history']);
    expect(transport.fetch).toHaveBeenCalledOnce();
    await client.createOrAttachSession({ engine: 'codex' });
    await client.deleteSessionsData(ids);
    expect(requests.at(-1)?.url).toBe('http://daemon/sessions/delete');
    expect(transport.fetch).toHaveBeenCalledOnce();
    client.dispose();
  });
});
