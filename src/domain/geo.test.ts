import { describe, expect, it } from 'vitest';

import { boundingBox, clampLatitude, distanceMeters, normalizeLongitude } from './geo';

const SHIBUYA = { lat: 35.658, lng: 139.7016 };
const SHINJUKU = { lat: 35.6896, lng: 139.7006 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(SHIBUYA, SHIBUYA)).toBe(0);
  });

  it('measures a known city distance', () => {
    const distance = distanceMeters(SHIBUYA, SHINJUKU);
    expect(distance).toBeGreaterThan(3_400);
    expect(distance).toBeLessThan(3_600);
  });

  it('is symmetric', () => {
    expect(distanceMeters(SHIBUYA, SHINJUKU)).toBeCloseTo(distanceMeters(SHINJUKU, SHIBUYA), 6);
  });

  it('handles antipodal points without NaN', () => {
    const distance = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(distance).toBeCloseTo(Math.PI * 6_371_008.8, 0);
  });
});

describe('clampLatitude', () => {
  it.each([
    [95, 90],
    [-95, -90],
    [35, 35],
  ])('clamps %s to %s', (input, expected) => {
    expect(clampLatitude(input)).toBe(expected);
  });
});

describe('normalizeLongitude', () => {
  it.each([
    [190, -170],
    [-190, 170],
    [180, -180],
    [139.7, 139.7],
    [-179.5, -179.5],
  ])('wraps %s to %s', (input, expected) => {
    expect(normalizeLongitude(input)).toBeCloseTo(expected, 9);
  });
});

describe('boundingBox', () => {
  it('contains every point within the radius', () => {
    const box = boundingBox(SHIBUYA, 1_000);

    expect(box.minLat).toBeLessThan(SHIBUYA.lat);
    expect(box.maxLat).toBeGreaterThan(SHIBUYA.lat);
    expect(box.minLng).toBeLessThan(SHIBUYA.lng);
    expect(box.maxLng).toBeGreaterThan(SHIBUYA.lng);

    const north = { lat: box.maxLat, lng: SHIBUYA.lng };
    expect(distanceMeters(SHIBUYA, north)).toBeGreaterThanOrEqual(999);
  });

  it('widens longitude to cover the shrinking meridians near the pole', () => {
    const box = boundingBox({ lat: 89, lng: 0 }, 100_000);
    expect(box.minLng).toBe(-180);
    expect(box.maxLng).toBe(180);
  });

  it('falls back to the whole world at the pole itself', () => {
    const box = boundingBox({ lat: 90, lng: 0 }, 50_000);
    expect(box).toMatchObject({ maxLat: 90, minLng: -180, maxLng: 180 });
  });
});
