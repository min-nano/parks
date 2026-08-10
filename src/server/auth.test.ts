import { auth } from '@clerk/nextjs/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentUserId } from './auth';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

const authMock = vi.mocked(auth);
const CONFIGURED = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x' };

beforeEach(() => {
  authMock.mockReset();
});

describe('currentUserId', () => {
  it('returns null without asking Clerk when auth is not configured', async () => {
    await expect(currentUserId({})).resolves.toBeNull();
    expect(authMock).not.toHaveBeenCalled();
  });

  it('returns the signed-in user id', async () => {
    authMock.mockResolvedValue({ userId: 'user_123' } as never);

    await expect(currentUserId(CONFIGURED)).resolves.toBe('user_123');
  });

  it('returns null for an anonymous visitor', async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    await expect(currentUserId(CONFIGURED)).resolves.toBeNull();
  });

  it('returns null instead of throwing when the session cannot be read', async () => {
    authMock.mockRejectedValue(new Error('clerkMiddleware() was not run'));

    await expect(currentUserId(CONFIGURED)).resolves.toBeNull();
  });

  it('reads process.env by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');

    await expect(currentUserId()).resolves.toBeNull();

    vi.unstubAllEnvs();
  });
});
