import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/db/client';
import type { VehicleProfile } from '@/domain/types';
import { currentUserId } from '@/server/auth';
import { createTestDatabase, truncateAll } from '@/test/db';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDatabase: () => Promise.resolve(state.db),
}));

vi.mock('@/server/auth', () => ({ currentUserId: vi.fn() }));

const { GET, PUT } = await import('./route');
const userIdMock = vi.mocked(currentUserId);

const VALID = {
  name: 'ハイエース',
  lengthMm: 5380,
  widthMm: 1880,
  heightMm: 2285,
  weightKg: 2500,
};

const put = (body: unknown) =>
  PUT(
    new Request('https://parks.test/api/vehicle-profile', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  );

let db: Database;

beforeAll(async () => {
  db = await createTestDatabase();
  state.db = db;
});

beforeEach(async () => {
  await truncateAll(db);
  userIdMock.mockReset();
  userIdMock.mockResolvedValue('user_123');
});

describe('vehicle profile endpoints', () => {
  it('requires sign-in to read', async () => {
    userIdMock.mockResolvedValue(null);

    expect((await GET()).status).toBe(401);
  });

  it('requires sign-in to write', async () => {
    userIdMock.mockResolvedValue(null);

    expect((await put(VALID)).status).toBe(401);
  });

  it('returns null before a profile is saved', async () => {
    await expect((await GET()).json()).resolves.toEqual({ profile: null });
  });

  it('rejects an invalid profile', async () => {
    const response = await put({ ...VALID, weightKg: 0 });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid vehicle profile' });
  });

  it('saves and reads back the profile', async () => {
    const saved = (await (await put({ ...VALID, tireWidthMm: 215 })).json()) as {
      profile: VehicleProfile;
    };

    expect(saved.profile).toMatchObject({ userId: 'user_123', name: 'ハイエース', tireWidthMm: 215 });

    const read = (await (await GET()).json()) as { profile: VehicleProfile };
    expect(read.profile.heightMm).toBe(2285);
  });

  it('defaults an omitted tyre width to null', async () => {
    const saved = (await (await put(VALID)).json()) as { profile: VehicleProfile };

    expect(saved.profile.tireWidthMm).toBeNull();
  });

  it('overwrites an existing profile', async () => {
    await put(VALID);
    await put({ ...VALID, name: '軽自動車', heightMm: 1650 });

    const read = (await (await GET()).json()) as { profile: VehicleProfile };
    expect(read.profile).toMatchObject({ name: '軽自動車', heightMm: 1650 });
  });
});
