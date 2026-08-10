import type { AvailabilitySnapshot, FeeSchedule, Parking } from '@/domain/types';

type Tariff = {
  dayUnitMinutes: number;
  dayUnitYen: number;
  nightUnitMinutes: number;
  nightUnitYen: number;
  dailyCapYen?: number;
  nightCapYen?: number;
};

/** Builds the "daytime rate / night rate / daily cap" shape most coin parks use. */
function tariff(input: Tariff): FeeSchedule {
  const caps: FeeSchedule['caps'] = [];
  if (input.nightCapYen !== undefined) {
    caps.push({
      id: 'night-cap',
      label: `夜間最大 ${input.nightCapYen}円`,
      window: { startMinute: 20 * 60, endMinute: 32 * 60 },
      capYen: input.nightCapYen,
      repeat: 'daily',
    });
  }
  if (input.dailyCapYen !== undefined) {
    caps.push({
      id: 'daily-cap',
      label: `24時間最大 ${input.dailyCapYen}円`,
      window: { startMinute: 0, endMinute: 24 * 60 },
      capYen: input.dailyCapYen,
      repeat: 'once',
    });
  }

  return {
    currency: 'JPY',
    segments: [
      {
        id: 'day',
        label: `8:00-20:00 ${input.dayUnitYen}円/${input.dayUnitMinutes}分`,
        window: { startMinute: 8 * 60, endMinute: 20 * 60 },
        unitMinutes: input.dayUnitMinutes,
        unitYen: input.dayUnitYen,
      },
      {
        id: 'night',
        label: `20:00-8:00 ${input.nightUnitYen}円/${input.nightUnitMinutes}分`,
        window: { startMinute: 20 * 60, endMinute: 32 * 60 },
        unitMinutes: input.nightUnitMinutes,
        unitYen: input.nightUnitYen,
      },
    ],
    caps,
  };
}

const BASE_UPDATED_AT = '2026-08-01T00:00:00.000Z';

/**
 * Demo dataset around Shibuya / Omotesando. Values are illustrative — the real
 * catalogue is produced by the ingest pipeline in `src/ingest`.
 */
export const SEED_PARKINGS: Parking[] = [
  {
    id: 'demo-shibuya-001',
    source: 'demo',
    sourceId: 'shibuya-001',
    name: 'デモパーク 渋谷センター街',
    address: '東京都渋谷区宇田川町16-1',
    location: { lat: 35.6607, lng: 139.6989 },
    structure: 'flat',
    capacity: 24,
    limits: {
      maxLengthMm: 5000,
      maxWidthMm: 1900,
      maxHeightMm: 2100,
      maxWeightKg: 2500,
      maxTireWidthMm: null,
    },
    features: { evCharging: true, hasRoof: false, cashless: true, open24h: true, accessible: true },
    feeSchedule: tariff({
      dayUnitMinutes: 12,
      dayUnitYen: 200,
      nightUnitMinutes: 60,
      nightUnitYen: 100,
      dailyCapYen: 2400,
      nightCapYen: 600,
    }),
    officialUrl: 'https://example.com/demo/shibuya-001',
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-shibuya-002',
    source: 'demo',
    sourceId: 'shibuya-002',
    name: 'デモパーク 道玄坂機械式',
    address: '東京都渋谷区道玄坂2-25',
    location: { lat: 35.6579, lng: 139.6966 },
    structure: 'mechanical',
    capacity: 40,
    limits: {
      maxLengthMm: 5000,
      maxWidthMm: 1850,
      maxHeightMm: 1550,
      maxWeightKg: 2000,
      maxTireWidthMm: 205,
    },
    features: { evCharging: false, hasRoof: true, cashless: true, open24h: false, accessible: false },
    feeSchedule: tariff({
      dayUnitMinutes: 15,
      dayUnitYen: 200,
      nightUnitMinutes: 60,
      nightUnitYen: 100,
      dailyCapYen: 2000,
    }),
    officialUrl: 'https://example.com/demo/shibuya-002',
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-shibuya-003',
    source: 'demo',
    sourceId: 'shibuya-003',
    name: 'デモパーク 桜丘口 立体',
    address: '東京都渋谷区桜丘町1-1',
    location: { lat: 35.6551, lng: 139.6998 },
    structure: 'multistory',
    capacity: 180,
    limits: {
      maxLengthMm: 5300,
      maxWidthMm: 2000,
      maxHeightMm: 2300,
      maxWeightKg: 2600,
      maxTireWidthMm: null,
    },
    features: { evCharging: true, hasRoof: true, cashless: true, open24h: true, accessible: true },
    feeSchedule: tariff({
      dayUnitMinutes: 30,
      dayUnitYen: 330,
      nightUnitMinutes: 60,
      nightUnitYen: 165,
      dailyCapYen: 3300,
    }),
    officialUrl: 'https://example.com/demo/shibuya-003',
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-shibuya-004',
    source: 'demo',
    sourceId: 'shibuya-004',
    name: 'デモパーク 神南 路上パーキング',
    address: '東京都渋谷区神南1-20',
    location: { lat: 35.6634, lng: 139.7003 },
    structure: 'roadside',
    capacity: 6,
    limits: {
      maxLengthMm: 5000,
      maxWidthMm: 1900,
      maxHeightMm: null,
      maxWeightKg: null,
      maxTireWidthMm: null,
    },
    features: { evCharging: false, hasRoof: false, cashless: false, open24h: false, accessible: false },
    feeSchedule: {
      currency: 'JPY',
      segments: [
        {
          id: 'daytime-only',
          label: '8:00-20:00 300円/60分',
          window: { startMinute: 8 * 60, endMinute: 20 * 60 },
          unitMinutes: 60,
          unitYen: 300,
        },
      ],
      caps: [],
    },
    officialUrl: null,
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-omotesando-005',
    source: 'demo',
    sourceId: 'omotesando-005',
    name: 'デモパーク 表参道 地下',
    address: '東京都渋谷区神宮前4-12',
    location: { lat: 35.6673, lng: 139.7085 },
    structure: 'underground',
    capacity: 90,
    limits: {
      maxLengthMm: 4900,
      maxWidthMm: 1800,
      maxHeightMm: 1600,
      maxWeightKg: 2200,
      maxTireWidthMm: 215,
    },
    features: { evCharging: true, hasRoof: true, cashless: true, open24h: false, accessible: true },
    feeSchedule: tariff({
      dayUnitMinutes: 15,
      dayUnitYen: 300,
      nightUnitMinutes: 30,
      nightUnitYen: 150,
      dailyCapYen: 3800,
      nightCapYen: 900,
    }),
    officialUrl: 'https://example.com/demo/omotesando-005',
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-ebisu-006',
    source: 'demo',
    sourceId: 'ebisu-006',
    name: 'デモパーク 恵比寿西 平面',
    address: '東京都渋谷区恵比寿西1-8',
    location: { lat: 35.6469, lng: 139.7093 },
    structure: 'flat',
    capacity: 12,
    limits: {
      maxLengthMm: 5200,
      maxWidthMm: 2000,
      maxHeightMm: 2500,
      maxWeightKg: 3000,
      maxTireWidthMm: null,
    },
    features: { evCharging: false, hasRoof: false, cashless: true, open24h: true, accessible: false },
    feeSchedule: tariff({
      dayUnitMinutes: 20,
      dayUnitYen: 200,
      nightUnitMinutes: 60,
      nightUnitYen: 100,
      dailyCapYen: 1800,
      nightCapYen: 500,
    }),
    officialUrl: 'https://example.com/demo/ebisu-006',
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-harajuku-007',
    source: 'demo',
    sourceId: 'harajuku-007',
    name: 'デモパーク 原宿 軽専用',
    address: '東京都渋谷区神宮前6-31',
    location: { lat: 35.6684, lng: 139.7031 },
    structure: 'flat',
    capacity: 8,
    limits: {
      maxLengthMm: 3600,
      maxWidthMm: 1500,
      maxHeightMm: 1700,
      maxWeightKg: 1200,
      maxTireWidthMm: 175,
    },
    features: { evCharging: false, hasRoof: false, cashless: true, open24h: true, accessible: false },
    feeSchedule: tariff({
      dayUnitMinutes: 30,
      dayUnitYen: 200,
      nightUnitMinutes: 60,
      nightUnitYen: 100,
    }),
    officialUrl: null,
    updatedAt: BASE_UPDATED_AT,
  },
  {
    id: 'demo-daikanyama-008',
    source: 'demo',
    sourceId: 'daikanyama-008',
    name: 'デモパーク 代官山 大型対応',
    address: '東京都渋谷区代官山町10-1',
    location: { lat: 35.6485, lng: 139.7031 },
    structure: 'flat',
    capacity: 15,
    limits: {
      maxLengthMm: 6000,
      maxWidthMm: 2200,
      maxHeightMm: 2800,
      maxWeightKg: 3500,
      maxTireWidthMm: null,
    },
    features: { evCharging: true, hasRoof: false, cashless: true, open24h: true, accessible: true },
    feeSchedule: tariff({
      dayUnitMinutes: 20,
      dayUnitYen: 400,
      nightUnitMinutes: 60,
      nightUnitYen: 200,
      dailyCapYen: 4000,
    }),
    officialUrl: 'https://example.com/demo/daikanyama-008',
    updatedAt: BASE_UPDATED_AT,
  },
];

const OBSERVED_AT = '2026-08-01T00:05:00.000Z';

export const SEED_SNAPSHOTS: AvailabilitySnapshot[] = [
  {
    parkingId: 'demo-shibuya-001',
    status: 'available',
    vacantCount: 7,
    observedAt: OBSERVED_AT,
    source: 'demo',
  },
  {
    parkingId: 'demo-shibuya-002',
    status: 'full',
    vacantCount: 0,
    observedAt: OBSERVED_AT,
    source: 'demo',
  },
  {
    parkingId: 'demo-shibuya-003',
    status: 'crowded',
    vacantCount: 3,
    observedAt: OBSERVED_AT,
    source: 'demo',
  },
  {
    parkingId: 'demo-omotesando-005',
    status: 'available',
    vacantCount: 22,
    observedAt: OBSERVED_AT,
    source: 'demo',
  },
];
