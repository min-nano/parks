import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';

import { runMigrations, type Database } from '@/db/client';
import { schema } from '@/db/schema';

/** A migrated, empty Postgres running inside the test process. */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema }) as unknown as Database;
  await runMigrations(db);
  return db;
}

/**
 * Empties every table.
 *
 * Booting PGlite costs a couple of seconds, so suites create one database in
 * `beforeAll` and reset it between tests instead of paying that per test.
 */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql.raw(
      'TRUNCATE parkings, availability_snapshots, user_reports, vehicle_profiles RESTART IDENTITY CASCADE',
    ),
  );
}
