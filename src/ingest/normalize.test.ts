import { describe, expect, it } from 'vitest';

import {
  normalizeAvailability,
  normalizeFeeSchedule,
  normalizeRecord,
  normalizeStructure,
  parseDimensionMm,
  parseWeightKg,
  rawRecordSchema,
  type RawParkingRecord,
} from './normalize';

const OBSERVED_AT = new Date('2026-08-10T12:00:00.000Z');

const raw = (overrides: Partial<RawParkingRecord> = {}): RawParkingRecord =>
  rawRecordSchema.parse({
    sourceId: 'A-01',
    name: 'サンプル駐車場',
    lat: 35.658,
    lng: 139.7016,
    ...overrides,
  });

describe('normalizeStructure', () => {
  it.each([
    ['平面', 'flat'],
    ['機械式', 'mechanical'],
    ['タワー式', 'mechanical'],
    ['自走式立体', 'multistory'],
    ['地下駐車場', 'underground'],
    ['パーキングメーター', 'roadside'],
    ['  平面  ', 'flat'],
    ['multistory', 'multistory'],
  ])('maps %s', (input, expected) => {
    expect(normalizeStructure(input)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['宇宙ステーション']])(
    'falls back to flat for %s',
    (input) => {
      expect(normalizeStructure(input)).toBe('flat');
    },
  );
});

describe('normalizeAvailability', () => {
  it.each([
    ['空車', 'available'],
    ['混雑', 'crowded'],
    ['満車', 'full'],
    ['full', 'full'],
  ])('maps %s', (input, expected) => {
    expect(normalizeAvailability(input)).toBe(expected);
  });

  it.each([[null], [undefined], [''], ['準備中']])('maps %s to unknown', (input) => {
    expect(normalizeAvailability(input)).toBe('unknown');
  });
});

describe('parseDimensionMm', () => {
  it.each([
    ['2100mm', 2100],
    ['210cm', 2100],
    ['2.1m', 2100],
    ['2.1 M', 2100],
    ['2100', 2100],
    ['2.1', 2100],
    [2100, 2100],
    [2.1, 2100],
  ])('parses %s', (input, expected) => {
    expect(parseDimensionMm(input)).toBe(expected);
  });

  it.each([[null], [undefined], ['制限なし'], ['-2.1m'], ['0'], [0], [-5], [Number.NaN]])(
    'returns null for %s',
    (input) => {
      expect(parseDimensionMm(input)).toBeNull();
    },
  );
});

describe('parseWeightKg', () => {
  it.each([
    ['2500kg', 2500],
    ['2.5t', 2500],
    ['2500', 2500],
    [2500, 2500],
    [2500.4, 2500],
  ])('parses %s', (input, expected) => {
    expect(parseWeightKg(input)).toBe(expected);
  });

  it.each([[null], [undefined], ['unlimited'], ['-1kg'], [0], [Number.POSITIVE_INFINITY]])(
    'returns null for %s',
    (input) => {
      expect(parseWeightKg(input)).toBeNull();
    },
  );
});

describe('normalizeFeeSchedule', () => {
  it('builds day, night and cap rules', () => {
    const schedule = normalizeFeeSchedule(
      raw({
        dayRateYen: 200,
        dayRateMinutes: 20,
        nightRateYen: 100,
        nightRateMinutes: 60,
        dailyMaxYen: 1_800,
      }),
    );

    expect(schedule.segments.map((segment) => segment.id)).toEqual(['day', 'night']);
    expect(schedule.segments[0]).toMatchObject({ unitMinutes: 20, unitYen: 200 });
    expect(schedule.caps).toEqual([
      {
        id: 'daily-cap',
        label: '24時間最大 1800円',
        window: { startMinute: 0, endMinute: 1440 },
        capYen: 1_800,
        repeat: 'once',
      },
    ]);
  });

  it('defaults a missing unit length to one hour', () => {
    const schedule = normalizeFeeSchedule(raw({ dayRateYen: 300, nightRateYen: 150 }));

    expect(schedule.segments.map((segment) => segment.unitMinutes)).toEqual([60, 60]);
  });

  it('produces an empty schedule when no rate is published', () => {
    expect(normalizeFeeSchedule(raw())).toEqual({ currency: 'JPY', segments: [], caps: [] });
  });
});

describe('normalizeRecord', () => {
  it('maps a fully populated feed record', () => {
    const { parking, snapshot } = normalizeRecord(
      'timesclub',
      raw({
        sourceId: 'B-2',
        name: 'タイムズ渋谷',
        address: '東京都渋谷区1-1',
        structure: '機械式',
        capacity: 30,
        maxLength: '5.0m',
        maxWidth: '185cm',
        maxHeight: '1550mm',
        maxWeight: '2t',
        maxTireWidth: 205,
        evCharging: true,
        cashless: true,
        dayRateYen: 220,
        dayRateMinutes: 15,
        availability: '満車',
        vacantCount: 0,
        officialUrl: 'https://example.com/b2',
      }),
      OBSERVED_AT,
    );

    expect(parking).toMatchObject({
      id: 'timesclub-B-2',
      source: 'timesclub',
      structure: 'mechanical',
      capacity: 30,
      limits: {
        maxLengthMm: 5000,
        maxWidthMm: 1850,
        maxHeightMm: 1550,
        maxWeightKg: 2000,
        maxTireWidthMm: 205,
      },
      features: {
        evCharging: true,
        hasRoof: false,
        cashless: true,
        open24h: false,
        accessible: false,
      },
      officialUrl: 'https://example.com/b2',
      updatedAt: OBSERVED_AT.toISOString(),
    });

    expect(snapshot).toEqual({
      parkingId: 'timesclub-B-2',
      status: 'full',
      vacantCount: 0,
      observedAt: OBSERVED_AT.toISOString(),
      source: 'timesclub',
    });
  });

  it('defaults everything the feed leaves out', () => {
    const { parking, snapshot } = normalizeRecord('demo', raw(), OBSERVED_AT);

    expect(parking.address).toBe('');
    expect(parking.capacity).toBeNull();
    expect(parking.officialUrl).toBeNull();
    expect(parking.limits).toEqual({
      maxLengthMm: null,
      maxWidthMm: null,
      maxHeightMm: null,
      maxWeightKg: null,
      maxTireWidthMm: null,
    });
    expect(snapshot).toBeNull();
  });

  it('still records a snapshot when only a vacancy count is published', () => {
    const { snapshot } = normalizeRecord('demo', raw({ vacantCount: 4 }), OBSERVED_AT);

    expect(snapshot).toMatchObject({ status: 'unknown', vacantCount: 4 });
  });
});

describe('rawRecordSchema', () => {
  it.each([
    ['a missing id', { name: 'x', lat: 35, lng: 139 }],
    ['a missing name', { sourceId: 'a', lat: 35, lng: 139 }],
    ['an out-of-range latitude', { sourceId: 'a', name: 'x', lat: 200, lng: 139 }],
    ['a string coordinate', { sourceId: 'a', name: 'x', lat: '35', lng: 139 }],
  ])('rejects %s', (_label, record) => {
    expect(rawRecordSchema.safeParse(record).success).toBe(false);
  });
});
