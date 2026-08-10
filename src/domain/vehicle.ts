import type { VehicleLimits, VehicleSpec } from './types';

export type FitDimension = 'length' | 'width' | 'height' | 'weight' | 'tireWidth';

export type FitViolation = {
  dimension: FitDimension;
  limit: number;
  actual: number;
  unit: 'mm' | 'kg';
};

export type FitResult = {
  /** True only when every published limit is satisfied. */
  fits: boolean;
  violations: FitViolation[];
  /** Limits the operator publishes but we cannot evaluate (missing vehicle data). */
  unknownDimensions: FitDimension[];
};

type Check = {
  dimension: FitDimension;
  limit: number | null;
  actual: number | null;
  unit: 'mm' | 'kg';
};

export function checkVehicleFit(limits: VehicleLimits, vehicle: VehicleSpec): FitResult {
  const checks: Check[] = [
    { dimension: 'length', limit: limits.maxLengthMm, actual: vehicle.lengthMm, unit: 'mm' },
    { dimension: 'width', limit: limits.maxWidthMm, actual: vehicle.widthMm, unit: 'mm' },
    { dimension: 'height', limit: limits.maxHeightMm, actual: vehicle.heightMm, unit: 'mm' },
    { dimension: 'weight', limit: limits.maxWeightKg, actual: vehicle.weightKg, unit: 'kg' },
    {
      dimension: 'tireWidth',
      limit: limits.maxTireWidthMm,
      actual: vehicle.tireWidthMm,
      unit: 'mm',
    },
  ];

  const violations: FitViolation[] = [];
  const unknownDimensions: FitDimension[] = [];

  for (const check of checks) {
    if (check.limit === null) continue;
    if (check.actual === null) {
      unknownDimensions.push(check.dimension);
      continue;
    }
    if (check.actual > check.limit) {
      violations.push({
        dimension: check.dimension,
        limit: check.limit,
        actual: check.actual,
        unit: check.unit,
      });
    }
  }

  return { fits: violations.length === 0, violations, unknownDimensions };
}

export type VehiclePreset = VehicleSpec & {
  id: string;
  label: string;
};

/**
 * Rough catalogue values used to pre-fill the filter. Drivers can override every
 * number, so these only need to be representative.
 */
export const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'kei',
    label: '軽自動車',
    lengthMm: 3400,
    widthMm: 1480,
    heightMm: 1650,
    weightKg: 900,
    tireWidthMm: 165,
  },
  {
    id: 'compact',
    label: 'コンパクトカー',
    lengthMm: 4000,
    widthMm: 1695,
    heightMm: 1525,
    weightKg: 1100,
    tireWidthMm: 185,
  },
  {
    id: 'sedan',
    label: 'セダン',
    lengthMm: 4700,
    widthMm: 1750,
    heightMm: 1450,
    weightKg: 1500,
    tireWidthMm: 205,
  },
  {
    id: 'suv',
    label: 'SUV',
    lengthMm: 4700,
    widthMm: 1850,
    heightMm: 1700,
    weightKg: 1800,
    tireWidthMm: 235,
  },
  {
    id: 'minivan',
    label: 'ミニバン',
    lengthMm: 4900,
    widthMm: 1750,
    heightMm: 1870,
    weightKg: 1900,
    tireWidthMm: 205,
  },
  {
    id: 'van',
    label: '大型バン・ハイエース',
    lengthMm: 5380,
    widthMm: 1880,
    heightMm: 2285,
    weightKg: 2500,
    tireWidthMm: 215,
  },
];

export const DEFAULT_VEHICLE_PRESET_ID = 'compact';

export function findVehiclePreset(id: string): VehiclePreset | undefined {
  return VEHICLE_PRESETS.find((preset) => preset.id === id);
}
