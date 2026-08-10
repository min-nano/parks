import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { VehicleSpec } from '@/domain/types';
import { TOKYO, makeParking, offsetNorth } from '@/test/fixtures';
import { createTestDatabase, truncateAll } from '@/test/db';

import type { Database } from './client';
import {
  createReport,
  getParkingById,
  getVehicleProfile,
  latestSnapshots,
  listReports,
  makeParkingId,
  recentReports,
  recordSnapshots,
  saveVehicleProfile,
  searchParkings,
  upsertParkings,
} from './repository';

const NOW = new Date('2026-08-10T03:00:00.000Z');

const KEI: VehicleSpec = {
  lengthMm: 3400,
  widthMm: 1480,
  heightMm: 1650,
  weightKg: 900,
  tireWidthMm: 165,
};

const VAN: VehicleSpec = {
  lengthMm: 5380,
  widthMm: 1880,
  heightMm: 2285,
  weightKg: 2500,
  tireWidthMm: 215,
};

const baseSearch = {
  center: TOKYO,
  radiusMeters: 1_000,
  vehicle: null,
  structures: [],
  requireEvCharging: false,
  hideFull: false,
  arrival: NOW,
  durationMinutes: 60,
  limit: 50,
  now: NOW,
};

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('makeParkingId', () => {
  it('namespaces the operator id by source', () => {
    expect(makeParkingId('timesclub', 'A-01')).toBe('timesclub-A-01');
  });
});

describe('upsertParkings', () => {
  it('inserts and then updates in place', async () => {
    const parking = makeParking({ sourceId: 'up-1', name: '旧名称' });
    expect(await upsertParkings(db, [parking])).toBe(1);

    await upsertParkings(db, [{ ...parking, name: '新名称', capacity: 42 }]);

    const stored = await getParkingById(db, parking.id);
    expect(stored).toMatchObject({ name: '新名称', capacity: 42 });
  });

  it('round-trips every field', async () => {
    const parking = makeParking({
      sourceId: 'round-trip',
      officialUrl: 'https://example.com/x',
      structure: 'mechanical',
      limits: {
        maxLengthMm: 5000,
        maxWidthMm: 1850,
        maxHeightMm: 1550,
        maxWeightKg: 2000,
        maxTireWidthMm: 205,
      },
      features: {
        evCharging: true,
        hasRoof: true,
        cashless: true,
        open24h: false,
        accessible: true,
      },
    });

    await upsertParkings(db, [parking]);

    expect(await getParkingById(db, parking.id)).toEqual(parking);
  });

  it('is a no-op for an empty batch', async () => {
    expect(await upsertParkings(db, [])).toBe(0);
  });
});

describe('getParkingById', () => {
  it('returns null for an unknown id', async () => {
    expect(await getParkingById(db, 'nope')).toBeNull();
  });
});

describe('searchParkings', () => {
  it('returns nothing when the area is empty', async () => {
    expect(await searchParkings(db, baseSearch)).toEqual([]);
  });

  it('orders by distance and excludes lots outside the radius', async () => {
    await upsertParkings(db, [
      makeParking({ sourceId: 'far', location: offsetNorth(900) }),
      makeParking({ sourceId: 'near', location: offsetNorth(100) }),
      makeParking({ sourceId: 'outside', location: offsetNorth(3_000) }),
    ]);

    const results = await searchParkings(db, baseSearch);

    expect(results.map((item) => item.parking.sourceId)).toEqual(['near', 'far']);
    expect(results[0]?.distanceMeters).toBeLessThan(results[1]?.distanceMeters ?? 0);
  });

  it('honours the result limit', async () => {
    await upsertParkings(db, [
      makeParking({ sourceId: 'a', location: offsetNorth(100) }),
      makeParking({ sourceId: 'b', location: offsetNorth(200) }),
    ]);

    const results = await searchParkings(db, { ...baseSearch, limit: 1 });
    expect(results).toHaveLength(1);
  });

  it('drops lots the vehicle cannot enter', async () => {
    await upsertParkings(db, [
      makeParking({
        sourceId: 'low',
        limits: {
          maxLengthMm: 5000,
          maxWidthMm: 1900,
          maxHeightMm: 1550,
          maxWeightKg: 2500,
          maxTireWidthMm: null,
        },
      }),
      makeParking({
        sourceId: 'tall',
        limits: {
          maxLengthMm: 6000,
          maxWidthMm: 2200,
          maxHeightMm: 2800,
          maxWeightKg: 3500,
          maxTireWidthMm: null,
        },
      }),
    ]);

    const results = await searchParkings(db, { ...baseSearch, vehicle: VAN });
    expect(results.map((item) => item.parking.sourceId)).toEqual(['tall']);
    expect(results[0]?.fit.fits).toBe(true);
  });

  it('keeps a lot whose tyre-width limit the driver cannot answer', async () => {
    await upsertParkings(db, [
      makeParking({
        sourceId: 'tyre',
        limits: {
          maxLengthMm: null,
          maxWidthMm: null,
          maxHeightMm: null,
          maxWeightKg: null,
          maxTireWidthMm: 195,
        },
      }),
    ]);

    const results = await searchParkings(db, {
      ...baseSearch,
      vehicle: { ...KEI, tireWidthMm: null },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.fit.unknownDimensions).toEqual(['tireWidth']);
  });

  it('filters on the tyre width when the driver supplies one', async () => {
    await upsertParkings(db, [
      makeParking({
        sourceId: 'narrow',
        limits: {
          maxLengthMm: null,
          maxWidthMm: null,
          maxHeightMm: null,
          maxWeightKg: null,
          maxTireWidthMm: 195,
        },
      }),
    ]);

    expect(await searchParkings(db, { ...baseSearch, vehicle: VAN })).toEqual([]);
    expect(await searchParkings(db, { ...baseSearch, vehicle: KEI })).toHaveLength(1);
  });

  it('reports every lot as fitting when no vehicle is given', async () => {
    await upsertParkings(db, [makeParking({ sourceId: 'any' })]);

    const results = await searchParkings(db, baseSearch);
    expect(results[0]?.fit).toEqual({ fits: true, violations: [], unknownDimensions: [] });
  });

  it('filters by structure', async () => {
    await upsertParkings(db, [
      makeParking({ sourceId: 'flat', structure: 'flat' }),
      makeParking({ sourceId: 'mech', structure: 'mechanical' }),
      makeParking({ sourceId: 'deck', structure: 'multistory' }),
    ]);

    const results = await searchParkings(db, {
      ...baseSearch,
      structures: ['mechanical', 'multistory'],
    });

    expect(results.map((item) => item.parking.sourceId).sort()).toEqual(['deck', 'mech']);
  });

  it('filters by EV charging', async () => {
    const withEv = makeParking({ sourceId: 'ev' });
    await upsertParkings(db, [
      { ...withEv, features: { ...withEv.features, evCharging: true } },
      makeParking({ sourceId: 'no-ev' }),
    ]);

    const results = await searchParkings(db, { ...baseSearch, requireEvCharging: true });
    expect(results.map((item) => item.parking.sourceId)).toEqual(['ev']);
  });

  it('prices the stay for each result', async () => {
    await upsertParkings(db, [makeParking({ sourceId: 'priced' })]);

    const results = await searchParkings(db, { ...baseSearch, durationMinutes: 90 });
    expect(results[0]?.fee.totalYen).toBe(600);
  });

  it('merges official snapshots and user reports into live availability', async () => {
    const parking = makeParking({ sourceId: 'live' });
    await upsertParkings(db, [parking]);
    await recordSnapshots(db, [
      {
        parkingId: parking.id,
        status: 'full',
        vacantCount: 0,
        observedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(),
        source: 'operator',
      },
    ]);
    await createReport(db, {
      parkingId: parking.id,
      userId: 'u1',
      status: 'available',
      vacantCount: 4,
      note: null,
      createdAt: NOW,
    });

    const results = await searchParkings(db, baseSearch);
    expect(results[0]?.availability).toMatchObject({ status: 'available', source: 'community' });
  });

  it('hides full lots on request', async () => {
    const full = makeParking({ sourceId: 'full', location: offsetNorth(50) });
    const open = makeParking({ sourceId: 'open', location: offsetNorth(150) });
    await upsertParkings(db, [full, open]);
    await recordSnapshots(db, [
      {
        parkingId: full.id,
        status: 'full',
        vacantCount: 0,
        observedAt: NOW.toISOString(),
        source: 'operator',
      },
    ]);

    expect(
      (await searchParkings(db, { ...baseSearch, hideFull: true })).map(
        (item) => item.parking.sourceId,
      ),
    ).toEqual(['open']);
  });

  it('searches a longitude band that wraps the antimeridian', async () => {
    const center = { lat: 0, lng: 179.999 };
    await upsertParkings(db, [makeParking({ sourceId: 'dateline', location: center })]);

    const results = await searchParkings(db, { ...baseSearch, center, radiusMeters: 500 });
    expect(results).toHaveLength(1);
  });
});

describe('snapshots and reports', () => {
  it('returns an empty map for no ids', async () => {
    expect(await latestSnapshots(db, [])).toEqual(new Map());
    expect(await recentReports(db, [], NOW)).toEqual(new Map());
  });

  it('keeps only the most recent snapshot per parking', async () => {
    const parking = makeParking({ sourceId: 'snap' });
    await upsertParkings(db, [parking]);
    await recordSnapshots(db, [
      {
        parkingId: parking.id,
        status: 'full',
        vacantCount: 0,
        observedAt: '2026-08-10T01:00:00.000Z',
        source: 'operator',
      },
      {
        parkingId: parking.id,
        status: 'available',
        vacantCount: 5,
        observedAt: '2026-08-10T02:00:00.000Z',
        source: 'operator',
      },
    ]);

    const snapshots = await latestSnapshots(db, [parking.id]);
    expect(snapshots.get(parking.id)).toMatchObject({ status: 'available', vacantCount: 5 });
  });

  it('is a no-op for an empty snapshot batch', async () => {
    expect(await recordSnapshots(db, [])).toBe(0);
  });

  it('excludes reports older than the freshness window', async () => {
    const parking = makeParking({ sourceId: 'old' });
    await upsertParkings(db, [parking]);
    await createReport(db, {
      parkingId: parking.id,
      userId: 'u1',
      status: 'full',
      vacantCount: null,
      note: null,
      createdAt: new Date(NOW.getTime() - 6 * 3_600_000),
    });

    expect(await recentReports(db, [parking.id], NOW)).toEqual(new Map());
    expect(await listReports(db, parking.id)).toHaveLength(1);
  });

  it('groups recent reports by parking, newest first', async () => {
    const a = makeParking({ sourceId: 'ga' });
    const b = makeParking({ sourceId: 'gb' });
    await upsertParkings(db, [a, b]);
    await createReport(db, {
      parkingId: a.id,
      userId: 'u1',
      status: 'full',
      vacantCount: null,
      note: null,
      createdAt: new Date(NOW.getTime() - 60_000),
    });
    await createReport(db, {
      parkingId: a.id,
      userId: 'u2',
      status: 'available',
      vacantCount: null,
      note: null,
      createdAt: NOW,
    });
    await createReport(db, {
      parkingId: b.id,
      userId: 'u3',
      status: 'crowded',
      vacantCount: null,
      note: null,
      createdAt: NOW,
    });

    const grouped = await recentReports(db, [a.id, b.id], NOW);
    expect(grouped.get(a.id)?.map((entry) => entry.status)).toEqual(['available', 'full']);
    expect(grouped.get(b.id)).toHaveLength(1);
  });

  it('stores a report with its optional fields', async () => {
    const parking = makeParking({ sourceId: 'report' });
    await upsertParkings(db, [parking]);

    const report = await createReport(db, {
      id: 'fixed-id',
      parkingId: parking.id,
      userId: 'user_1',
      status: 'crowded',
      vacantCount: 2,
      note: '入口が狭いです',
      createdAt: NOW,
    });

    expect(report).toEqual({
      id: 'fixed-id',
      parkingId: parking.id,
      userId: 'user_1',
      status: 'crowded',
      vacantCount: 2,
      note: '入口が狭いです',
      createdAt: NOW.toISOString(),
    });
  });

  it('generates an id and timestamp when none is given', async () => {
    const parking = makeParking({ sourceId: 'auto' });
    await upsertParkings(db, [parking]);

    const report = await createReport(db, {
      parkingId: parking.id,
      userId: 'user_1',
      status: 'available',
      vacantCount: null,
      note: null,
    });

    expect(report.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(report.createdAt)).not.toBeNaN();
  });

  it('caps the report history', async () => {
    const parking = makeParking({ sourceId: 'many' });
    await upsertParkings(db, [parking]);
    for (let index = 0; index < 5; index += 1) {
      await createReport(db, {
        parkingId: parking.id,
        userId: `u${index}`,
        status: 'available',
        vacantCount: null,
        note: null,
        createdAt: new Date(NOW.getTime() - index * 60_000),
      });
    }

    expect(await listReports(db, parking.id, 3)).toHaveLength(3);
  });
});

describe('vehicle profiles', () => {
  it('returns null before anything is saved', async () => {
    expect(await getVehicleProfile(db, 'user_1')).toBeNull();
  });

  it('saves and then overwrites the profile', async () => {
    const saved = await saveVehicleProfile(db, { userId: 'user_1', name: '軽', ...KEI });
    expect(saved).toMatchObject({ userId: 'user_1', name: '軽', lengthMm: 3400 });

    await saveVehicleProfile(db, { userId: 'user_1', name: 'ハイエース', ...VAN });

    const profile = await getVehicleProfile(db, 'user_1');
    expect(profile).toMatchObject({ name: 'ハイエース', heightMm: 2285, tireWidthMm: 215 });
  });
});
