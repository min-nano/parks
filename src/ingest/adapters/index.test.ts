import { describe, expect, it, vi } from 'vitest';

import { configuredAdapters } from './index';

const FEEDS = JSON.stringify([
  { source: 'alpha', label: 'Alpha', endpoint: 'https://example.com/a' },
  { source: 'beta', label: 'Beta', endpoint: 'https://example.com/b' },
]);

describe('configuredAdapters', () => {
  it('returns nothing when unconfigured', () => {
    expect(configuredAdapters({})).toEqual([]);
    expect(configuredAdapters({ INGEST_SOURCES: '' })).toEqual([]);
  });

  it('builds one adapter per configured feed', () => {
    const adapters = configuredAdapters({ INGEST_SOURCES: FEEDS });

    expect(adapters.map((adapter) => adapter.source)).toEqual(['alpha', 'beta']);
  });

  it('wires the injected fetch into each adapter', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });

    const adapters = configuredAdapters(
      { INGEST_SOURCES: FEEDS },
      fetchImpl as unknown as typeof fetch,
    );
    await adapters[0]?.fetchRecords();

    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/a', expect.anything());
  });

  it('rejects invalid JSON', () => {
    expect(() => configuredAdapters({ INGEST_SOURCES: '{oops' })).toThrow(
      'INGEST_SOURCES must be valid JSON',
    );
  });

  it.each([
    ['a non-array', '{"source":"a"}'],
    ['a missing endpoint', '[{"source":"a","label":"A"}]'],
    ['a non-URL endpoint', '[{"source":"a","label":"A","endpoint":"not-a-url"}]'],
  ])('rejects %s', (_label, value) => {
    expect(() => configuredAdapters({ INGEST_SOURCES: value })).toThrow(/malformed/);
  });

  it('reads process.env by default', () => {
    expect(configuredAdapters()).toEqual([]);
  });
});
