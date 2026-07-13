import maplibregl from "maplibre-gl";
import { getTransitionDurationMs, distanceMetres } from "@/lib/map/distance";
import type { MapPlace } from "@/types/domain";

export const FAR_PULLBACK_DISTANCE_METRES = 500;

export type MapCoord = {
  latitude: number;
  longitude: number;
};

export function shouldUsePullbackMove(
  distanceMetresValue: number,
  threshold = FAR_PULLBACK_DISTANCE_METRES,
): boolean {
  return distanceMetresValue > threshold;
}

export function getMapMovePhaseDurations(distanceMetresValue: number): {
  totalMs: number;
  pullbackMs: number;
  zoomInMs: number;
} {
  const totalMs = getTransitionDurationMs(distanceMetresValue);

  if (!shouldUsePullbackMove(distanceMetresValue)) {
    return { totalMs, pullbackMs: 0, zoomInMs: totalMs };
  }

  const pullbackMs = Math.round(totalMs * 0.45);
  return {
    totalMs,
    pullbackMs,
    zoomInMs: totalMs - pullbackMs,
  };
}

export function easeToLocation(
  map: maplibregl.Map,
  from: MapCoord,
  to: MapCoord,
  options: {
    targetZoom: number;
    farDistanceMetres?: number;
  },
): void {
  const dist = distanceMetres(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  const targetZoom = Math.max(map.getZoom(), options.targetZoom);
  const { pullbackMs, zoomInMs } = getMapMovePhaseDurations(dist);

  map.stop();

  if (!shouldUsePullbackMove(dist, options.farDistanceMetres)) {
    map.easeTo({
      center: [to.longitude, to.latitude],
      zoom: targetZoom,
      duration: zoomInMs,
    });
    return;
  }

  map.fitBounds(
    [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
    {
      padding: 80,
      duration: pullbackMs,
      maxZoom: Math.min(map.getZoom(), 12),
    },
  );

  map.once("moveend", function finishEaseToLocation() {
    map.off("moveend", finishEaseToLocation);
    map.easeTo({
      center: [to.longitude, to.latitude],
      zoom: targetZoom,
      duration: zoomInMs,
    });
  });
}

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
  distanceMetresValue?: number,
): number {
  const dist =
    distanceMetresValue ??
    distanceMetres(from.latitude, from.longitude, to.latitude, to.longitude);
  return getTransitionDurationMs(dist);
}
