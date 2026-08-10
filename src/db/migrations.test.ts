import { getTableColumns, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase } from '@/test/db';

import type { Database } from './client';
import { runMigrations } from './client';
import { availabilitySnapshots, parkings, schema, userReports, vehicleProfiles } from './schema';

describe('migrations', () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  it('creates every table declared in the drizzle schema', async () => {
    for (const table of Object.values(schema)) {
      await expect(db.select().from(table).limit(1)).resolves.toEqual([]);
    }
  });

  it.each([
    ['parkings', parkings],
    ['availability_snapshots', availabilitySnapshots],
    ['user_reports', userReports],
    ['vehicle_profiles', vehicleProfiles],
  ])('keeps the hand-written DDL for %s in sync with the schema', async (tableName, table) => {
    const result: unknown = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName}`,
    );
    // Drivers disagree on whether `execute` returns the rows or a result object.
    const rows = (
      Array.isArray(result) ? result : (result as { rows: { column_name: string }[] }).rows
    ) as { column_name: string }[];
    const actual = new Set(rows.map((row) => row.column_name));
    const expected = Object.values(getTableColumns(table)).map((column) => column.name);

    expect([...expected].sort()).toEqual([...actual].sort());
  });

  it('is idempotent', async () => {
    await expect(runMigrations(db)).resolves.toBeUndefined();
  });

  it.each([
    [parkings, ['parkings_source_source_id_key', 'parkings_lat_lng_idx']],
    [availabilitySnapshots, ['availability_snapshots_parking_observed_idx']],
    [userReports, ['user_reports_parking_created_idx']],
    [vehicleProfiles, []],
  ])('declares the indexes the query planner relies on', (table, expected) => {
    const config = getTableConfig(table);
    const declared = config.indexes.map((index) => index.config.name);

    expect(declared.sort()).toEqual([...expected].sort());
  });

  it.each([
    ['availability_snapshots', availabilitySnapshots],
    ['user_reports', userReports],
  ])('cascades %s rows when their parking is deleted', (_name, table) => {
    const [foreignKey] = getTableConfig(table).foreignKeys;
    const reference = foreignKey?.reference();

    expect(reference?.foreignColumns.map((column) => column.name)).toEqual(['id']);
    expect(foreignKey?.onDelete).toBe('cascade');
  });
});
