import { describe, expect, it } from 'vitest';

import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONES,
  DIMENSION_LABELS,
  formatConfidence,
  formatDistance,
  formatDuration,
  formatFitSummary,
  formatObservedAt,
} from './format';

const NOW = new Date('2026-08-10T12:00:00.000Z');
const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

describe('formatDistance', () => {
  it.each([
    [0, '0m'],
    [349.6, '350m'],
    [999, '999m'],
    [1000, '1.0km'],
    [2540, '2.5km'],
  ])('formats %sm', (input, expected) => {
    expect(formatDistance(input)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([
    [30, '30分'],
    [60, '1時間'],
    [90, '1時間30分'],
    [1440, '24時間'],
  ])('formats %s minutes', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('formatConfidence', () => {
  it('renders a percentage', () => {
    expect(formatConfidence(0.714)).toBe('確度 71%');
  });
});

describe('formatFitSummary', () => {
  it('says the car fits when nothing blocks it', () => {
    expect(formatFitSummary({ fits: true, violations: [], unknownDimensions: [] })).toBe(
      '駐車可能',
    );
  });

  it('lists every blocking dimension', () => {
    const summary = formatFitSummary({
      fits: false,
      violations: [
        { dimension: 'height', limit: 1550, actual: 2285, unit: 'mm' },
        { dimension: 'weight', limit: 2000, actual: 2500, unit: 'kg' },
      ],
      unknownDimensions: [],
    });

    expect(summary).toBe('駐車不可: 全高 2285mm > 1550mm / 重量 2500kg > 2000kg');
  });

  it('asks the driver to fill in what it could not check', () => {
    expect(
      formatFitSummary({ fits: true, violations: [], unknownDimensions: ['tireWidth'] }),
    ).toBe('要確認: タイヤ幅が未入力');
  });

  it('prefers reporting a hard violation over a missing value', () => {
    const summary = formatFitSummary({
      fits: false,
      violations: [{ dimension: 'length', limit: 5000, actual: 5380, unit: 'mm' }],
      unknownDimensions: ['tireWidth'],
    });

    expect(summary).toMatch(/^駐車不可/);
  });
});

describe('formatObservedAt', () => {
  it.each([
    [null, '情報なし'],
    ['not-a-date', '情報なし'],
  ])('renders %s as 情報なし', (input, expected) => {
    expect(formatObservedAt(input, NOW)).toBe(expected);
  });

  it.each([
    [0, 'たった今'],
    [1, '1分前'],
    [59, '59分前'],
    [60, '1時間前'],
    [1439, '23時間前'],
    [1440, '1日前'],
    [4320, '3日前'],
  ])('renders %s minutes ago', (minutes, expected) => {
    expect(formatObservedAt(minutesAgo(minutes), NOW)).toBe(expected);
  });
});

describe('label maps', () => {
  it('covers every availability status and fit dimension', () => {
    expect(Object.keys(AVAILABILITY_LABELS)).toEqual(Object.keys(AVAILABILITY_TONES));
    expect(Object.keys(DIMENSION_LABELS)).toEqual([
      'length',
      'width',
      'height',
      'weight',
      'tireWidth',
    ]);
  });
});
