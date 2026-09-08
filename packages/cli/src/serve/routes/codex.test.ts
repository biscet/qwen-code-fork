import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { CodexService } from '../codex/codex-service.js';
import { registerCodexRoutes } from './codex.js';

function fixture(mutationsAllowed = true) {
  const service = new CodexService('/tmp/homecode-codex-route-test');
  const reset = vi.spyOn(service, 'resetLimits').mockResolvedValue({
    outcome: 'nothingToReset',
    state: service.snapshot(),
  });
  const app = express();
  app.use(express.json());
  registerCodexRoutes(app, {
    service,
    mutate: () => (_req, res, next) => {
      if (mutationsAllowed) next();
      else res.status(403).json({ code: 'mutation_denied' });
    },
  });
  return { app, reset };
}

describe('Codex account reset route', () => {
  it.each([
    {},
    { idempotencyKey: '' },
    { idempotencyKey: '  ' },
    { idempotencyKey: 42 },
    { idempotencyKey: 'x'.repeat(201) },
  ])('rejects invalid request %j without dispatching a reset', async (body) => {
    const { app, reset } = fixture();
    await request(app).post('/codex/limits/reset').send(body).expect(400);
    expect(reset).not.toHaveBeenCalled();
  });
  it('preserves the caller attempt key and returns its result', async () => {
    const { app, reset } = fixture();
    const response = await request(app)
      .post('/codex/limits/reset')
      .send({ idempotencyKey: 'retry-same-key' })
      .expect(200);
    expect(reset).toHaveBeenCalledExactlyOnceWith('retry-same-key');
    expect(response.body.outcome).toBe('nothingToReset');
  });
  it('honors the existing daemon mutation gate', async () => {
    const { app, reset } = fixture(false);
    await request(app)
      .post('/codex/limits/reset')
      .send({ idempotencyKey: 'attempt' })
      .expect(403);
    expect(reset).not.toHaveBeenCalled();
  });
});
