import { describe, expect, it } from 'vitest';

import { DEFAULT_RESOLVE_OPTIONS, resolveAvailability } from './availability';
import type { AvailabilitySnapshot, AvailabilityStatus, UserReport } from './types';

const NOW = new Date('2026-08-10T12:00:00.000Z');

const minutesAgo = (minutes: number): string =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

const snapshot = (
  status: AvailabilityStatus,
  ageMinutes: number,
  observedAt = minutesAgo(ageMinutes),
): AvailabilitySnapshot => ({
  parkingId: 'p1',
  status,
  vacantCount: null,
  observedAt,
  source: 'operator',
});

const report = (
  status: AvailabilityStatus,
  ageMinutes: number,
  overrides: Partial<UserReport> = {},
): UserReport => ({
  id: `r-${status}-${ageMinutes}`,
  parkingId: 'p1',
  userId: 'u1',
  status,
  vacantCount: null,
  note: null,
  createdAt: minutesAgo(ageMinutes),
  ...overrides,
});

describe('resolveAvailability', () => {
  it('returns unknown when there is no evidence at all', () => {
    expect(resolveAvailability({ official: null, reports: [], now: NOW })).toEqual({
      status: 'unknown',
      confidence: 0,
      source: 'none',
      observedAt: null,
      reportCount: 0,
    });
  });

  it('trusts a fresh official snapshot', () => {
    const result = resolveAvailability({ official: snapshot('available', 0), reports: [], now: NOW });

    expect(result.status).toBe('available');
    expect(result.source).toBe('official');
    expect(result.confidence).toBeCloseTo(0.71, 2);
    expect(result.reportCount).toBe(0);
  });

  it('lets fresh community reports outweigh a stale official snapshot', () => {
    const result = resolveAvailability({
      official: snapshot('full', 180),
      reports: [report('available', 0), report('available', 1)],
      now: NOW,
    });

    expect(result.status).toBe('available');
    expect(result.source).toBe('community');
    expect(result.reportCount).toBe(2);
    expect(result.observedAt).toBe(minutesAgo(0));
  });

  it('keeps the official answer while it is still recent', () => {
    const result = resolveAvailability({
      official: snapshot('full', 5),
      reports: [report('available', 20)],
      now: NOW,
    });

    expect(result.status).toBe('full');
    expect(result.source).toBe('official');
  });

  it('drops evidence that carries no signal', () => {
    const result = resolveAvailability({
      official: snapshot('unknown', 0),
      reports: [report('unknown', 0)],
      now: NOW,
    });

    expect(result.status).toBe('unknown');
    expect(result.source).toBe('none');
  });

  it('ignores unparseable timestamps', () => {
    const result = resolveAvailability({
      official: snapshot('full', 0, 'not-a-date'),
      reports: [report('available', 0, { createdAt: 'also-not-a-date' })],
      now: NOW,
    });

    expect(result.source).toBe('none');
  });

  it('forgets evidence once it has decayed below the noise floor', () => {
    const result = resolveAvailability({
      official: null,
      reports: [report('available', 300)],
      now: NOW,
    });

    expect(result.status).toBe('unknown');
  });

  it('raises confidence when reports agree and lowers it when they conflict', () => {
    const agreeing = resolveAvailability({
      official: null,
      reports: [report('full', 0), report('full', 1), report('full', 2)],
      now: NOW,
    });
    const conflicting = resolveAvailability({
      official: null,
      reports: [report('full', 0), report('available', 1), report('crowded', 2)],
      now: NOW,
    });

    expect(agreeing.confidence).toBeGreaterThan(conflicting.confidence);
    expect(conflicting.status).toBe('full');
  });

  it('reports the newest supporting timestamp whatever order the reports arrive in', () => {
    const ascending = resolveAvailability({
      official: null,
      reports: [report('full', 20), report('full', 1)],
      now: NOW,
    });
    const descending = resolveAvailability({
      official: null,
      reports: [report('full', 1), report('full', 20)],
      now: NOW,
    });

    expect(ascending.observedAt).toBe(minutesAgo(1));
    expect(descending.observedAt).toBe(minutesAgo(1));
  });

  it('resolves a dead heat deterministically', () => {
    const result = resolveAvailability({
      official: null,
      reports: [report('crowded', 0), report('available', 0)],
      now: NOW,
    });

    expect(result.status).toBe('crowded');
  });

  it('treats a future timestamp as brand new rather than negatively aged', () => {
    const result = resolveAvailability({
      official: null,
      reports: [report('available', -10)],
      now: NOW,
    });

    expect(result.status).toBe('available');
  });

  it('honours custom weighting', () => {
    const input = {
      official: snapshot('full', 60),
      reports: [report('available', 0)],
      now: NOW,
    };

    expect(resolveAvailability(input).status).toBe('available');
    expect(
      resolveAvailability(input, { ...DEFAULT_RESOLVE_OPTIONS, officialWeight: 20 }).status,
    ).toBe('full');
  });
});
