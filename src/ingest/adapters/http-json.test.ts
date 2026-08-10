import { describe, expect, it, vi } from 'vitest';

import { createHttpJsonAdapter } from './http-json';

const response = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: () => Promise.resolve(body),
});

describe('createHttpJsonAdapter', () => {
  it('returns a top-level array as-is', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response([{ sourceId: '1' }]));
    const adapter = createHttpJsonAdapter({
      source: 'alpha',
      label: 'Alpha',
      endpoint: 'https://example.com/feed',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await adapter.fetchRecords()).toEqual([{ sourceId: '1' }]);
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/feed', {
      headers: { accept: 'application/json' },
    });
  });

  it('merges custom headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response([]));
    const adapter = createHttpJsonAdapter({
      source: 'alpha',
      label: 'Alpha',
      endpoint: 'https://example.com/feed',
      headers: { authorization: 'Bearer x' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await adapter.fetchRecords();

    expect(fetchImpl.mock.calls[0]?.[1]).toEqual({
      headers: { accept: 'application/json', authorization: 'Bearer x' },
    });
  });

  it('unwraps an envelope with a custom selector', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ data: { items: [{ sourceId: '1' }] } }));
    const adapter = createHttpJsonAdapter({
      source: 'alpha',
      label: 'Alpha',
      endpoint: 'https://example.com/feed',
      select: (payload) => (payload as { data: { items: unknown[] } }).data.items,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await adapter.fetchRecords()).toEqual([{ sourceId: '1' }]);
  });

  it('yields nothing when the payload is not an array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ unexpected: true }));
    const adapter = createHttpJsonAdapter({
      source: 'alpha',
      label: 'Alpha',
      endpoint: 'https://example.com/feed',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await adapter.fetchRecords()).toEqual([]);
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(null, { ok: false, status: 503 }));
    const adapter = createHttpJsonAdapter({
      source: 'alpha',
      label: 'Alpha',
      endpoint: 'https://example.com/feed',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(adapter.fetchRecords()).rejects.toThrow('alpha: HTTP 503');
  });

  it('uses the global fetch when none is injected', async () => {
    const globalFetch = vi.fn().mockResolvedValue(response([]));
    vi.stubGlobal('fetch', globalFetch);

    const adapter = createHttpJsonAdapter({
      source: 'alpha',
      label: 'Alpha',
      endpoint: 'https://example.com/feed',
    });
    await adapter.fetchRecords();

    expect(globalFetch).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
