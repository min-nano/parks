import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import type { AvailabilityStatus, FeeSchedule, ParkingFeatures, ParkingStructure } from '@/domain/types';

export const parkings = pgTable(
  'parkings',
  {
    id: text('id').primaryKey(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    structure: text('structure').$type<ParkingStructure>().notNull(),
    capacity: integer('capacity'),
    maxLengthMm: integer('max_length_mm'),
    maxWidthMm: integer('max_width_mm'),
    maxHeightMm: integer('max_height_mm'),
    maxWeightKg: integer('max_weight_kg'),
    maxTireWidthMm: integer('max_tire_width_mm'),
    features: jsonb('features').$type<ParkingFeatures>().notNull(),
    feeSchedule: jsonb('fee_schedule').$type<FeeSchedule>().notNull(),
    officialUrl: text('official_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('parkings_source_source_id_key').on(table.source, table.sourceId),
    index('parkings_lat_lng_idx').on(table.lat, table.lng),
  ],
);

export const availabilitySnapshots = pgTable(
  'availability_snapshots',
  {
    id: text('id').primaryKey(),
    parkingId: text('parking_id')
      .notNull()
      .references(() => parkings.id, { onDelete: 'cascade' }),
    status: text('status').$type<AvailabilityStatus>().notNull(),
    vacantCount: integer('vacant_count'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    source: text('source').notNull(),
  },
  (table) => [index('availability_snapshots_parking_observed_idx').on(table.parkingId, table.observedAt)],
);

export const userReports = pgTable(
  'user_reports',
  {
    id: text('id').primaryKey(),
    parkingId: text('parking_id')
      .notNull()
      .references(() => parkings.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    status: text('status').$type<AvailabilityStatus>().notNull(),
    vacantCount: integer('vacant_count'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('user_reports_parking_created_idx').on(table.parkingId, table.createdAt)],
);

export const vehicleProfiles = pgTable('vehicle_profiles', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  lengthMm: integer('length_mm').notNull(),
  widthMm: integer('width_mm').notNull(),
  heightMm: integer('height_mm').notNull(),
  weightKg: integer('weight_kg').notNull(),
  tireWidthMm: integer('tire_width_mm'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const schema = { parkings, availabilitySnapshots, userReports, vehicleProfiles };
export type Schema = typeof schema;
