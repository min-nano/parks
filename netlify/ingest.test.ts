import { describe, expect, it, vi } from 'vitest';

// Deliberately outside `netlify/functions/`: Netlify packages every file in
// that directory as a deployable function, so a test file living there would be
// published as a live endpoint.
import handler, { config, triggerIngest } from './functions/ingest';

const CONFIGURED = { CRON_SECRET: 'topsecret', URL: 'https://parks.netlify.app' };

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('triggerIngest', () => {
  it('stays disabled until a cron secret is configured', async () => {
    const fetchImpl = vi.fn();

    const response = await triggerIngest({}, fetchImpl as unknown as typeof fetch);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('CRON_SECRET'),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails when Netlify exposes no site URL', async () => {
    const response = await triggerIngest(
      { CRON_SECRET: 'topsecret' },
      vi.fn() as unknown as typeof fetch,
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'no site URL available' });
  });

  it('falls back to the branch deploy URL', async () => {
    const fetchImpl = vi.fn().mockReturnValue(jsonResponse({ parkingsUpserted: 0 }));

    await triggerIngest(
      { CRON_SECRET: 'topsecret', DEPLOY_URL: 'https://deploy-preview-7--parks.netlify.app' },
      fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://deploy-preview-7--parks.netlify.app/api/cron/ingest',
      { headers: { authorization: 'Bearer topsecret' } },
    );
  });

  it('calls the ingest route with the bearer token and returns its summary', async () => {
    const summary = { parkingsUpserted: 3, snapshotsRecorded: 2, adapters: [] };
    const fetchImpl = vi.fn().mockReturnValue(jsonResponse(summary));

    const response = await triggerIngest(CONFIGURED, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith('https://parks.netlify.app/api/cron/ingest', {
      headers: { authorization: 'Bearer topsecret' },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, summary });
  });

  it('reports a failing ingest run so the schedule shows red', async () => {
    const fetchImpl = vi.fn().mockReturnValue(jsonResponse({ error: 'boom' }, 500));

    const response = await triggerIngest(CONFIGURED, fetchImpl as unknown as typeof fetch);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'ingest returned HTTP 500',
      body: { error: 'boom' },
    });
  });

  it('tolerates an error response that is not JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('<html>gateway timeout</html>', { status: 504 }));

    const response = await triggerIngest(CONFIGURED, fetchImpl as unknown as typeof fetch);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ body: null });
  });

  it.each([
    ['an Error', new Error('ECONNREFUSED'), 'ECONNREFUSED'],
    ['a non-Error', 'boom', 'boom'],
  ])('surfaces %s thrown by fetch', async (_label, thrown, expected) => {
    const fetchImpl = vi.fn().mockRejectedValue(thrown);

    const response = await triggerIngest(CONFIGURED, fetchImpl as unknown as typeof fetch);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: `ingest request failed: ${expected}`,
    });
  });
});

describe('the scheduled function', () => {
  it('runs every ten minutes', () => {
    expect(config.schedule).toBe('*/10 * * * *');
  });

  it('reads its configuration from the environment', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await handler();

    expect(response.status).toBe(503);
    vi.unstubAllEnvs();
  });
});
