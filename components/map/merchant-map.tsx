"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_DEFAULTS } from "@/config/constants";
import { DEFAULT_CENTER, getMapStyleUrl } from "@/lib/map/config";
import {
  animatePlacesIn,
  getFlyDurationMs,
} from "@/lib/map/place-animation";
import { registerPoiIconFallback } from "@/lib/map/poi-icon-fallback";
import {
  placeFromGeoJsonFeature,
  showPlacePopup,
} from "@/lib/map/place-popup";
import type { MapPlace } from "@/types/domain";
import type { MapFilters } from "@/components/filters/map-filters";

const SOURCE_ID = "places";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "unclustered-point";

export interface MapViewportMeta {
  center: { latitude: number; longitude: number };
  zoom: number;
}

interface MerchantMapProps {
  filters: MapFilters;
  selectedPlace?: MapPlace | null;
  onPlaceSelect?: (place: MapPlace) => void;
  onPlacesLoaded?: (places: MapPlace[], meta: MapViewportMeta) => void;
}

function placesToGeoJSON(places: MapPlace[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [place.longitude, place.latitude],
      },
      properties: {
        id: place.id,
        name: place.name,
        city: place.city ?? "",
        province: place.province ?? "",
        multiplier: place.multiplier ?? "?",
        confidenceLevel: place.confidenceLevel,
        recentReportCount: place.recentReportCount,
      },
    })),
  };
}

function setupPlaceLayers(
  map: maplibregl.Map,
  popupRef: { current: maplibregl.Popup | null },
  onPlaceSelectRef: { current: ((place: MapPlace) => void) | undefined },
) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterMaxZoom: MAP_DEFAULTS.clusterZoomThreshold,
    clusterRadius: 50,
    promoteId: "id",
  });

  map.addLayer({
    id: CLUSTER_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#2563eb",
      "circle-radius": [
        "step",
        ["get", "point_count"],
        18,
        10,
        22,
        50,
        28,
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: CLUSTER_COUNT_LAYER,
    type: "symbol",
    source: SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 12,
      "text-font": ["Noto Sans Bold"],
    },
    paint: { "text-color": "#ffffff" },
  });

  map.addLayer({
    id: UNCLUSTERED_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#2563eb",
      "circle-radius": ["*", 10, ["coalesce", ["feature-state", "scale"], 1]],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": ["coalesce", ["feature-state", "opacity"], 1],
    },
  });

  map.on("click", CLUSTER_LAYER, async (event) => {
    const features = map.queryRenderedFeatures(event.point, {
      layers: [CLUSTER_LAYER],
    });
    const clusterId = features[0]?.properties?.cluster_id;
    if (clusterId == null) return;

    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    try {
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const coordinates = (features[0].geometry as GeoJSON.Point).coordinates;
      map.easeTo({
        center: coordinates as [number, number],
        zoom,
        duration: getFlyDurationMs(
          { latitude: map.getCenter().lat, longitude: map.getCenter().lng },
          { latitude: coordinates[1], longitude: coordinates[0] },
        ),
      });
    } catch {
      // ignore cluster expansion errors
    }
  });

  map.on("click", UNCLUSTERED_LAYER, (event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const place = placeFromGeoJsonFeature(feature);
    if (place) {
      showPlacePopup(map, place, popupRef);
      onPlaceSelectRef.current?.(place);
    }
  });

  map.on("mouseenter", CLUSTER_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", CLUSTER_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });
  map.on("mouseenter", UNCLUSTERED_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", UNCLUSTERED_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });
}

function updatePlacesSource(
  map: maplibregl.Map,
  places: MapPlace[],
  center: { latitude: number; longitude: number },
  animate = true,
) {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(placesToGeoJSON(places));
  if (animate) {
    animatePlacesIn(map, SOURCE_ID, places, center);
  }
}

export function MerchantMap(props: MerchantMapProps) {
  const { filters, selectedPlace, onPlacesLoaded } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const placesRef = useRef<MapPlace[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters);
  const onPlacesLoadedRef = useRef(onPlacesLoaded);
  const onPlaceSelectRef = useRef(props.onPlaceSelect);
  const fetchPlacesRef = useRef<(map: maplibregl.Map) => Promise<void>>(
    async () => {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    onPlacesLoadedRef.current = onPlacesLoaded;
    onPlaceSelectRef.current = props.onPlaceSelect;
  }, [onPlacesLoaded, props.onPlaceSelect]);

  const fetchPlaces = useCallback(async (map: maplibregl.Map) => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const bounds = map.getBounds();
    const center = map.getCenter();
    const params = new URLSearchParams({
      north: bounds.getNorth().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      west: bounds.getWest().toString(),
      zoom: map.getZoom().toFixed(0),
    });

    const activeFilters = filtersRef.current;
    if (activeFilters.multiplier) params.set("multiplier", activeFilters.multiplier);
    if (activeFilters.category) params.set("category", activeFilters.category);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/places/map?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to load places");
      const data = await res.json();
      placesRef.current = data.places;
      updatePlacesSource(
        map,
        data.places,
        { latitude: center.lat, longitude: center.lng },
      );
      onPlacesLoadedRef.current?.(data.places, {
        center: { latitude: center.lat, longitude: center.lng },
        zoom: map.getZoom(),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Could not load merchant data");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlacesRef.current = fetchPlaces;
  }, [fetchPlaces]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(),
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: MAP_DEFAULTS.defaultZoom,
    });

    registerPoiIconFallback(map);

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );

    map.on("load", () => {
      setupPlaceLayers(map, popupRef, onPlaceSelectRef);
      void fetchPlacesRef.current(map);
    });

    map.on("moveend", () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => void fetchPlacesRef.current(map),
        MAP_DEFAULTS.debounceMs,
      );
    });

    mapRef.current = map;

    return () => {
      fetchAbortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const popup = popupRef.current;
      popup?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    void fetchPlaces(map);
  }, [filters, fetchPlaces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) return;

    map.easeTo({
      center: [selectedPlace.longitude, selectedPlace.latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: getFlyDurationMs(
        { latitude: map.getCenter().lat, longitude: map.getCenter().lng },
        {
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
        },
      ),
    });
    showPlacePopup(map, selectedPlace, popupRef);
  }, [selectedPlace]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-xl" />
      {loading && (
        <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1.5 text-sm shadow dark:bg-zinc-900/90">
          Loading…
        </div>
      )}
      {error && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700 shadow">
          <span>{error}</span>
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              const map = mapRef.current;
              if (map) void fetchPlaces(map);
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
