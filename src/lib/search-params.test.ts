import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_RADIUS_METERS,
  DEFAULT_RESULT_LIMIT,
  REPORTABLE_STATUSES,
  parseEstimateQuery,
  parseReportBody,
  parseSearchQuery,
  parseVehicleProfileBody,
  resolveVehicle,
  toRecord,
} from './search-params';

const NOW = new Date('2026-08-10T12:00:00.000Z');
const params = (query: string) => new URLSearchParams(query);

describe('toRecord', () => {
  const keys = ['lat', 'radius', 'ev'];

  it('drops blank values so defaults still apply', () => {
    expect(toRecord(params('lat=35&radius=&ev='), keys)).toEqual({ lat: '35' });
  });

  it('ignores parameters that are not on the allow list', () => {
    expect(toRecord(params('lat=35&surprise=1'), keys)).toEqual({ lat: '35' });
  });

  it('never lets a request name a property on the result', () => {
    const hostile = params('__proto__=polluted&constructor=polluted&lat=35');

    const record = toRecord(hostile, keys);

    expect(record).toEqual({ lat: '35' });
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('query parsing rejects hostile parameter names', () => {
  it('ignores __proto__ in a search query', () => {
    const result = parseSearchQuery(
      params('lat=35.658&lng=139.7016&__proto__=polluted'),
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('parseSearchQuery', () => {
  it('fills in every default around a bare coordinate', () => {
    const result = parseSearchQuery(params('lat=35.658&lng=139.7016'), NOW);

    expect(result).toEqual({
      ok: true,
      value: {
        center: { lat: 35.658, lng: 139.7016 },
        radiusMeters: DEFAULT_RADIUS_METERS,
        vehicle: null,
        structures: [],
        requireEvCharging: false,
        hideFull: false,
        arrival: NOW,
        durationMinutes: DEFAULT_DURATION_MINUTES,
        limit: DEFAULT_RESULT_LIMIT,
      },
    });
  });

  it('reads the full filter set', () => {
    const result = parseSearchQuery(
      params(
        'lat=35.658&lng=139.7016&radius=1500&preset=kei&structures=flat,mechanical&ev=1&hideFull=true&duration=180&limit=10&arrival=2026-08-10T09:00:00.000Z',
      ),
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      radiusMeters: 1500,
      structures: ['flat', 'mechanical'],
      requireEvCharging: true,
      hideFull: true,
      durationMinutes: 180,
      limit: 10,
    });
    expect(result.value.arrival.toISOString()).toBe('2026-08-10T09:00:00.000Z');
    expect(result.value.vehicle).toMatchObject({ lengthMm: 3400, widthMm: 1480 });
  });

  it.each([
    ['missing coordinates', ''],
    ['out of range latitude', 'lat=100&lng=139'],
    ['non-numeric radius', 'lat=35&lng=139&radius=wide'],
    ['radius above the cap', 'lat=35&lng=139&radius=99999'],
    ['unknown structure', 'lat=35&lng=139&structures=treehouse'],
    ['invalid arrival', 'lat=35&lng=139&arrival=yesterday'],
    ['invalid boolean', 'lat=35&lng=139&ev=maybe'],
    ['zero-length duration', 'lat=35&lng=139&duration=0'],
  ])('rejects %s', (_label, query) => {
    const result = parseSearchQuery(params(query), NOW);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('invalid search query');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects an unknown preset', () => {
    const result = parseSearchQuery(params('lat=35&lng=139&preset=hovercraft'), NOW);

    expect(result).toEqual({
      ok: false,
      message: 'unknown vehicle preset: hovercraft',
      issues: [],
    });
  });
});

describe('resolveVehicle', () => {
  it('returns null when nothing narrows by vehicle', () => {
    expect(resolveVehicle({})).toEqual({ ok: true, value: null });
  });

  it('lets explicit dimensions override the preset', () => {
    const result = resolveVehicle({ preset: 'kei', height: 1900, tireWidth: 195 });

    expect(result).toEqual({
      ok: true,
      value: {
        lengthMm: 3400,
        widthMm: 1480,
        heightMm: 1900,
        weightKg: 900,
        tireWidthMm: 195,
      },
    });
  });

  it('accepts a full set of dimensions with no preset', () => {
    const result = resolveVehicle({ length: 4000, width: 1700, height: 1500, weight: 1200 });

    expect(result).toEqual({
      ok: true,
      value: {
        lengthMm: 4000,
        widthMm: 1700,
        heightMm: 1500,
        weightKg: 1200,
        tireWidthMm: null,
      },
    });
  });

  it.each([
    ['length', { width: 1700, height: 1500, weight: 1200 }],
    ['width', { length: 4000, height: 1500, weight: 1200 }],
    ['height', { length: 4000, width: 1700, weight: 1200 }],
    ['weight', { length: 4000, width: 1700, height: 1500 }],
  ])('refuses a partial vehicle missing %s', (_label, query) => {
    const result = resolveVehicle(query);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/all required/);
  });
});

describe('parseEstimateQuery', () => {
  it('defaults the arrival to now', () => {
    const result = parseEstimateQuery(params(''), NOW);

    expect(result).toEqual({
      ok: true,
      value: { vehicle: null, arrival: NOW, durationMinutes: DEFAULT_DURATION_MINUTES },
    });
  });

  it('resolves the vehicle from a preset', () => {
    const result = parseEstimateQuery(params('preset=van&duration=90'), NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.vehicle?.heightMm).toBe(2285);
    expect(result.value.durationMinutes).toBe(90);
  });

  it('reports a bad duration', () => {
    const result = parseEstimateQuery(params('duration=-5'), NOW);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('invalid query');
  });

  it('propagates an unknown preset', () => {
    const result = parseEstimateQuery(params('preset=tank'), NOW);
    expect(result.ok).toBe(false);
  });
});

describe('parseReportBody', () => {
  it('accepts a minimal report', () => {
    expect(parseReportBody({ status: 'full' })).toEqual({
      ok: true,
      value: { status: 'full' },
    });
  });

  it('trims the note and keeps the count', () => {
    const result = parseReportBody({ status: 'available', vacantCount: 3, note: '  空いてます  ' });

    expect(result).toEqual({
      ok: true,
      value: { status: 'available', vacantCount: 3, note: '空いてます' },
    });
  });

  it.each([
    ['a missing status', {}],
    ['an unreportable status', { status: 'unknown' }],
    ['a negative count', { status: 'full', vacantCount: -1 }],
    ['a fractional count', { status: 'full', vacantCount: 1.5 }],
    ['an overlong note', { status: 'full', note: 'あ'.repeat(281) }],
    ['a non-object body', 'full'],
    ['an undefined body', undefined],
  ])('rejects %s', (_label, body) => {
    const result = parseReportBody(body);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('invalid report');
  });

  it('only offers definite statuses', () => {
    expect(REPORTABLE_STATUSES).toEqual(['available', 'crowded', 'full']);
  });
});

describe('parseVehicleProfileBody', () => {
  const valid = {
    name: 'ハイエース',
    lengthMm: 5380,
    widthMm: 1880,
    heightMm: 2285,
    weightKg: 2500,
  };

  it('accepts a profile without a tyre width', () => {
    expect(parseVehicleProfileBody(valid)).toEqual({ ok: true, value: valid });
  });

  it.each([
    ['a blank name', { ...valid, name: '   ' }],
    ['a zero dimension', { ...valid, widthMm: 0 }],
    ['an absurd weight', { ...valid, weightKg: 999_999 }],
    ['a string dimension', { ...valid, lengthMm: '5380' }],
  ])('rejects %s', (_label, body) => {
    const result = parseVehicleProfileBody(body);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('invalid vehicle profile');
  });
});
