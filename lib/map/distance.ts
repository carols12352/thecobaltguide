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
