import type { ParkingSearchItem } from '@/db/repository';
import type { AvailabilityStatus, LatLng, Parking, UserReport } from '@/domain/types';
import type { ResolvedAvailability } from '@/domain/availability';
import type { FeeEstimate } from '@/domain/pricing';
import type { FitResult } from '@/domain/vehicle';

import { filtersToSearchParams, type FilterState } from './filters';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type SearchResponse = {
  center: LatLng;
  radiusMeters: number;
  durationMinutes: number;
  count: number;
  items: ParkingSearchItem[];
};

export type ParkingDetailResponse = {
  parking: Parking;
  availability: ResolvedAvailability;
  fit: FitResult | null;
  fee: FeeEstimate;
  reports: UserReport[];
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? `request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export function searchParkings(
  center: LatLng,
  filters: FilterState,
  init?: RequestInit,
): Promise<SearchResponse> {
  const params = filtersToSearchParams(center, filters);
  return request<SearchResponse>(`/api/parkings?${params.toString()}`, init);
}

export function fetchParkingDetail(
  parkingId: string,
  init?: RequestInit,
): Promise<ParkingDetailResponse> {
  return request<ParkingDetailResponse>(`/api/parkings/${encodeURIComponent(parkingId)}`, init);
}

export type SubmitReportInput = {
  status: Exclude<AvailabilityStatus, 'unknown'>;
  vacantCount?: number | null;
  note?: string | null;
};

export function submitReport(
  parkingId: string,
  body: SubmitReportInput,
): Promise<{ report: UserReport }> {
  return request<{ report: UserReport }>(
    `/api/parkings/${encodeURIComponent(parkingId)}/reports`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}
