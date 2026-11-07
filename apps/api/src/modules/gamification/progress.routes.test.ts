import type { ProgressDto } from '@job-tracker/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApplication } from '../../../test/factories.js';
import { createTestApp, resetDb, type TestApp } from '../../../test/helpers.js';

describe('GET /api/v1/progress', () => {
  describe('enabled', () => {
    let t: TestApp;
    beforeAll(async () => {
      t = await createTestApp({ gamification: true });
    });
    afterAll(() => t.close());
    beforeEach(() => resetDb(t.db));

    it('returns facts derived from existing data', async () => {
      const a = await createApplication(t.app, { status: 'applied' });
      await t.app.inject({
        method: 'PATCH',
        url: `/api/v1/applications/${a.id}/status`,
        payload: { status: 'offer' },
      });
      const res = await t.app.inject({ method: 'GET', url: '/api/v1/progress' });
      expect(res.statusCode).toBe(200);
      const body = res.json<ProgressDto>();
      expect(body.applicationsCount).toBe(1);
      expect(body.stageReachedCounts.offer).toBe(1);
      expect(body.days.length).toBeGreaterThan(0);
    });
  });

  describe('disabled (default)', () => {
    let t: TestApp;
    beforeAll(async () => {
      t = await createTestApp();
    });
    afterAll(() => t.close());

    it('does not exist', async () => {
      const res = await t.app.inject({ method: 'GET', url: '/api/v1/progress' });
      expect(res.statusCode).toBe(404);
    });
  });
});
