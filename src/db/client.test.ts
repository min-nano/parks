import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDemoDatabase,
  createNeonDatabase,
  getDatabase,
  isDemoMode,
  resetDatabaseCache,
} from './client';
import { getParkingById } from './repository';

const NEON_URL = 'postgres://user:pass@ep-demo.eu-central-1.aws.neon.tech/parks';

beforeEach(() => {
  resetDatabaseCache();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetDatabaseCache();
});

describe('isDemoMode', () => {
  it('is on without a database URL and off with one', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(isDemoMode()).toBe(true);

    vi.stubEnv('DATABASE_URL', NEON_URL);
    expect(isDemoMode()).toBe(false);
  });
});

describe('createNeonDatabase', () => {
  it('builds a drizzle handle over the HTTP driver', async () => {
    const db = await createNeonDatabase(NEON_URL);
    expect(typeof db.select).toBe('function');
  });
});

describe('createDemoDatabase', () => {
  it('comes up migrated and seeded', async () => {
    const db = await createDemoDatabase();
    expect(await getParkingById(db, 'demo-shibuya-001')).not.toBeNull();
  });
});

describe('getDatabase', () => {
  it('warns and falls back to demo mode without a database URL', async () => {
    vi.stubEnv('DATABASE_URL', '');

    const db = await getDatabase();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('demo mode'));
    expect(await getParkingById(db, 'demo-shibuya-001')).not.toBeNull();
  });

  it('memoises the connection', async () => {
    vi.stubEnv('DATABASE_URL', NEON_URL);

    expect(await getDatabase()).toBe(await getDatabase());
  });

  it('re-reads the environment after a reset', async () => {
    vi.stubEnv('DATABASE_URL', NEON_URL);
    const first = await getDatabase();

    resetDatabaseCache();
    const second = await getDatabase();

    expect(second).not.toBe(first);
  });
});
