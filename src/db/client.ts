import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import { MIGRATION_STATEMENTS } from './migrations';
import { schema, type Schema } from './schema';

/**
 * Driver-agnostic handle. The app talks to Neon over HTTP in production and to
 * an in-process PGlite instance in demo mode and in tests, so nothing below the
 * repository layer may depend on a concrete driver.
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export async function runMigrations(db: Database): Promise<void> {
  for (const statement of MIGRATION_STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

export async function createNeonDatabase(url: string): Promise<Database> {
  const [{ neon }, { drizzle }] = await Promise.all([
    import('@neondatabase/serverless'),
    import('drizzle-orm/neon-http'),
  ]);
  return drizzle(neon(url), { schema }) as unknown as Database;
}

/**
 * Zero-configuration Postgres that lives inside the Node process. Data is lost
 * when the process exits, which is exactly what we want for `npm run dev`
 * without credentials and for preview deployments.
 */
export async function createDemoDatabase(): Promise<Database> {
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ]);
  const db = drizzle(new PGlite(), { schema }) as unknown as Database;
  await runMigrations(db);
  const { seedDatabase } = await import('./seed');
  await seedDatabase(db);
  return db;
}

let cached: Promise<Database> | null = null;

export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL;
}

export function getDatabase(): Promise<Database> {
  if (cached === null) {
    const url = process.env.DATABASE_URL;
    cached = url
      ? createNeonDatabase(url)
      : (console.warn('[parks] DATABASE_URL is not set — starting in demo mode with seed data.'),
        createDemoDatabase());
  }
  return cached;
}

/** Test hook: drops the memoised connection so the next call re-reads the env. */
export function resetDatabaseCache(): void {
  cached = null;
}
