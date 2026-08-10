import type { FeeSchedule, Parking } from '@/domain/types';

export const TOKYO = { lat: 35.658, lng: 139.7016 };

export const SIMPLE_SCHEDULE: FeeSchedule = {
  currency: 'JPY',
  segments: [
    {
      id: 'all',
      label: '終日 200円/30分',
      window: { startMinute: 0, endMinute: 1440 },
      unitMinutes: 30,
      unitYen: 200,
    },
  ],
  caps: [],
};

let counter = 0;

/** A fully populated parking with generous limits; override what a test cares about. */
export function makeParking(overrides: Partial<Parking> = {}): Parking {
  counter += 1;
  const sourceId = overrides.sourceId ?? `p${counter}`;

  return {
    id: `test-${sourceId}`,
    source: 'test',
    sourceId,
    name: `テスト駐車場 ${sourceId}`,
    address: '東京都渋谷区',
    location: TOKYO,
    structure: 'flat',
    capacity: 10,
    limits: {
      maxLengthMm: 5000,
      maxWidthMm: 1900,
      maxHeightMm: 2100,
      maxWeightKg: 2500,
      maxTireWidthMm: null,
    },
    features: {
      evCharging: false,
      hasRoof: false,
      cashless: true,
      open24h: true,
      accessible: false,
    },
    feeSchedule: SIMPLE_SCHEDULE,
    officialUrl: null,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Moves a point roughly `meters` north — enough to control search radii in tests. */
export function offsetNorth(meters: number): { lat: number; lng: number } {
  return { lat: TOKYO.lat + meters / 111_320, lng: TOKYO.lng };
}
