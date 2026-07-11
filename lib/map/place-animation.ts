import maplibregl from "maplibre-gl";
import { getTransitionDurationMs, distanceMetres } from "@/lib/map/distance";
import type { MapPlace } from "@/types/domain";

export function animatePlaceFeature(
  map: maplibregl.Map,
  sourceId: string,
  placeId: string,
  durationMs: number,
): void {
  try {
    map.setFeatureState(
      { source: sourceId, id: placeId },
      { opacity: 0, scale: 0.4 },
    );
  } catch {
    return;
  }

  const start = performance.now();

  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / durationMs);
    const eased = 1 - (1 - progress) ** 3;

    try {
      map.setFeatureState(
        { source: sourceId, id: placeId },
        { opacity: eased, scale: 0.4 + 0.6 * eased },
      );
    } catch {
      return;
    }

    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

export function animatePlacesIn(
  map: maplibregl.Map,
  sourceId: string,
  places: MapPlace[],
  center: { latitude: number; longitude: number },
): void {
  for (const place of places) {
    const dist = distanceMetres(
      center.latitude,
      center.longitude,
      place.latitude,
      place.longitude,
    );
    animatePlaceFeature(
      map,
      sourceId,
      place.id,
      getTransitionDurationMs(dist),
    );
  }
}

export function getFlyDurationMs(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  return getTransitionDurationMs(
    distanceMetres(from.latitude, from.longitude, to.latitude, to.longitude),
  );
}
