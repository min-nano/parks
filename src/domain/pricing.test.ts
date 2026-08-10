import { describe, expect, it } from 'vitest';

import { MAX_ESTIMATE_MINUTES, cheapestUnitRate, estimateFee, formatYen } from './pricing';
import type { FeeSchedule } from './types';

/** 08:00-20:00 200円/20分, 20:00-08:00 100円/60分. */
const DAY_NIGHT: FeeSchedule = {
  currency: 'JPY',
  segments: [
    {
      id: 'day',
      label: '昼',
      window: { startMinute: 480, endMinute: 1200 },
      unitMinutes: 20,
      unitYen: 200,
    },
    {
      id: 'night',
      label: '夜',
      window: { startMinute: 1200, endMinute: 1920 },
      unitMinutes: 60,
      unitYen: 100,
    },
  ],
  caps: [],
};

/** Local time; `vitest.setup.ts` pins the zone to Asia/Tokyo. */
const at = (hour: number, minute = 0): Date => new Date(2026, 7, 10, hour, minute);

describe('estimateFee', () => {
  it('bills a stay inside one segment by rounding up to whole units', () => {
    const estimate = estimateFee(DAY_NIGHT, { arrival: at(10), durationMinutes: 61 });

    expect(estimate.blocks).toHaveLength(1);
    expect(estimate.blocks[0]).toMatchObject({ segmentId: 'day', units: 4, yen: 800 });
    expect(estimate.totalYen).toBe(800);
    expect(estimate.uncoveredMinutes).toBe(0);
    expect(estimate.clamped).toBe(false);
  });

  it('switches tariff when the stay crosses a segment boundary', () => {
    const estimate = estimateFee(DAY_NIGHT, { arrival: at(19), durationMinutes: 120 });

    expect(estimate.blocks.map((block) => [block.segmentId, block.yen])).toEqual([
      ['day', 600],
      ['night', 100],
    ]);
    expect(estimate.totalYen).toBe(700);
  });

  it('carries the schedule across midnight into the next day', () => {
    const estimate = estimateFee(DAY_NIGHT, { arrival: at(23), durationMinutes: 600 });

    expect(estimate.blocks.map((block) => [block.segmentId, block.minutes, block.yen])).toEqual([
      ['night', 540, 900],
      ['day', 60, 600],
    ]);
    expect(estimate.totalYen).toBe(1500);
  });

  it('keeps the meter running across midnight for an all-day tariff', () => {
    const allDay: FeeSchedule = {
      currency: 'JPY',
      segments: [
        {
          id: 'all',
          label: '終日',
          window: { startMinute: 0, endMinute: 1440 },
          unitMinutes: 25,
          unitYen: 100,
        },
      ],
      caps: [],
    };

    const estimate = estimateFee(allDay, { arrival: at(20), durationMinutes: 720 });

    // Restarting the meter at midnight would bill 10 + 20 = 30 units.
    expect(estimate.blocks).toHaveLength(1);
    expect(estimate.blocks[0]?.units).toBe(29);
    expect(estimate.totalYen).toBe(2900);
  });

  it('reports time the schedule does not price', () => {
    const daytimeOnly: FeeSchedule = {
      currency: 'JPY',
      segments: [DAY_NIGHT.segments[0]!],
      caps: [],
    };

    const estimate = estimateFee(daytimeOnly, { arrival: at(19), durationMinutes: 120 });

    expect(estimate.totalYen).toBe(600);
    expect(estimate.uncoveredMinutes).toBe(60);
  });

  it('gives the earlier segment priority where windows overlap', () => {
    const overlapping: FeeSchedule = {
      currency: 'JPY',
      segments: [
        {
          id: 'promo',
          label: '割引',
          window: { startMinute: 0, endMinute: 1440 },
          unitMinutes: 60,
          unitYen: 100,
        },
        {
          id: 'standard',
          label: '通常',
          window: { startMinute: 0, endMinute: 1440 },
          unitMinutes: 60,
          unitYen: 500,
        },
      ],
      caps: [],
    };

    const estimate = estimateFee(overlapping, { arrival: at(10), durationMinutes: 120 });
    expect(estimate.blocks[0]?.segmentId).toBe('promo');
    expect(estimate.totalYen).toBe(200);
  });

  it.each([
    ['zero', 0],
    ['negative', -30],
    ['not a number', Number.NaN],
  ])('returns an empty estimate for a %s duration', (_label, durationMinutes) => {
    expect(estimateFee(DAY_NIGHT, { arrival: at(10), durationMinutes })).toEqual({
      totalYen: 0,
      blocks: [],
      appliedCaps: [],
      uncoveredMinutes: 0,
      clamped: false,
    });
  });

  it('clamps absurdly long stays', () => {
    const estimate = estimateFee(DAY_NIGHT, {
      arrival: at(10),
      durationMinutes: MAX_ESTIMATE_MINUTES + 10_000,
    });

    expect(estimate.clamped).toBe(true);
    const billed = estimate.blocks.reduce((sum, block) => sum + block.minutes, 0);
    expect(billed + estimate.uncoveredMinutes).toBe(MAX_ESTIMATE_MINUTES);
  });

  it('ignores segments with a non-positive unit or an empty window', () => {
    const broken: FeeSchedule = {
      currency: 'JPY',
      segments: [
        {
          id: 'bad-unit',
          label: '不正',
          window: { startMinute: 0, endMinute: 1440 },
          unitMinutes: 0,
          unitYen: 500,
        },
        {
          id: 'empty-window',
          label: '空',
          window: { startMinute: 600, endMinute: 600 },
          unitMinutes: 30,
          unitYen: 500,
        },
      ],
      caps: [],
    };

    const estimate = estimateFee(broken, { arrival: at(10), durationMinutes: 60 });
    expect(estimate.blocks).toEqual([]);
    expect(estimate.uncoveredMinutes).toBe(60);
  });
});

describe('estimateFee caps', () => {
  const withCap = (capYen: number, repeat: 'daily' | 'once'): FeeSchedule => ({
    ...DAY_NIGHT,
    caps: [
      {
        id: 'cap',
        label: '最大',
        window: { startMinute: 0, endMinute: 1440 },
        capYen,
        repeat,
      },
    ],
  });

  it.each([['daily' as const], ['once' as const]])('applies a %s cap', (repeat) => {
    const estimate = estimateFee(withCap(1_200, repeat), {
      arrival: at(10),
      durationMinutes: 300,
    });

    expect(estimate.totalYen).toBe(1_200);
    expect(estimate.appliedCaps).toEqual([
      { id: 'cap', label: '最大', capYen: 1_200, rawYen: 3_000, savedYen: 1_800 },
    ]);
    expect(estimate.blocks[0]?.rawYen).toBe(3_000);
  });

  it('splits a cap across blocks so the yen total stays exact', () => {
    const estimate = estimateFee(withCap(500, 'daily'), {
      arrival: at(19),
      durationMinutes: 120,
    });

    expect(estimate.blocks.map((block) => block.yen)).toEqual([429, 71]);
    expect(estimate.totalYen).toBe(500);
  });

  it('leaves a stay cheaper than the cap untouched', () => {
    const estimate = estimateFee(withCap(5_000, 'daily'), {
      arrival: at(10),
      durationMinutes: 60,
    });

    expect(estimate.totalYen).toBe(600);
    expect(estimate.appliedCaps).toEqual([]);
  });

  it('repeats a daily cap on each calendar day', () => {
    const estimate = estimateFee(withCap(1_000, 'daily'), {
      arrival: at(10),
      durationMinutes: 60 * 30,
    });

    expect(estimate.appliedCaps.length).toBeGreaterThan(1);
    expect(estimate.totalYen).toBeLessThanOrEqual(2_000);
  });

  it('anchors a once cap to the entry time instead of the calendar', () => {
    // Entering at 18:00 for 24h spans two calendar days but only one entry-day.
    const stay = { arrival: at(18), durationMinutes: 1_440 };

    const once = estimateFee(withCap(3_000, 'once'), stay);
    const daily = estimateFee(withCap(3_000, 'daily'), stay);

    expect(once.appliedCaps).toHaveLength(1);
    expect(once.totalYen).toBe(3_000);

    // The calendar cap resets at midnight, so the stay is billed twice over.
    expect(daily.totalYen).toBe(5_400);
  });

  it('ignores a cap whose window has no length', () => {
    const schedule: FeeSchedule = {
      ...DAY_NIGHT,
      caps: [
        {
          id: 'broken',
          label: '不正',
          window: { startMinute: 600, endMinute: 600 },
          capYen: 100,
          repeat: 'daily',
        },
      ],
    };

    expect(estimateFee(schedule, { arrival: at(10), durationMinutes: 60 }).totalYen).toBe(600);
  });

  it('ignores a cap window that overlaps the stay but owns no block', () => {
    const schedule: FeeSchedule = {
      ...DAY_NIGHT,
      caps: [
        {
          id: 'late-morning',
          label: '11時以降最大',
          window: { startMinute: 660, endMinute: 1200 },
          capYen: 100,
          repeat: 'daily',
        },
      ],
    };

    // The single block starts at 10:00, before the cap window opens at 11:00.
    const estimate = estimateFee(schedule, { arrival: at(10), durationMinutes: 120 });

    expect(estimate.appliedCaps).toEqual([]);
    expect(estimate.totalYen).toBe(1_200);
  });

  it('ignores a cap window that no block starts in', () => {
    const schedule: FeeSchedule = {
      ...DAY_NIGHT,
      caps: [
        {
          id: 'early-morning',
          label: '早朝最大',
          window: { startMinute: 0, endMinute: 300 },
          capYen: 100,
          repeat: 'daily',
        },
      ],
    };

    expect(estimateFee(schedule, { arrival: at(10), durationMinutes: 60 }).appliedCaps).toEqual(
      [],
    );
  });
});

describe('cheapestUnitRate', () => {
  it('picks the lowest yen-per-minute segment', () => {
    expect(cheapestUnitRate(DAY_NIGHT)?.id).toBe('night');
  });

  it('returns null when nothing is priced', () => {
    expect(cheapestUnitRate({ currency: 'JPY', segments: [], caps: [] })).toBeNull();
  });

  it('keeps the first segment when later ones are dearer', () => {
    const schedule: FeeSchedule = {
      currency: 'JPY',
      segments: [DAY_NIGHT.segments[1]!, DAY_NIGHT.segments[0]!],
      caps: [],
    };

    expect(cheapestUnitRate(schedule)?.id).toBe('night');
  });

  it('skips segments with a non-positive unit', () => {
    const schedule: FeeSchedule = {
      currency: 'JPY',
      segments: [
        { ...DAY_NIGHT.segments[0]!, id: 'broken', unitMinutes: 0 },
        DAY_NIGHT.segments[1]!,
      ],
      caps: [],
    };

    expect(cheapestUnitRate(schedule)?.id).toBe('night');
  });
});

describe('formatYen', () => {
  it.each([
    [0, '0円'],
    [1_200, '1,200円'],
    [428.6, '429円'],
  ])('formats %s', (input, expected) => {
    expect(formatYen(input)).toBe(expected);
  });
});
