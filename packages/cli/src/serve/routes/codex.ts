/**
 * @license
 * Copyright 2026 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Application, Request, RequestHandler } from 'express';
import { getCodexService, type CodexService } from '../codex/codex-service.js';

export function registerCodexRoutes(
  app: Application,
  deps: {
    mutate: (options?: { strict?: boolean }) => RequestHandler;
    service?: CodexService;
  },
): void {
  const service = deps.service ?? getCodexService();
  const handle =
    (read: (req: Request) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      try {
        res.json(await read(req));
      } catch (error) {
        res.status(503).json({
          code: 'codex_unavailable',
          error: error instanceof Error ? error.message : 'Codex unavailable',
        });
      }
    };
  app.get(
    '/codex/account',
    handle(() => service.refresh()),
  );
  app.get(
    '/codex/models',
    handle(() => service.models()),
  );
  app.get(
    '/codex/limits',
    handle(() => service.limits()),
  );
  app.post(
    '/codex/limits/reset',
    deps.mutate(),
    (req, res, next) => {
      const key = req.body?.idempotencyKey;
      if (typeof key !== 'string' || !key.trim() || key.length > 200) {
        res.status(400).json({
          code: 'invalid_request',
          error:
            'A nonempty idempotencyKey is required (maximum 200 characters).',
        });
        return;
      }
      next();
    },
    handle((req) => service.resetLimits(req.body.idempotencyKey)),
  );
  app.post(
    '/codex/login/start',
    deps.mutate(),
    handle(() => service.startLogin()),
  );
  app.post(
    '/codex/login/cancel',
    deps.mutate(),
    handle(() => service.cancelLogin()),
  );
  app.post(
    '/codex/logout',
    deps.mutate(),
    handle(() => service.logout()),
  );
  app.get('/codex/events', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    let sequence = 0;
    const send = (state: ReturnType<CodexService['snapshot']>) => {
      if (!res.writableEnded)
        res.write(
          `data: ${JSON.stringify({ v: 1, id: ++sequence, type: 'codex_account', state })}\n\n`,
        );
    };
    const unsubscribe = service.subscribe(send);
    send(service.snapshot());
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);
    heartbeat.unref();
    res.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
