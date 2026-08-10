import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('reports demo mode when no database is configured', async () => {
    vi.stubEnv('DATABASE_URL', '');

    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', demoMode: true });
  });

  it('reports normal mode once a database is configured', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@host/db');

    await expect(GET().json()).resolves.toEqual({ status: 'ok', demoMode: false });
  });
});
