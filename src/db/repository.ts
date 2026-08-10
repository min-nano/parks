import { and, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';

import { resolveAvailability, type ResolvedAvailability } from '@/domain/availability';
import { boundingBox, distanceMeters } from '@/domain/geo';
import { estimateFee, type FeeEstimate } from '@/domain/pricing';
import type {
  AvailabilitySnapshot,
  AvailabilityStatus,
  LatLng,
  Parking,
  ParkingStructure,
  UserReport,
  VehicleProfile,
  VehicleSpec,
} from '@/domain/types';
import { checkVehicleFit, type FitResult } from '@/domain/vehicle';

import type { Database } from './client';
import { availabilitySnapshots, parkings, userReports, vehicleProfiles } from './schema';

/** How far back community reports still count towards live availability. */
export const REPORT_WINDOW_MINUTES = 180;

export const makeParkingId = (source: string, sourceId: string): string => `${source}-${sourceId}`;

type ParkingRow = typeof parkings.$inferSelect;
type SnapshotRow = typeof availabilitySnapshots.$inferSelect;
type ReportRow = typeof userReports.$inferSelect;
type VehicleProfileRow = typeof vehicleProfiles.$inferSelect;

export function toParking(row: ParkingRow): Parking {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.sourceId,
    name: row.name,
    address: row.address,
    location: { lat: row.lat, lng: row.lng },
    structure: row.structure,
    capacity: row.capacity,
    limits: {
      maxLengthMm: row.maxLengthMm,
      maxWidthMm: row.maxWidthMm,
      maxHeightMm: row.maxHeightMm,
      maxWeightKg: row.maxWeightKg,
      maxTireWidthMm: row.maxTireWidthMm,
    },
    features: row.features,
    feeSchedule: row.feeSchedule,
    officialUrl: row.officialUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSnapshot(row: SnapshotRow): AvailabilitySnapshot {
  return {
    parkingId: row.parkingId,
    status: row.status,
    vacantCount: row.vacantCount,
    observedAt: row.observedAt.toISOString(),
    source: row.source,
  };
}

export function toReport(row: ReportRow): UserReport {
  return {
    id: row.id,
    parkingId: row.parkingId,
    userId: row.userId,
    status: row.status,
    vacantCount: row.vacantCount,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toVehicleProfile(row: VehicleProfileRow): VehicleProfile {
  return {
    userId: row.userId,
    name: row.name,
    lengthMm: row.lengthMm,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    weightKg: row.weightKg,
    tireWidthMm: row.tireWidthMm,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SearchParkingsInput = {
  center: LatLng;
  radiusMeters: number;
  vehicle: VehicleSpec | null;
  structures: ParkingStructure[];
  requireEvCharging: boolean;
  hideFull: boolean;
  arrival: Date;
  durationMinutes: number;
  limit: number;
  now: Date;
};

export type ParkingSearchItem = {
  parking: Parking;
  distanceMeters: number;
  availability: ResolvedAvailability;
  fit: FitResult;
  fee: FeeEstimate;
};

/**
 * Vehicle dimensions are filtered in SQL so the candidate set stays small, but
 * lots that publish no limit are kept: `checkVehicleFit` reports them as unknown
 * rather than dropping them silently.
 */
function vehicleConditions(vehicle: VehicleSpec): SQL[] {
  const conditions: SQL[] = [
    sql`(${parkings.maxLengthMm} IS NULL OR ${parkings.maxLengthMm} >= ${vehicle.lengthMm})`,
    sql`(${parkings.maxWidthMm} IS NULL OR ${parkings.maxWidthMm} >= ${vehicle.widthMm})`,
    sql`(${parkings.maxHeightMm} IS NULL OR ${parkings.maxHeightMm} >= ${vehicle.heightMm})`,
    sql`(${parkings.maxWeightKg} IS NULL OR ${parkings.maxWeightKg} >= ${vehicle.weightKg})`,
  ];
  if (vehicle.tireWidthMm !== null) {
    conditions.push(
      sql`(${parkings.maxTireWidthMm} IS NULL OR ${parkings.maxTireWidthMm} >= ${vehicle.tireWidthMm})`,
    );
  }
  return conditions;
}

export async function searchParkings(
  db: Database,
  input: SearchParkingsInput,
): Promise<ParkingSearchItem[]> {
  const box = boundingBox(input.center, input.radiusMeters);

  const conditions: SQL[] = [
    gte(parkings.lat, box.minLat),
    sql`${parkings.lat} <= ${box.maxLat}`,
  ];

  // A box that wraps the antimeridian cannot be expressed as a single BETWEEN;
  // the exact distance filter below still trims the extra candidates.
  if (box.minLng <= box.maxLng) {
    conditions.push(gte(parkings.lng, box.minLng), sql`${parkings.lng} <= ${box.maxLng}`);
  }

  if (input.vehicle) conditions.push(...vehicleConditions(input.vehicle));
  if (input.structures.length > 0) {
    conditions.push(inArray(parkings.structure, input.structures));
  }
  if (input.requireEvCharging) {
    conditions.push(sql`${parkings.features} ->> 'evCharging' = 'true'`);
  }

  const rows = await db
    .select()
    .from(parkings)
    .where(and(...conditions));

  const candidates = rows
    .map(toParking)
    .map((parking) => ({
      parking,
      distanceMeters: distanceMeters(input.center, parking.location),
    }))
    .filter((entry) => entry.distanceMeters <= input.radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (candidates.length === 0) return [];

  const ids = candidates.map((entry) => entry.parking.id);
  const [officialByParking, reportsByParking] = await Promise.all([
    latestSnapshots(db, ids),
    recentReports(db, ids, input.now),
  ]);

  const items = candidates.map((entry) => {
    const availability = resolveAvailability({
      official: officialByParking.get(entry.parking.id) ?? null,
      reports: reportsByParking.get(entry.parking.id) ?? [],
      now: input.now,
    });

    return {
      parking: entry.parking,
      distanceMeters: Math.round(entry.distanceMeters),
      availability,
      fit: input.vehicle
        ? checkVehicleFit(entry.parking.limits, input.vehicle)
        : { fits: true, violations: [], unknownDimensions: [] },
      fee: estimateFee(entry.parking.feeSchedule, {
        arrival: input.arrival,
        durationMinutes: input.durationMinutes,
      }),
    } satisfies ParkingSearchItem;
  });

  return items
    .filter((item) => !input.hideFull || item.availability.status !== 'full')
    .slice(0, input.limit);
}

export async function latestSnapshots(
  db: Database,
  parkingIds: string[],
): Promise<Map<string, AvailabilitySnapshot>> {
  const result = new Map<string, AvailabilitySnapshot>();
  if (parkingIds.length === 0) return result;

  const rows = await db
    .select()
    .from(availabilitySnapshots)
    .where(inArray(availabilitySnapshots.parkingId, parkingIds))
    .orderBy(desc(availabilitySnapshots.observedAt));

  for (const row of rows) {
    if (!result.has(row.parkingId)) result.set(row.parkingId, toSnapshot(row));
  }
  return result;
}

export async function recentReports(
  db: Database,
  parkingIds: string[],
  now: Date,
): Promise<Map<string, UserReport[]>> {
  const result = new Map<string, UserReport[]>();
  if (parkingIds.length === 0) return result;

  const since = new Date(now.getTime() - REPORT_WINDOW_MINUTES * 60_000);
  const rows = await db
    .select()
    .from(userReports)
    .where(and(inArray(userReports.parkingId, parkingIds), gte(userReports.createdAt, since)))
    .orderBy(desc(userReports.createdAt));

  for (const row of rows) {
    const list = result.get(row.parkingId) ?? [];
    list.push(toReport(row));
    result.set(row.parkingId, list);
  }
  return result;
}

export async function getParkingById(db: Database, id: string): Promise<Parking | null> {
  const rows = await db.select().from(parkings).where(eq(parkings.id, id)).limit(1);
  const row = rows[0];
  return row ? toParking(row) : null;
}

export async function listReports(
  db: Database,
  parkingId: string,
  limit = 20,
): Promise<UserReport[]> {
  const rows = await db
    .select()
    .from(userReports)
    .where(eq(userReports.parkingId, parkingId))
    .orderBy(desc(userReports.createdAt))
    .limit(limit);
  return rows.map(toReport);
}

export type CreateReportInput = {
  id?: string;
  parkingId: string;
  userId: string;
  status: AvailabilityStatus;
  vacantCount: number | null;
  note: string | null;
  createdAt?: Date;
};

export async function createReport(db: Database, input: CreateReportInput): Promise<UserReport> {
  const rows = await db
    .insert(userReports)
    .values({
      id: input.id ?? crypto.randomUUID(),
      parkingId: input.parkingId,
      userId: input.userId,
      status: input.status,
      vacantCount: input.vacantCount,
      note: input.note,
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();

  const row = rows[0];
  /* c8 ignore next -- `INSERT ... RETURNING` always yields the inserted row. */
  if (!row) throw new Error('failed to insert user report');
  return toReport(row);
}

export async function upsertParkings(db: Database, records: Parking[]): Promise<number> {
  if (records.length === 0) return 0;

  const values = records.map((parking) => ({
    id: parking.id,
    source: parking.source,
    sourceId: parking.sourceId,
    name: parking.name,
    address: parking.address,
    lat: parking.location.lat,
    lng: parking.location.lng,
    structure: parking.structure,
    capacity: parking.capacity,
    maxLengthMm: parking.limits.maxLengthMm,
    maxWidthMm: parking.limits.maxWidthMm,
    maxHeightMm: parking.limits.maxHeightMm,
    maxWeightKg: parking.limits.maxWeightKg,
    maxTireWidthMm: parking.limits.maxTireWidthMm,
    features: parking.features,
    feeSchedule: parking.feeSchedule,
    officialUrl: parking.officialUrl,
    updatedAt: new Date(parking.updatedAt),
  }));

  await db
    .insert(parkings)
    .values(values)
    .onConflictDoUpdate({
      target: parkings.id,
      set: {
        name: sql`excluded.name`,
        address: sql`excluded.address`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        structure: sql`excluded.structure`,
        capacity: sql`excluded.capacity`,
        maxLengthMm: sql`excluded.max_length_mm`,
        maxWidthMm: sql`excluded.max_width_mm`,
        maxHeightMm: sql`excluded.max_height_mm`,
        maxWeightKg: sql`excluded.max_weight_kg`,
        maxTireWidthMm: sql`excluded.max_tire_width_mm`,
        features: sql`excluded.features`,
        feeSchedule: sql`excluded.fee_schedule`,
        officialUrl: sql`excluded.official_url`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  return values.length;
}

export async function recordSnapshots(
  db: Database,
  snapshots: AvailabilitySnapshot[],
): Promise<number> {
  if (snapshots.length === 0) return 0;

  await db.insert(availabilitySnapshots).values(
    snapshots.map((snapshot) => ({
      id: crypto.randomUUID(),
      parkingId: snapshot.parkingId,
      status: snapshot.status,
      vacantCount: snapshot.vacantCount,
      observedAt: new Date(snapshot.observedAt),
      source: snapshot.source,
    })),
  );

  return snapshots.length;
}

export async function getVehicleProfile(
  db: Database,
  userId: string,
): Promise<VehicleProfile | null> {
  const rows = await db
    .select()
    .from(vehicleProfiles)
    .where(eq(vehicleProfiles.userId, userId))
    .limit(1);
  const row = rows[0];
  return row ? toVehicleProfile(row) : null;
}

export async function saveVehicleProfile(
  db: Database,
  input: { userId: string; name: string } & VehicleSpec,
): Promise<VehicleProfile> {
  const values = {
    userId: input.userId,
    name: input.name,
    lengthMm: input.lengthMm,
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    weightKg: input.weightKg,
    tireWidthMm: input.tireWidthMm,
    updatedAt: new Date(),
  };

  const rows = await db
    .insert(vehicleProfiles)
    .values(values)
    .onConflictDoUpdate({ target: vehicleProfiles.userId, set: values })
    .returning();

  const row = rows[0];
  /* c8 ignore next -- `INSERT ... RETURNING` always yields the upserted row. */
  if (!row) throw new Error('failed to save vehicle profile');
  return toVehicleProfile(row);
}
