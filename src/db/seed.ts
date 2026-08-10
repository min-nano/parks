import { SEED_PARKINGS, SEED_SNAPSHOTS } from '@/data/seed-parkings';

import type { Database } from './client';
import { recordSnapshots, upsertParkings } from './repository';

export type SeedOptions = {
  /**
   * Snapshots are stored relative to this instant so freshly seeded demo data
   * always looks "live" instead of months stale.
   */
  now?: Date;
};

export async function seedDatabase(
  db: Database,
  options: SeedOptions = {},
): Promise<{ parkings: number; snapshots: number }> {
  const now = options.now ?? new Date();

  const inserted = await upsertParkings(db, SEED_PARKINGS);
  const snapshots = await recordSnapshots(
    db,
    SEED_SNAPSHOTS.map((snapshot) => ({
      ...snapshot,
      observedAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
    })),
  );

  return { parkings: inserted, snapshots };
}
