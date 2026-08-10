import type { LatLng, ParkingStructure, VehicleSpec } from '@/domain/types';
import { DEFAULT_VEHICLE_PRESET_ID, findVehiclePreset } from '@/domain/vehicle';

export type FilterState = {
  /** `null` means the driver has not narrowed by vehicle. */
  vehicle: VehicleSpec | null;
  presetId: string | null;
  radiusMeters: number;
  durationMinutes: number;
  structures: ParkingStructure[];
  requireEvCharging: boolean;
  hideFull: boolean;
};

export function presetFilters(presetId: string): Pick<FilterState, 'vehicle' | 'presetId'> {
  const preset = findVehiclePreset(presetId);
  if (!preset) return { vehicle: null, presetId: null };
  return {
    presetId,
    vehicle: {
      lengthMm: preset.lengthMm,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      weightKg: preset.weightKg,
      tireWidthMm: preset.tireWidthMm,
    },
  };
}

export const DEFAULT_FILTERS: FilterState = {
  ...presetFilters(DEFAULT_VEHICLE_PRESET_ID),
  radiusMeters: 800,
  durationMinutes: 60,
  structures: [],
  requireEvCharging: false,
  hideFull: false,
};

/**
 * Serialises the UI state for `GET /api/parkings`.
 *
 * Explicit dimensions are always sent rather than the preset id, so a driver who
 * tweaks one number is not silently snapped back to the catalogue value.
 */
export function filtersToSearchParams(center: LatLng, filters: FilterState): URLSearchParams {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radius: String(filters.radiusMeters),
    duration: String(filters.durationMinutes),
  });

  if (filters.vehicle) {
    params.set('length', String(filters.vehicle.lengthMm));
    params.set('width', String(filters.vehicle.widthMm));
    params.set('height', String(filters.vehicle.heightMm));
    params.set('weight', String(filters.vehicle.weightKg));
    if (filters.vehicle.tireWidthMm !== null) {
      params.set('tireWidth', String(filters.vehicle.tireWidthMm));
    }
  }

  if (filters.structures.length > 0) params.set('structures', filters.structures.join(','));
  if (filters.requireEvCharging) params.set('ev', '1');
  if (filters.hideFull) params.set('hideFull', '1');

  return params;
}

export function toggleStructure(
  structures: ParkingStructure[],
  structure: ParkingStructure,
): ParkingStructure[] {
  return structures.includes(structure)
    ? structures.filter((entry) => entry !== structure)
    : [...structures, structure];
}
