import { describe, expect, it } from 'vitest';

import { FALLBACK_CENTER, FALLBACK_MAP_ID, readPublicConfig } from './env';

describe('readPublicConfig', () => {
  it('boots with nothing configured', () => {
    expect(readPublicConfig({})).toEqual({
      googleMapsApiKey: null,
      mapId: FALLBACK_MAP_ID,
      clerkEnabled: false,
      initialCenter: FALLBACK_CENTER,
    });
  });

  it('reads a fully configured environment', () => {
    expect(
      readPublicConfig({
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'key-123',
        NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: 'map-123',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x',
        NEXT_PUBLIC_DEFAULT_LAT: '34.7',
        NEXT_PUBLIC_DEFAULT_LNG: '135.5',
      }),
    ).toEqual({
      googleMapsApiKey: 'key-123',
      mapId: 'map-123',
      clerkEnabled: true,
      initialCenter: { lat: 34.7, lng: 135.5 },
    });
  });

  it('treats empty strings as unset', () => {
    const config = readPublicConfig({
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: '',
      NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    });

    expect(config.googleMapsApiKey).toBeNull();
    expect(config.mapId).toBe(FALLBACK_MAP_ID);
    expect(config.clerkEnabled).toBe(false);
  });

  it.each([
    ['not a number', 'north'],
    ['out of range', '200'],
  ])('falls back to the default centre for %s coordinates', (_label, value) => {
    expect(
      readPublicConfig({ NEXT_PUBLIC_DEFAULT_LAT: value, NEXT_PUBLIC_DEFAULT_LNG: value })
        .initialCenter,
    ).toEqual(FALLBACK_CENTER);
  });

  it('accepts a longitude that would be out of range for a latitude', () => {
    const config = readPublicConfig({
      NEXT_PUBLIC_DEFAULT_LAT: '120',
      NEXT_PUBLIC_DEFAULT_LNG: '120',
    });

    expect(config.initialCenter).toEqual({ lat: FALLBACK_CENTER.lat, lng: 120 });
  });
});
