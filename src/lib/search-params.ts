import { z } from 'zod';

import {
  AVAILABILITY_STATUSES,
  PARKING_STRUCTURES,
  type LatLng,
  type ParkingStructure,
  type VehicleSpec,
} from '@/domain/types';
import { findVehiclePreset } from '@/domain/vehicle';

export const DEFAULT_RADIUS_METERS = 800;
export const DEFAULT_DURATION_MINUTES = 60;
export const DEFAULT_RESULT_LIMIT = 50;

const boolean = z
  .enum(['1', '0', 'true', 'false'])
  .transform((value) => value === '1' || value === 'true');

const timestamp = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'invalid timestamp' })
  .transform((value) => new Date(value));

const structureList = z.string().transform((value, ctx) => {
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    if (!(PARKING_STRUCTURES as readonly string[]).includes(entry)) {
      ctx.addIssue({ code: 'custom', message: `unknown structure: ${entry}` });
      return z.NEVER;
    }
  }
  return entries as ParkingStructure[];
});

const millimetres = z.coerce.number().int().positive().max(30_000);

/** Fields shared by the search endpoint and the single-parking detail endpoint. */
const estimateShape = {
  preset: z.string().optional(),
  length: millimetres.optional(),
  width: millimetres.optional(),
  height: millimetres.optional(),
  weight: z.coerce.number().int().positive().max(50_000).optional(),
  tireWidth: millimetres.optional(),
  arrival: timestamp.optional(),
  duration: z.coerce.number().int().min(5).max(60 * 24 * 30).default(DEFAULT_DURATION_MINUTES),
};

export const estimateQuerySchema = z.object(estimateShape);

export const searchQuerySchema = z.object({
  ...estimateShape,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(50).max(5_000).default(DEFAULT_RADIUS_METERS),
  structures: structureList.optional(),
  ev: boolean.default(false),
  hideFull: boolean.default(false),
  limit: z.coerce.number().int().min(1).max(200).default(DEFAULT_RESULT_LIMIT),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

type VehicleQuery = {
  preset?: string | undefined;
  length?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  weight?: number | undefined;
  tireWidth?: number | undefined;
};

export type ParsedSearchQuery = {
  center: LatLng;
  radiusMeters: number;
  vehicle: VehicleSpec | null;
  structures: ParkingStructure[];
  requireEvCharging: boolean;
  hideFull: boolean;
  arrival: Date;
  durationMinutes: number;
  limit: number;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; issues: { path: string; message: string }[] };

function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Resolves the vehicle to filter by.
 *
 * A preset supplies the baseline and any explicit dimension overrides it, so the
 * UI can start from "コンパクトカー" and let the driver correct just the height.
 * Returns `null` when the driver has not narrowed by vehicle at all.
 */
export function resolveVehicle(query: VehicleQuery): ParseResult<VehicleSpec | null> {
  const overrides = {
    lengthMm: query.length,
    widthMm: query.width,
    heightMm: query.height,
    weightKg: query.weight,
    tireWidthMm: query.tireWidth,
  };
  const hasOverride = Object.values(overrides).some((value) => value !== undefined);

  if (query.preset === undefined) {
    if (!hasOverride) return { ok: true, value: null };
    if (
      overrides.lengthMm === undefined ||
      overrides.widthMm === undefined ||
      overrides.heightMm === undefined ||
      overrides.weightKg === undefined
    ) {
      return {
        ok: false,
        message: 'length, width, height and weight are all required without a preset',
        issues: [],
      };
    }
    return {
      ok: true,
      value: {
        lengthMm: overrides.lengthMm,
        widthMm: overrides.widthMm,
        heightMm: overrides.heightMm,
        weightKg: overrides.weightKg,
        tireWidthMm: overrides.tireWidthMm ?? null,
      },
    };
  }

  const preset = findVehiclePreset(query.preset);
  if (!preset) {
    return { ok: false, message: `unknown vehicle preset: ${query.preset}`, issues: [] };
  }

  return {
    ok: true,
    value: {
      lengthMm: overrides.lengthMm ?? preset.lengthMm,
      widthMm: overrides.widthMm ?? preset.widthMm,
      heightMm: overrides.heightMm ?? preset.heightMm,
      weightKg: overrides.weightKg ?? preset.weightKg,
      tireWidthMm: overrides.tireWidthMm ?? preset.tireWidthMm,
    },
  };
}

/** Drops blank values so `?radius=` falls back to the default instead of failing. */
export function toRecord(params: URLSearchParams): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of params) {
    if (value !== '') record[key] = value;
  }
  return record;
}

export function parseSearchQuery(
  params: URLSearchParams,
  now: Date = new Date(),
): ParseResult<ParsedSearchQuery> {
  const parsed = searchQuerySchema.safeParse(toRecord(params));
  if (!parsed.success) {
    return { ok: false, message: 'invalid search query', issues: formatIssues(parsed.error) };
  }

  const vehicle = resolveVehicle(parsed.data);
  if (!vehicle.ok) return vehicle;

  return {
    ok: true,
    value: {
      center: { lat: parsed.data.lat, lng: parsed.data.lng },
      radiusMeters: parsed.data.radius,
      vehicle: vehicle.value,
      structures: parsed.data.structures ?? [],
      requireEvCharging: parsed.data.ev,
      hideFull: parsed.data.hideFull,
      arrival: parsed.data.arrival ?? now,
      durationMinutes: parsed.data.duration,
      limit: parsed.data.limit,
    },
  };
}

export type ParsedEstimateQuery = {
  vehicle: VehicleSpec | null;
  arrival: Date;
  durationMinutes: number;
};

/** The detail endpoint prices one lot, so it needs the vehicle and stay only. */
export function parseEstimateQuery(
  params: URLSearchParams,
  now: Date = new Date(),
): ParseResult<ParsedEstimateQuery> {
  const parsed = estimateQuerySchema.safeParse(toRecord(params));
  if (!parsed.success) {
    return { ok: false, message: 'invalid query', issues: formatIssues(parsed.error) };
  }

  const vehicle = resolveVehicle(parsed.data);
  if (!vehicle.ok) return vehicle;

  return {
    ok: true,
    value: {
      vehicle: vehicle.value,
      arrival: parsed.data.arrival ?? now,
      durationMinutes: parsed.data.duration,
    },
  };
}

/** `unknown` carries no signal, so users may only report a definite state. */
export const REPORTABLE_STATUSES = AVAILABILITY_STATUSES.filter(
  (status) => status !== 'unknown',
) as Exclude<(typeof AVAILABILITY_STATUSES)[number], 'unknown'>[];

export const reportBodySchema = z.object({
  status: z.enum(['available', 'crowded', 'full']),
  vacantCount: z.number().int().min(0).max(9_999).nullish(),
  note: z.string().trim().max(280).nullish(),
});

export type ReportBody = z.infer<typeof reportBodySchema>;

export function parseReportBody(input: unknown): ParseResult<ReportBody> {
  const parsed = reportBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'invalid report', issues: formatIssues(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

export const vehicleProfileBodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  lengthMm: z.number().int().positive().max(30_000),
  widthMm: z.number().int().positive().max(30_000),
  heightMm: z.number().int().positive().max(30_000),
  weightKg: z.number().int().positive().max(50_000),
  tireWidthMm: z.number().int().positive().max(30_000).nullish(),
});

export type VehicleProfileBody = z.infer<typeof vehicleProfileBodySchema>;

export function parseVehicleProfileBody(input: unknown): ParseResult<VehicleProfileBody> {
  const parsed = vehicleProfileBodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'invalid vehicle profile', issues: formatIssues(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
