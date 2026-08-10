import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/db/client';
import { createReport, upsertParkings } from '@/db/repository';
import type { ParkingDetailResponse } from '@/lib/api-client';
import { makeParking } from '@/test/fixtures';
import { createTestDatabase, truncateAll } from '@/test/db';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDatabase: () => Promise.resolve(state.db),
}));

const { GET } = await import('./route');

const call = (id: string, query = '') =>
  GET(new Request(`https://parks.test/api/parkings/${id}?${query}`), {
    params: Promise.resolve({ id }),
  });

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
  state.db = db;
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('GET /api/parkings/[id]', () => {
  it('rejects an invalid query', async () => {
    const response = await call('test-x', 'duration=0');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid query' });
  });

  it('404s for an unknown parking', async () => {
    const response = await call('missing');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'parking not found' });
  });

  it('returns the lot with its fee estimate and report history', async () => {
    const parking = makeParking({ sourceId: 'detail' });
    await upsertParkings(db, [parking]);
    await createReport(db, {
      parkingId: parking.id,
      userId: 'user_1',
      status: 'crowded',
      vacantCount: 1,
      note: '残り1台',
      createdAt: new Date(),
    });

    const response = await call(parking.id, 'duration=90');
    const body = (await response.json()) as ParkingDetailResponse;

    expect(response.status).toBe(200);
    expect(body.parking.id).toBe(parking.id);
    expect(body.fee.totalYen).toBe(600);
    expect(body.availability.status).toBe('crowded');
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]?.note).toBe('残り1台');
    expect(body.fit).toBeNull();
  });

  it('evaluates the fit when a vehicle is supplied', async () => {
    const parking = makeParking({
      sourceId: 'fit',
      limits: {
        maxLengthMm: null,
        maxWidthMm: null,
        maxHeightMm: 1550,
        maxWeightKg: null,
        maxTireWidthMm: null,
      },
    });
    await upsertParkings(db, [parking]);

    const body = (await (await call(parking.id, 'preset=van')).json()) as ParkingDetailResponse;

    expect(body.fit).toMatchObject({ fits: false });
    expect(body.fit?.violations[0]?.dimension).toBe('height');
  });
});
