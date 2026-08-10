import type { LatLng } from '@/domain/types';

/** Shibuya station — the demo dataset is clustered around here. */
export const FALLBACK_CENTER: LatLng = { lat: 35.658, lng: 139.7016 };

/**
 * Google requires a Map ID for Advanced Markers; `DEMO_MAP_ID` is their public
 * placeholder so the map still renders before a real one is provisioned.
 */
export const FALLBACK_MAP_ID = 'DEMO_MAP_ID';

export type PublicConfig = {
  googleMapsApiKey: string | null;
  mapId: string;
  clerkEnabled: boolean;
  initialCenter: LatLng;
};

const readCoordinate = (raw: string | undefined, fallback: number, limit: number): number => {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > limit) return fallback;
  return value;
};

/**
 * Every value is optional: a checkout with no environment at all still boots
 * into demo mode with seed data, a list-only view and auth disabled.
 */
export function readPublicConfig(
  env: Record<string, string | undefined> = process.env,
): PublicConfig {
  return {
    googleMapsApiKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null,
    mapId: env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || FALLBACK_MAP_ID,
    clerkEnabled: Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    initialCenter: {
      lat: readCoordinate(env.NEXT_PUBLIC_DEFAULT_LAT, FALLBACK_CENTER.lat, 90),
      lng: readCoordinate(env.NEXT_PUBLIC_DEFAULT_LNG, FALLBACK_CENTER.lng, 180),
    },
  };
}
