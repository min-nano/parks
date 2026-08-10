import type { LatLng } from './types';

export const EARTH_RADIUS_M = 6_371_008.8;

export type BoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const clampLatitude = (lat: number): number => Math.min(90, Math.max(-90, lat));

/** Wraps a longitude into [-180, 180) so bounding boxes stay well formed. */
export const normalizeLongitude = (lng: number): number => {
  const wrapped = ((lng + 180) % 360 + 360) % 360;
  return wrapped - 180;
};

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bounding box that fully contains the circle of `radiusMeters` around `center`.
 *
 * Used as a cheap pre-filter in SQL before the exact haversine distance is
 * computed. Near the poles the longitude delta degenerates, so we widen the box
 * to the full range rather than dividing by ~0.
 */
export function boundingBox(center: LatLng, radiusMeters: number): BoundingBox {
  const latDelta = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const minLat = clampLatitude(center.lat - latDelta);
  const maxLat = clampLatitude(center.lat + latDelta);

  const widestLat = Math.max(Math.abs(minLat), Math.abs(maxLat));
  const shrink = Math.cos(toRadians(widestLat));

  if (shrink < 1e-6) {
    return { minLat, maxLat, minLng: -180, maxLng: 180 };
  }

  const lngDelta = latDelta / shrink;
  if (lngDelta >= 180) {
    return { minLat, maxLat, minLng: -180, maxLng: 180 };
  }

  return {
    minLat,
    maxLat,
    minLng: normalizeLongitude(center.lng - lngDelta),
    maxLng: normalizeLongitude(center.lng + lngDelta),
  };
}
