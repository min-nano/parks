import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/db/client';
import { recordSnapshots, upsertParkings, type ParkingSearchItem } from '@/db/repository';
import { TOKYO, makeParking, offsetNorth } from '@/test/fixtures';
import { createTestDatabase, truncateAll } from '@/test/db';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDatabase: () => Promise.resolve(state.db),
}));

const { GET } = await import('./route');

const call = (query: string) => GET(new Request(`https://parks.test/api/parkings?${query}`));

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
  state.db = db;
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('GET /api/parkings', () => {
  it('rejects a request without coordinates', async () => {
    const response = await call('');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid search query' });
  });

  it('rejects an unknown preset', async () => {
    const response = await call('lat=35.658&lng=139.7016&preset=submarine');

    expect(response.status).toBe(400);
  });

  it('returns an empty result set for an empty area', async () => {
    const response = await call('lat=35.658&lng=139.7016');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      center: TOKYO,
      radiusMeters: 800,
      durationMinutes: 60,
      count: 0,
      items: [],
    });
  });

  it('returns priced, availability-annotated results', async () => {
    const parking = makeParking({ sourceId: 'api-1', location: offsetNorth(120) });
    await upsertParkings(db, [parking]);
    await recordSnapshots(db, [
      {
        parkingId: parking.id,
        status: 'available',
        vacantCount: 5,
        observedAt: new Date().toISOString(),
        source: 'operator',
      },
    ]);

    const response = await call('lat=35.658&lng=139.7016&duration=120');
    const body = (await response.json()) as { count: number; items: ParkingSearchItem[] };

    expect(body.count).toBe(1);
    expect(body.items[0]).toMatchObject({
      parking: { id: parking.id },
      availability: { status: 'available', source: 'official' },
      fee: { totalYen: 800 },
      fit: { fits: true },
    });
    expect(body.items[0]?.distanceMeters).toBeGreaterThan(100);
  });

  it('applies the vehicle filter', async () => {
    await upsertParkings(db, [
      makeParking({
        sourceId: 'low',
        limits: {
          maxLengthMm: null,
          maxWidthMm: null,
          maxHeightMm: 1700,
          maxWeightKg: null,
          maxTireWidthMm: null,
        },
      }),
    ]);

    const wide = (await (await call('lat=35.658&lng=139.7016&preset=kei')).json()) as {
      count: number;
    };
    const tall = (await (await call('lat=35.658&lng=139.7016&preset=van')).json()) as {
      count: number;
    };

    expect(wide.count).toBe(1);
    expect(tall.count).toBe(0);
  });
});
