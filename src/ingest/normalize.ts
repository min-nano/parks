import { z } from 'zod';

import type {
  AvailabilitySnapshot,
  AvailabilityStatus,
  FeeSchedule,
  Parking,
  ParkingFeatures,
  ParkingStructure,
  VehicleLimits,
} from '@/domain/types';
import { makeParkingId } from '@/db/repository';

/**
 * The shape adapters must produce. Deliberately loose — operator feeds publish
 * heights as "2.1m", structures as 「機械式」 and availability as 「満車」, and the
 * normalisers below are what turn that into the domain model.
 */
export const rawRecordSchema = z.object({
  sourceId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  structure: z.string().nullish(),
  capacity: z.number().int().nonnegative().nullish(),
  maxLength: z.union([z.string(), z.number()]).nullish(),
  maxWidth: z.union([z.string(), z.number()]).nullish(),
  maxHeight: z.union([z.string(), z.number()]).nullish(),
  maxWeight: z.union([z.string(), z.number()]).nullish(),
  maxTireWidth: z.union([z.string(), z.number()]).nullish(),
  evCharging: z.boolean().nullish(),
  hasRoof: z.boolean().nullish(),
  cashless: z.boolean().nullish(),
  open24h: z.boolean().nullish(),
  accessible: z.boolean().nullish(),
  dayRateYen: z.number().nonnegative().nullish(),
  dayRateMinutes: z.number().positive().nullish(),
  nightRateYen: z.number().nonnegative().nullish(),
  nightRateMinutes: z.number().positive().nullish(),
  dailyMaxYen: z.number().nonnegative().nullish(),
  availability: z.string().nullish(),
  vacantCount: z.number().int().nonnegative().nullish(),
  officialUrl: z.string().nullish(),
});

export type RawParkingRecord = z.infer<typeof rawRecordSchema>;

const STRUCTURE_ALIASES: Record<string, ParkingStructure> = {
  flat: 'flat',
  平面: 'flat',
  自走式平面: 'flat',
  mechanical: 'mechanical',
  機械式: 'mechanical',
  タワー式: 'mechanical',
  multistory: 'multistory',
  立体: 'multistory',
  自走式立体: 'multistory',
  underground: 'underground',
  地下: 'underground',
  地下駐車場: 'underground',
  roadside: 'roadside',
  路上: 'roadside',
  パーキングメーター: 'roadside',
};

export function normalizeStructure(raw: string | null | undefined): ParkingStructure {
  if (!raw) return 'flat';
  return STRUCTURE_ALIASES[raw.trim()] ?? 'flat';
}

const AVAILABILITY_ALIASES: Record<string, AvailabilityStatus> = {
  available: 'available',
  空車: 'available',
  空: 'available',
  crowded: 'crowded',
  混雑: 'crowded',
  混: 'crowded',
  満車: 'full',
  満: 'full',
  full: 'full',
};

export function normalizeAvailability(raw: string | null | undefined): AvailabilityStatus {
  if (!raw) return 'unknown';
  return AVAILABILITY_ALIASES[raw.trim()] ?? 'unknown';
}

const DIMENSION_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|m)?$/i;

/**
 * Converts a published dimension into millimetres.
 *
 * Bare numbers are ambiguous, so we apply the convention operators actually use:
 * a value below 100 is metres ("2.1"), otherwise millimetres ("2100").
 */
export function parseDimensionMm(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw < 100 ? raw * 1000 : raw);
  }

  const match = DIMENSION_PATTERN.exec(raw.trim());
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  switch (match[2]?.toLowerCase()) {
    case 'mm':
      return Math.round(value);
    case 'cm':
      return Math.round(value * 10);
    case 'm':
      return Math.round(value * 1000);
    default:
      return Math.round(value < 100 ? value * 1000 : value);
  }
}

const WEIGHT_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(kg|t)?$/i;

export function parseWeightKg(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw);
  }

  const match = WEIGHT_PATTERN.exec(raw.trim());
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(match[2]?.toLowerCase() === 't' ? value * 1000 : value);
}

export function normalizeLimits(raw: RawParkingRecord): VehicleLimits {
  return {
    maxLengthMm: parseDimensionMm(raw.maxLength),
    maxWidthMm: parseDimensionMm(raw.maxWidth),
    maxHeightMm: parseDimensionMm(raw.maxHeight),
    maxWeightKg: parseWeightKg(raw.maxWeight),
    maxTireWidthMm: parseDimensionMm(raw.maxTireWidth),
  };
}

export function normalizeFeatures(raw: RawParkingRecord): ParkingFeatures {
  return {
    evCharging: raw.evCharging ?? false,
    hasRoof: raw.hasRoof ?? false,
    cashless: raw.cashless ?? false,
    open24h: raw.open24h ?? false,
    accessible: raw.accessible ?? false,
  };
}

/**
 * Builds the day/night/cap tariff from the flat fields most operator feeds
 * expose. Feeds without any rate produce an empty schedule, which the UI renders
 * as "料金情報なし" instead of a misleading ¥0.
 */
export function normalizeFeeSchedule(raw: RawParkingRecord): FeeSchedule {
  const segments: FeeSchedule['segments'] = [];

  if (raw.dayRateYen !== null && raw.dayRateYen !== undefined) {
    const minutes = raw.dayRateMinutes ?? 60;
    segments.push({
      id: 'day',
      label: `8:00-20:00 ${raw.dayRateYen}円/${minutes}分`,
      window: { startMinute: 8 * 60, endMinute: 20 * 60 },
      unitMinutes: minutes,
      unitYen: raw.dayRateYen,
    });
  }

  if (raw.nightRateYen !== null && raw.nightRateYen !== undefined) {
    const minutes = raw.nightRateMinutes ?? 60;
    segments.push({
      id: 'night',
      label: `20:00-8:00 ${raw.nightRateYen}円/${minutes}分`,
      window: { startMinute: 20 * 60, endMinute: 32 * 60 },
      unitMinutes: minutes,
      unitYen: raw.nightRateYen,
    });
  }

  const caps: FeeSchedule['caps'] = [];
  if (raw.dailyMaxYen !== null && raw.dailyMaxYen !== undefined) {
    caps.push({
      id: 'daily-cap',
      label: `24時間最大 ${raw.dailyMaxYen}円`,
      window: { startMinute: 0, endMinute: 24 * 60 },
      capYen: raw.dailyMaxYen,
      repeat: 'once',
    });
  }

  return { currency: 'JPY', segments, caps };
}

export type NormalizedRecord = {
  parking: Parking;
  snapshot: AvailabilitySnapshot | null;
};

export function normalizeRecord(
  source: string,
  raw: RawParkingRecord,
  observedAt: Date,
): NormalizedRecord {
  const id = makeParkingId(source, raw.sourceId);

  const parking: Parking = {
    id,
    source,
    sourceId: raw.sourceId,
    name: raw.name,
    address: raw.address,
    location: { lat: raw.lat, lng: raw.lng },
    structure: normalizeStructure(raw.structure),
    capacity: raw.capacity ?? null,
    limits: normalizeLimits(raw),
    features: normalizeFeatures(raw),
    feeSchedule: normalizeFeeSchedule(raw),
    officialUrl: raw.officialUrl ?? null,
    updatedAt: observedAt.toISOString(),
  };

  const status = normalizeAvailability(raw.availability);
  const vacantCount = raw.vacantCount ?? null;
  const snapshot: AvailabilitySnapshot | null =
    status === 'unknown' && vacantCount === null
      ? null
      : {
          parkingId: id,
          status,
          vacantCount,
          observedAt: observedAt.toISOString(),
          source,
        };

  return { parking, snapshot };
}
