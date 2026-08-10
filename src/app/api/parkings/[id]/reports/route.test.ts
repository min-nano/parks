import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/db/client';
import { listReports, upsertParkings } from '@/db/repository';
import type { UserReport } from '@/domain/types';
import { currentUserId } from '@/server/auth';
import { makeParking } from '@/test/fixtures';
import { createTestDatabase, truncateAll } from '@/test/db';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDatabase: () => Promise.resolve(state.db),
}));

vi.mock('@/server/auth', () => ({ currentUserId: vi.fn() }));

const { GET, POST } = await import('./route');
const userIdMock = vi.mocked(currentUserId);

const get = (id: string) =>
  GET(new Request(`https://parks.test/api/parkings/${id}/reports`), {
    params: Promise.resolve({ id }),
  });

const post = (id: string, body: unknown) =>
  POST(
    new Request(`https://parks.test/api/parkings/${id}/reports`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
  state.db = db;
});

beforeEach(async () => {
  await truncateAll(db);
  userIdMock.mockReset();
  userIdMock.mockResolvedValue('user_123');
});

describe('GET /api/parkings/[id]/reports', () => {
  it('returns an empty history without requiring sign-in', async () => {
    userIdMock.mockResolvedValue(null);

    const response = await get('test-none');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      parkingId: 'test-none',
      count: 0,
      reports: [],
    });
  });
});

describe('POST /api/parkings/[id]/reports', () => {
  it('rejects an anonymous visitor', async () => {
    userIdMock.mockResolvedValue(null);

    const response = await post('test-x', { status: 'full' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'sign in required' });
  });

  it.each([
    ['an unreportable status', { status: 'unknown' }],
    ['a malformed body', '{oops'],
  ])('rejects %s', async (_label, body) => {
    const response = await post('test-x', body);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid report' });
  });

  it('404s rather than failing a foreign key', async () => {
    const response = await post('missing', { status: 'full' });

    expect(response.status).toBe(404);
  });

  it('stores the report and returns it', async () => {
    const parking = makeParking({ sourceId: 'reportable' });
    await upsertParkings(db, [parking]);

    const response = await post(parking.id, {
      status: 'crowded',
      vacantCount: 2,
      note: '  あと2台  ',
    });
    const body = (await response.json()) as { report: UserReport };

    expect(response.status).toBe(201);
    expect(body.report).toMatchObject({
      parkingId: parking.id,
      userId: 'user_123',
      status: 'crowded',
      vacantCount: 2,
      note: 'あと2台',
    });

    expect(await listReports(db, parking.id)).toHaveLength(1);
  });

  it('stores a report with no optional fields', async () => {
    const parking = makeParking({ sourceId: 'minimal' });
    await upsertParkings(db, [parking]);

    const body = (await (await post(parking.id, { status: 'available' })).json()) as {
      report: UserReport;
    };

    expect(body.report).toMatchObject({ vacantCount: null, note: null });
  });

  it('lists reports newest first', async () => {
    const parking = makeParking({ sourceId: 'history' });
    await upsertParkings(db, [parking]);
    await post(parking.id, { status: 'full' });
    await post(parking.id, { status: 'available' });

    const body = (await (await get(parking.id)).json()) as { count: number; reports: UserReport[] };

    expect(body.count).toBe(2);
    expect(body.reports[0]?.status).toBe('available');
  });
});
