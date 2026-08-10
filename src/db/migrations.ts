/**
 * Idempotent DDL applied on boot (demo mode) and by `npm run db:migrate`.
 *
 * Kept as plain statements rather than generated migration files so the same
 * code path works against Neon, a local Postgres and the in-process PGlite used
 * by the test-suite — none of which can rely on the filesystem in production.
 * `src/db/migrations.test.ts` asserts the result matches `schema.ts`.
 */
export const MIGRATION_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS parkings (
     id text PRIMARY KEY,
     source text NOT NULL,
     source_id text NOT NULL,
     name text NOT NULL,
     address text NOT NULL,
     lat double precision NOT NULL,
     lng double precision NOT NULL,
     structure text NOT NULL,
     capacity integer,
     max_length_mm integer,
     max_width_mm integer,
     max_height_mm integer,
     max_weight_kg integer,
     max_tire_width_mm integer,
     features jsonb NOT NULL,
     fee_schedule jsonb NOT NULL,
     official_url text,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS parkings_source_source_id_key ON parkings (source, source_id)`,
  `CREATE INDEX IF NOT EXISTS parkings_lat_lng_idx ON parkings (lat, lng)`,
  `CREATE TABLE IF NOT EXISTS availability_snapshots (
     id text PRIMARY KEY,
     parking_id text NOT NULL REFERENCES parkings (id) ON DELETE CASCADE,
     status text NOT NULL,
     vacant_count integer,
     observed_at timestamptz NOT NULL,
     source text NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS availability_snapshots_parking_observed_idx
     ON availability_snapshots (parking_id, observed_at)`,
  `CREATE TABLE IF NOT EXISTS user_reports (
     id text PRIMARY KEY,
     parking_id text NOT NULL REFERENCES parkings (id) ON DELETE CASCADE,
     user_id text NOT NULL,
     status text NOT NULL,
     vacant_count integer,
     note text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS user_reports_parking_created_idx
     ON user_reports (parking_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS vehicle_profiles (
     user_id text PRIMARY KEY,
     name text NOT NULL,
     length_mm integer NOT NULL,
     width_mm integer NOT NULL,
     height_mm integer NOT NULL,
     weight_kg integer NOT NULL,
     tire_width_mm integer,
     updated_at timestamptz NOT NULL DEFAULT now()
   )`,
];
