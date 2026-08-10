import type { ParkingSearchItem } from '@/db/repository';
import type { Parking } from '@/domain/types';

import { makeParking } from './fixtures';

/** A ready-to-render search result; override the parts a test asserts on. */
export function makeSearchItem(
  overrides: Omit<Partial<ParkingSearchItem>, 'parking'> & { parking?: Partial<Parking> } = {},
): ParkingSearchItem {
  const { parking: parkingOverrides, ...rest } = overrides;

  return {
    parking: makeParking(parkingOverrides),
    distanceMeters: 240,
    availability: {
      status: 'available',
      confidence: 0.8,
      source: 'official',
      observedAt: '2026-08-10T11:55:00.000Z',
      reportCount: 0,
    },
    fit: { fits: true, violations: [], unknownDimensions: [] },
    fee: {
      totalYen: 400,
      blocks: [
        {
          segmentId: 'all',
          label: '終日 200円/30分',
          startMinute: 0,
          endMinute: 60,
          minutes: 60,
          units: 2,
          rawYen: 400,
          yen: 400,
        },
      ],
      appliedCaps: [],
      uncoveredMinutes: 0,
      clamped: false,
    },
    ...rest,
  };
}

export const RENDER_NOW = new Date('2026-08-10T12:00:00.000Z');
