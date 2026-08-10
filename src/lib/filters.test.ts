import { describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS, filtersToSearchParams, presetFilters, toggleStructure } from './filters';

const CENTER = { lat: 35.658, lng: 139.7016 };

describe('presetFilters', () => {
  it('copies the catalogue dimensions', () => {
    expect(presetFilters('kei')).toEqual({
      presetId: 'kei',
      vehicle: {
        lengthMm: 3400,
        widthMm: 1480,
        heightMm: 1650,
        weightKg: 900,
        tireWidthMm: 165,
      },
    });
  });

  it('clears the vehicle for an unknown preset', () => {
    expect(presetFilters('bulldozer')).toEqual({ vehicle: null, presetId: null });
  });
});

describe('filtersToSearchParams', () => {
  it('serialises the default filters', () => {
    const params = filtersToSearchParams(CENTER, DEFAULT_FILTERS);

    expect(Object.fromEntries(params)).toEqual({
      lat: '35.658',
      lng: '139.7016',
      radius: '800',
      duration: '60',
      length: '4000',
      width: '1695',
      height: '1525',
      weight: '1100',
      tireWidth: '185',
    });
  });

  it('omits vehicle dimensions when no vehicle is selected', () => {
    const params = filtersToSearchParams(CENTER, {
      ...DEFAULT_FILTERS,
      vehicle: null,
      presetId: null,
    });

    expect(params.has('length')).toBe(false);
    expect(params.has('tireWidth')).toBe(false);
  });

  it('omits the tyre width when it is unknown', () => {
    const params = filtersToSearchParams(CENTER, {
      ...DEFAULT_FILTERS,
      vehicle: {
        lengthMm: 4000,
        widthMm: 1700,
        heightMm: 1500,
        weightKg: 1200,
        tireWidthMm: null,
      },
    });

    expect(params.has('tireWidth')).toBe(false);
    expect(params.get('length')).toBe('4000');
  });

  it('adds the optional filters only when they are on', () => {
    const params = filtersToSearchParams(CENTER, {
      ...DEFAULT_FILTERS,
      structures: ['flat', 'underground'],
      requireEvCharging: true,
      hideFull: true,
    });

    expect(params.get('structures')).toBe('flat,underground');
    expect(params.get('ev')).toBe('1');
    expect(params.get('hideFull')).toBe('1');
  });
});

describe('toggleStructure', () => {
  it('adds a structure that is not selected', () => {
    expect(toggleStructure(['flat'], 'mechanical')).toEqual(['flat', 'mechanical']);
  });

  it('removes a structure that is selected', () => {
    expect(toggleStructure(['flat', 'mechanical'], 'flat')).toEqual(['mechanical']);
  });
});
