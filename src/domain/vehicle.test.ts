import { describe, expect, it } from 'vitest';

import type { VehicleLimits, VehicleSpec } from './types';
import {
  DEFAULT_VEHICLE_PRESET_ID,
  VEHICLE_PRESETS,
  checkVehicleFit,
  findVehiclePreset,
} from './vehicle';

const NO_LIMITS: VehicleLimits = {
  maxLengthMm: null,
  maxWidthMm: null,
  maxHeightMm: null,
  maxWeightKg: null,
  maxTireWidthMm: null,
};

const HIACE: VehicleSpec = {
  lengthMm: 5380,
  widthMm: 1880,
  heightMm: 2285,
  weightKg: 2500,
  tireWidthMm: 215,
};

describe('checkVehicleFit', () => {
  it('accepts any vehicle when the lot publishes no limits', () => {
    expect(checkVehicleFit(NO_LIMITS, HIACE)).toEqual({
      fits: true,
      violations: [],
      unknownDimensions: [],
    });
  });

  it('reports every dimension that exceeds its limit', () => {
    const result = checkVehicleFit(
      {
        maxLengthMm: 5000,
        maxWidthMm: 1850,
        maxHeightMm: 1550,
        maxWeightKg: 2000,
        maxTireWidthMm: 205,
      },
      HIACE,
    );

    expect(result.fits).toBe(false);
    expect(result.violations.map((violation) => violation.dimension)).toEqual([
      'length',
      'width',
      'height',
      'weight',
      'tireWidth',
    ]);
    expect(result.violations[0]).toEqual({
      dimension: 'length',
      limit: 5000,
      actual: 5380,
      unit: 'mm',
    });
    expect(result.violations[3]?.unit).toBe('kg');
  });

  it('treats a value exactly on the limit as fitting', () => {
    const result = checkVehicleFit(
      {
        maxLengthMm: 5380,
        maxWidthMm: 1880,
        maxHeightMm: 2285,
        maxWeightKg: 2500,
        maxTireWidthMm: 215,
      },
      HIACE,
    );

    expect(result.fits).toBe(true);
  });

  it('flags a published limit it cannot evaluate rather than assuming it fits', () => {
    const result = checkVehicleFit(
      { ...NO_LIMITS, maxTireWidthMm: 195 },
      { ...HIACE, tireWidthMm: null },
    );

    expect(result).toEqual({ fits: true, violations: [], unknownDimensions: ['tireWidth'] });
  });
});

describe('vehicle presets', () => {
  it('exposes a stable default', () => {
    expect(findVehiclePreset(DEFAULT_VEHICLE_PRESET_ID)).toBeDefined();
  });

  it('returns undefined for an unknown id', () => {
    expect(findVehiclePreset('spaceship')).toBeUndefined();
  });

  it('uses unique ids and plausible dimensions', () => {
    const ids = VEHICLE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const preset of VEHICLE_PRESETS) {
      expect(preset.lengthMm).toBeGreaterThan(preset.widthMm);
      expect(preset.weightKg).toBeGreaterThan(0);
    }
  });
});
