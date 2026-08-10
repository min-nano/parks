import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, fetchParkingDetail, searchParkings, submitReport } from './api-client';
import { DEFAULT_FILTERS } from './filters';

const CENTER = { lat: 35.658, lng: 139.7016 };

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

describe('searchParkings', () => {
  it('builds the query from the filter state', async () => {
    fetchMock.mockReturnValue(ok({ items: [], count: 0 }));

    await searchParkings(CENTER, { ...DEFAULT_FILTERS, hideFull: true });

    const url = new URL(fetchMock.mock.calls[0]?.[0] as string, 'http://localhost');
    expect(url.pathname).toBe('/api/parkings');
    expect(url.searchParams.get('lat')).toBe('35.658');
    expect(url.searchParams.get('hideFull')).toBe('1');
  });

  it('passes the abort signal through', async () => {
    fetchMock.mockReturnValue(ok({ items: [] }));
    const controller = new AbortController();

    await searchParkings(CENTER, DEFAULT_FILTERS, { signal: controller.signal });

    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });
});

describe('fetchParkingDetail', () => {
  it('encodes the id', async () => {
    fetchMock.mockReturnValue(ok({ parking: { id: 'a/b' } }));

    await fetchParkingDetail('a/b');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/parkings/a%2Fb');
  });
});

describe('submitReport', () => {
  it('posts JSON', async () => {
    fetchMock.mockReturnValue(ok({ report: { id: 'r1' } }));

    const result = await submitReport('p1', { status: 'full', vacantCount: 0, note: null });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'full', vacantCount: 0, note: null }),
    });
    expect(result).toEqual({ report: { id: 'r1' } });
  });
});

describe('error handling', () => {
  it('surfaces the API error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'invalid search query' }),
    });

    await expect(searchParkings(CENTER, DEFAULT_FILTERS)).rejects.toThrow(
      'invalid search query',
    );
  });

  it('falls back to the status code when the body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(searchParkings(CENTER, DEFAULT_FILTERS)).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      message: 'request failed (503)',
    });
  });

  it('falls back when the error body has no message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    await expect(submitReport('p1', { status: 'full' })).rejects.toBeInstanceOf(ApiError);
  });
});
