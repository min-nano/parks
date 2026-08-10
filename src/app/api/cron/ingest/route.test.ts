import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/db/client';
import { getParkingById } from '@/db/repository';
import { createTestDatabase, truncateAll } from '@/test/db';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDatabase: () => Promise.resolve(state.db),
}));

const { GET } = await import('./route');

const FEED = [
  { sourceId: 'A-1', name: '取り込みテスト', lat: 35.658, lng: 139.7016, availability: '空車' },
];

const call = (authorization?: string) =>
  GET(
    new Request('https://parks.test/api/cron/ingest', {
      headers: authorization === undefined ? {} : { authorization },
    }),
  );

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
  state.db = db;
});

beforeEach(async () => {
  await truncateAll(db);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(FEED) }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /api/cron/ingest', () => {
  it('stays disabled until a cron secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await call('Bearer anything');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('CRON_SECRET') });
  });

  it.each([
    ['no header', undefined],
    ['the wrong token', 'Bearer nope'],
  ])('rejects a request with %s', async (_label, authorization) => {
    vi.stubEnv('CRON_SECRET', 'topsecret');

    expect((await call(authorization)).status).toBe(401);
  });

  it('does nothing when no feeds are configured', async () => {
    vi.stubEnv('CRON_SECRET', 'topsecret');
    vi.stubEnv('INGEST_SOURCES', '');

    const response = await call('Bearer topsecret');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      skipped: true,
      reason: 'INGEST_SOURCES is empty',
    });
  });

  it('pulls every configured feed into the database', async () => {
    vi.stubEnv('CRON_SECRET', 'topsecret');
    vi.stubEnv(
      'INGEST_SOURCES',
      JSON.stringify([
        { source: 'alpha', label: 'Alpha', endpoint: 'https://example.com/feed' },
      ]),
    );

    const response = await call('Bearer topsecret');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      parkingsUpserted: 1,
      snapshotsRecorded: 1,
    });
    expect(await getParkingById(db, 'alpha-A-1')).toMatchObject({ name: '取り込みテスト' });
  });
});
