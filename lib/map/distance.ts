import type { MapPlace } from "@/types/domain";

export function distanceMetres(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadius = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fixed duration tiers for map moves — one distance lookup, no per-frame work. */
export const MAP_MOVE_DURATION_TIERS = [
  { maxDistanceMetres: 500, durationMs: 500 },
  { maxDistanceMetres: 2_000, durationMs: 700 },
  { maxDistanceMetres: 10_000, durationMs: 1_000 },
  { maxDistanceMetres: 50_000, durationMs: 1_400 },
  { maxDistanceMetres: Number.POSITIVE_INFINITY, durationMs: 3_000 },
] as const;

/** Map fly duration from a precomputed distance (fixed tier lookup). */
export function getTransitionDurationMs(distanceMetres: number): number {
  for (const tier of MAP_MOVE_DURATION_TIERS) {
    if (distanceMetres <= tier.maxDistanceMetres) return tier.durationMs;
  }

  return MAP_MOVE_DURATION_TIERS[MAP_MOVE_DURATION_TIERS.length - 1].durationMs;
}

export function sortPlacesByDistance(
  places: MapPlace[],
  center: { latitude: number; longitude: number },
): MapPlace[] {
  return [...places]
    .map((place) => ({
      ...place,
      distanceMetres: distanceMetres(
        center.latitude,
        center.longitude,
        place.latitude,
        place.longitude,
      ),
    }))
    .sort((a, b) => (a.distanceMetres ?? 0) - (b.distanceMetres ?? 0));
}
