import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/db/client';
import { getParkingById, latestSnapshots } from '@/db/repository';
import { createTestDatabase, truncateAll } from '@/test/db';

import { runIngest, type IngestAdapter } from './pipeline';

const NOW = new Date('2026-08-10T12:00:00.000Z');

const record = (sourceId: string, extra: Record<string, unknown> = {}) => ({
  sourceId,
  name: `駐車場 ${sourceId}`,
  lat: 35.658,
  lng: 139.7016,
  ...extra,
});

const adapter = (source: string, records: unknown[]): IngestAdapter => ({
  source,
  label: source,
  fetchRecords: vi.fn().mockResolvedValue(records),
});

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
});

beforeEach(async () => {
  await truncateAll(db);
});

describe('runIngest', () => {
  it('writes parkings and snapshots from every adapter', async () => {
    const summary = await runIngest(
      db,
      [
        adapter('alpha', [record('1', { availability: '空車', vacantCount: 3 })]),
        adapter('beta', [record('9')]),
      ],
      { now: NOW },
    );

    expect(summary.parkingsUpserted).toBe(2);
    expect(summary.snapshotsRecorded).toBe(1);
    expect(await getParkingById(db, 'alpha-1')).not.toBeNull();
    expect((await latestSnapshots(db, ['alpha-1'])).get('alpha-1')).toMatchObject({
      status: 'available',
      vacantCount: 3,
    });
  });

  it('skips malformed records but keeps the rest of the batch', async () => {
    const summary = await runIngest(
      db,
      [adapter('alpha', [record('1'), { name: 'no id' }, record('2')])],
      { now: NOW },
    );

    expect(summary.parkingsUpserted).toBe(2);
    expect(summary.adapters[0]).toMatchObject({ fetched: 3, accepted: 2 });
    expect(summary.adapters[0]?.rejected).toHaveLength(1);
    expect(summary.adapters[0]?.rejected[0]?.index).toBe(1);
  });

  it('records an adapter failure without losing the other feeds', async () => {
    const failing: IngestAdapter = {
      source: 'broken',
      label: 'broken',
      fetchRecords: vi.fn().mockRejectedValue(new Error('HTTP 500')),
    };

    const summary = await runIngest(db, [failing, adapter('alpha', [record('1')])], {
      now: NOW,
    });

    expect(summary.adapters[0]).toMatchObject({ source: 'broken', error: 'HTTP 500', fetched: 0 });
    expect(summary.parkingsUpserted).toBe(1);
  });

  it('stringifies a non-Error rejection', async () => {
    const failing: IngestAdapter = {
      source: 'weird',
      label: 'weird',
      fetchRecords: vi.fn().mockRejectedValue('boom'),
    };

    const summary = await runIngest(db, [failing], { now: NOW });
    expect(summary.adapters[0]?.error).toBe('boom');
  });

  it('re-running an adapter updates rather than duplicates', async () => {
    await runIngest(db, [adapter('alpha', [record('1', { name: '旧' })])], { now: NOW });
    await runIngest(db, [adapter('alpha', [record('1', { name: '新' })])], { now: NOW });

    expect(await getParkingById(db, 'alpha-1')).toMatchObject({ name: '新' });
  });

  it('defaults the observation time to now', async () => {
    await runIngest(db, [adapter('alpha', [record('1', { availability: '満車' })])]);

    const snapshot = (await latestSnapshots(db, ['alpha-1'])).get('alpha-1');
    expect(Date.parse(snapshot?.observedAt ?? '')).toBeGreaterThan(Date.now() - 60_000);
  });

  it('handles having no adapters at all', async () => {
    expect(await runIngest(db, [], { now: NOW })).toEqual({
      parkingsUpserted: 0,
      snapshotsRecorded: 0,
      adapters: [],
    });
  });
});
