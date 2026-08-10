import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SEED_PARKINGS, SEED_SNAPSHOTS } from '@/data/seed-parkings';
import { createTestDatabase, truncateAll } from '@/test/db';

import type { Database } from './client';
import { latestSnapshots } from './repository';
import { seedDatabase } from './seed';

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('seedDatabase', () => {
  it('loads the demo dataset', async () => {
    const result = await seedDatabase(db);

    expect(result).toEqual({
      parkings: SEED_PARKINGS.length,
      snapshots: SEED_SNAPSHOTS.length,
    });
  });

  it('backdates snapshots relative to now so demo data looks live', async () => {
    const now = new Date('2026-08-10T12:00:00.000Z');
    await seedDatabase(db, { now });

    const snapshots = await latestSnapshots(
      db,
      SEED_SNAPSHOTS.map((snapshot) => snapshot.parkingId),
    );

    expect(snapshots.size).toBe(SEED_SNAPSHOTS.length);
    for (const snapshot of snapshots.values()) {
      expect(snapshot.observedAt).toBe('2026-08-10T11:58:00.000Z');
    }
  });

  it('is safe to run twice', async () => {
    await seedDatabase(db);
    await expect(seedDatabase(db)).resolves.toMatchObject({ parkings: SEED_PARKINGS.length });
  });
});
