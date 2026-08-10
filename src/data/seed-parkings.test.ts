import { describe, expect, it } from 'vitest';

import { makeParkingId } from '@/db/repository';
import { estimateFee } from '@/domain/pricing';
import { PARKING_STRUCTURES } from '@/domain/types';

import { SEED_PARKINGS, SEED_SNAPSHOTS } from './seed-parkings';

describe('seed parkings', () => {
  it('uses ids derived from the source', () => {
    for (const parking of SEED_PARKINGS) {
      expect(parking.id).toBe(makeParkingId(parking.source, parking.sourceId));
    }
  });

  it('has unique ids', () => {
    const ids = SEED_PARKINGS.map((parking) => parking.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sits in Tokyo with a valid structure', () => {
    for (const parking of SEED_PARKINGS) {
      expect(PARKING_STRUCTURES).toContain(parking.structure);
      expect(parking.location.lat).toBeGreaterThan(35);
      expect(parking.location.lat).toBeLessThan(36);
      expect(parking.location.lng).toBeGreaterThan(139);
      expect(parking.location.lng).toBeLessThan(140);
    }
  });

  it('prices a one hour daytime stay for every lot', () => {
    for (const parking of SEED_PARKINGS) {
      const estimate = estimateFee(parking.feeSchedule, {
        arrival: new Date(2026, 7, 10, 12),
        durationMinutes: 60,
      });

      expect(estimate.totalYen).toBeGreaterThan(0);
      expect(estimate.uncoveredMinutes).toBe(0);
    }
  });

  it('covers a whole day except where the operator only opens in daylight', () => {
    const overnight = SEED_PARKINGS.filter((parking) =>
      parking.feeSchedule.segments.some((segment) => segment.id === 'night'),
    );

    expect(overnight.length).toBeGreaterThan(0);
    for (const parking of overnight) {
      const estimate = estimateFee(parking.feeSchedule, {
        arrival: new Date(2026, 7, 10, 12),
        durationMinutes: 1_440,
      });
      expect(estimate.uncoveredMinutes).toBe(0);
    }
  });

  it('caps a full day below the sum of its parts', () => {
    const capped = SEED_PARKINGS.filter((parking) => parking.feeSchedule.caps.length > 0);
    expect(capped.length).toBeGreaterThan(0);

    for (const parking of capped) {
      const estimate = estimateFee(parking.feeSchedule, {
        arrival: new Date(2026, 7, 10, 9),
        durationMinutes: 1_440,
      });
      expect(estimate.appliedCaps.length).toBeGreaterThan(0);
      expect(estimate.totalYen).toBeLessThan(
        estimate.blocks.reduce((sum, block) => sum + block.rawYen, 0),
      );
    }
  });

  it('only snapshots parkings that exist', () => {
    const ids = new Set(SEED_PARKINGS.map((parking) => parking.id));
    for (const snapshot of SEED_SNAPSHOTS) {
      expect(ids.has(snapshot.parkingId)).toBe(true);
    }
  });
});
