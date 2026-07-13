import maplibregl from "maplibre-gl";
import { getTransitionDurationMs, distanceMetres } from "@/lib/map/distance";
import type { MapPlace } from "@/types/domain";

export type MapCoord = {
  latitude: number;
  longitude: number;
};

/** Within this distance, flyTo will not zoom out below the current level. */
export const LOCAL_MOVE_NO_ZOOM_OUT_METRES = 5_000;

export function shouldAvoidZoomOut(
  distanceMetresValue: number,
  threshold = LOCAL_MOVE_NO_ZOOM_OUT_METRES,
): boolean {
  return distanceMetresValue <= threshold;
}

export function easeToLocation(
  map: maplibregl.Map,
  from: MapCoord,
  to: MapCoord,
  options: {
    targetZoom: number;
    localMoveMetres?: number;
  },
): void {
  const dist = distanceMetres(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );
  const currentZoom = map.getZoom();
  const targetZoom = Math.max(currentZoom, options.targetZoom);
  const duration = getTransitionDurationMs(dist);

  map.stop();

  map.flyTo({
    center: [to.longitude, to.latitude],
    zoom: targetZoom,
    duration,
    ...(shouldAvoidZoomOut(dist, options.localMoveMetres)
      ? { minZoom: Math.min(currentZoom, targetZoom) - 0.25 }
      : {}),
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
