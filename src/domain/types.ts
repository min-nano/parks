/**
 * Core domain types shared by the API, the UI and the ingest pipeline.
 *
 * Everything here is plain data so it can cross the server/client boundary and
 * be serialised into JSON without adapters.
 */

export type LatLng = { lat: number; lng: number };

/** Physical construction of the parking lot. Drives which vehicles can enter. */
export const PARKING_STRUCTURES = [
  'flat',
  'mechanical',
  'multistory',
  'underground',
  'roadside',
] as const;
export type ParkingStructure = (typeof PARKING_STRUCTURES)[number];

/**
 * Upper bounds a lot accepts. `null` means "not published by the source", which
 * is deliberately distinct from "no limit" — we surface it as unknown instead of
 * silently telling a driver their van fits.
 */
export type VehicleLimits = {
  maxLengthMm: number | null;
  maxWidthMm: number | null;
  maxHeightMm: number | null;
  maxWeightKg: number | null;
  maxTireWidthMm: number | null;
};

export type ParkingFeatures = {
  evCharging: boolean;
  hasRoof: boolean;
  cashless: boolean;
  open24h: boolean;
  accessible: boolean;
};

/**
 * Minutes from midnight. `endMinute` may exceed 1440 to express a window that
 * crosses midnight (e.g. 20:00-08:00 is `{ startMinute: 1200, endMinute: 1920 }`).
 */
export type TimeWindow = { startMinute: number; endMinute: number };

/** A "N yen per M minutes" tariff that applies inside a time window. */
export type RateSegment = {
  id: string;
  label: string;
  window: TimeWindow;
  unitMinutes: number;
  unitYen: number;
};

/**
 * A 打ち切り (cap) rule.
 *
 * - `daily`: the window repeats every calendar day (e.g. "24時間最大 1200円").
 * - `once`: the window is anchored to the entry time (e.g. "入庫後12時間最大").
 */
export type MaxFeeRule = {
  id: string;
  label: string;
  window: TimeWindow;
  capYen: number;
  repeat: 'daily' | 'once';
};

export type FeeSchedule = {
  currency: 'JPY';
  segments: RateSegment[];
  caps: MaxFeeRule[];
};

export const AVAILABILITY_STATUSES = ['available', 'crowded', 'full', 'unknown'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export type Parking = {
  id: string;
  source: string;
  sourceId: string;
  name: string;
  address: string;
  location: LatLng;
  structure: ParkingStructure;
  capacity: number | null;
  limits: VehicleLimits;
  features: ParkingFeatures;
  feeSchedule: FeeSchedule;
  officialUrl: string | null;
  updatedAt: string;
};

/** An availability observation scraped from an operator's own site/feed. */
export type AvailabilitySnapshot = {
  parkingId: string;
  status: AvailabilityStatus;
  vacantCount: number | null;
  observedAt: string;
  source: string;
};

/** An availability observation submitted by a signed-in user. */
export type UserReport = {
  id: string;
  parkingId: string;
  userId: string;
  status: AvailabilityStatus;
  vacantCount: number | null;
  note: string | null;
  createdAt: string;
};

export type VehicleSpec = {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  tireWidthMm: number | null;
};

export type VehicleProfile = VehicleSpec & {
  userId: string;
  name: string;
  updatedAt: string;
};
