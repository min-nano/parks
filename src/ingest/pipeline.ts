import type { Database } from '@/db/client';
import { recordSnapshots, upsertParkings } from '@/db/repository';
import type { AvailabilitySnapshot, Parking } from '@/domain/types';

import { normalizeRecord, rawRecordSchema, type RawParkingRecord } from './normalize';

export type IngestAdapter = {
  /** Stable identifier persisted on every row this adapter produces. */
  source: string;
  label: string;
  fetchRecords(): Promise<unknown[]>;
};

export type AdapterResult = {
  source: string;
  fetched: number;
  accepted: number;
  rejected: { index: number; message: string }[];
  error: string | null;
};

export type IngestSummary = {
  parkingsUpserted: number;
  snapshotsRecorded: number;
  adapters: AdapterResult[];
};

/**
 * Pulls every adapter, normalises what parses and writes the result.
 *
 * One broken feed must not take the whole run down, so adapter failures and
 * individual malformed records are collected into the summary instead of thrown.
 */
export async function runIngest(
  db: Database,
  adapters: IngestAdapter[],
  options: { now?: Date } = {},
): Promise<IngestSummary> {
  const now = options.now ?? new Date();
  const parkings: Parking[] = [];
  const snapshots: AvailabilitySnapshot[] = [];
  const results: AdapterResult[] = [];

  for (const adapter of adapters) {
    const result: AdapterResult = {
      source: adapter.source,
      fetched: 0,
      accepted: 0,
      rejected: [],
      error: null,
    };

    let records: unknown[];
    try {
      records = await adapter.fetchRecords();
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      results.push(result);
      continue;
    }

    result.fetched = records.length;

    records.forEach((record, index) => {
      const parsed = rawRecordSchema.safeParse(record);
      if (!parsed.success) {
        result.rejected.push({
          index,
          message: parsed.error.issues.map((issue) => issue.message).join('; '),
        });
        return;
      }

      const normalized = normalizeRecord(adapter.source, parsed.data as RawParkingRecord, now);
      parkings.push(normalized.parking);
      if (normalized.snapshot) snapshots.push(normalized.snapshot);
      result.accepted += 1;
    });

    results.push(result);
  }

  const parkingsUpserted = await upsertParkings(db, parkings);
  const snapshotsRecorded = await recordSnapshots(db, snapshots);

  return { parkingsUpserted, snapshotsRecorded, adapters: results };
}
