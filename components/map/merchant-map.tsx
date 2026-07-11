"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_DEFAULTS } from "@/config/constants";
import { DEFAULT_CENTER, getMapStyleUrl } from "@/lib/map/config";
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
        multiplier: place.multiplier ?? "?",
        recentReportCount: place.recentReportCount,
      },
    })),
  };
}

function setupPlaceLayers(map: maplibregl.Map) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterMaxZoom: MAP_DEFAULTS.clusterZoomThreshold,
    clusterRadius: 50,
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
      "circle-radius": 10,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
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
      });
    } catch {
      // ignore cluster expansion errors
    }
  });

  map.on("click", UNCLUSTERED_LAYER, (event) => {
    const feature = event.features?.[0];
    const placeId = feature?.properties?.id;
    if (placeId) window.location.href = `/place/${placeId}`;
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

function updatePlacesSource(map: maplibregl.Map, places: MapPlace[]) {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(placesToGeoJSON(places));
}

export function MerchantMap({ filters, onPlacesLoaded }: MerchantMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPlacesLoadedRef = useRef(onPlacesLoaded);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onPlacesLoadedRef.current = onPlacesLoaded;

  const fetchPlaces = useCallback(async (map: maplibregl.Map) => {
    const bounds = map.getBounds();
    const center = map.getCenter();
    const params = new URLSearchParams({
      north: bounds.getNorth().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      west: bounds.getWest().toString(),
      zoom: map.getZoom().toFixed(0),
    });

    if (filters.multiplier) params.set("multiplier", filters.multiplier);
    if (filters.category) params.set("category", filters.category);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/places/map?${params}`);
      if (!res.ok) throw new Error("Failed to load places");
      const data = await res.json();
      updatePlacesSource(map, data.places);
      onPlacesLoadedRef.current?.(data.places, {
        center: { latitude: center.lat, longitude: center.lng },
        zoom: map.getZoom(),
      });
    } catch {
      setError("Could not load merchant data");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(),
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: MAP_DEFAULTS.defaultZoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );

    map.on("load", () => {
      setupPlaceLayers(map);
      fetchPlaces(map);
    });

    map.on("moveend", () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => fetchPlaces(map),
        MAP_DEFAULTS.debounceMs,
      );
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fetchPlaces]);

  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) {
      fetchPlaces(mapRef.current);
    }
  }, [filters, fetchPlaces]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-xl" />
      {loading && (
        <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1.5 text-sm shadow dark:bg-zinc-900/90">
          Loading…
        </div>
      )}
      {error && (
        <div className="absolute bottom-3 left-3 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700 shadow">
          {error}
        </div>
      )}
    </div>
  );
}
