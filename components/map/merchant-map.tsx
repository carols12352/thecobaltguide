"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { MAP_DEFAULTS } from "@/config/constants";
import { DEFAULT_CENTER, getMapStyleUrl } from "@/lib/map/config";
import { distanceMetres } from "@/lib/map/distance";
import {
  alignViewportToGrid,
  boundsContains,
  filterPlacesInBounds,
  getMapViewportBounds,
  type ViewportBounds,
} from "@/lib/map/viewport-grid";
import {
  animatePlacesIn,
  easeToLocation,
  getFlyDurationMs,
} from "@/lib/map/place-animation";
import { registerPoiIconFallback } from "@/lib/map/poi-icon-fallback";
import {
  placeFromGeoJsonFeature,
  showPlacePopup,
} from "@/lib/map/place-popup";
import { isInCanada } from "@/lib/map/canada-bounds";
import type { MapCitySummary, MapPlace } from "@/types/domain";
import { isCityLevelZoom } from "@/lib/map/zoom-threshold";
import type { MapFilters } from "@/components/filters/map-filters";

const SOURCE_ID = "places";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "unclustered-point";

export interface MapViewportMeta {
  center: { latitude: number; longitude: number };
  zoom: number;
  inViewListEnabled: boolean;
  outOfArea?: boolean;
  citySummary?: MapCitySummary | null;
  truncated?: boolean;
  viewportCount?: number | null;
  /** When false, keep the current list page (e.g. center-only resort). */
  resetListPage?: boolean;
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
        sourceKind: place.sourceKind,
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

function samePlaceIds(a: MapPlace[], b: MapPlace[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((place) => place.id));
  return b.every((place) => ids.has(place.id));
}

function sameBounds(a: ViewportBounds, b: ViewportBounds): boolean {
  const epsilon = 1e-6;
  return (
    Math.abs(a.north - b.north) < epsilon &&
    Math.abs(a.south - b.south) < epsilon &&
    Math.abs(a.east - b.east) < epsilon &&
    Math.abs(a.west - b.west) < epsilon
  );
}

function mergePlacesById(primary: MapPlace[], extra: MapPlace[]): MapPlace[] {
  const merged = new Map(primary.map((place) => [place.id, place]));
  for (const place of extra) merged.set(place.id, place);
  return [...merged.values()];
}

function updatePlacesSource(
  map: maplibregl.Map,
  places: MapPlace[],
  center: { latitude: number; longitude: number },
  previousPlaces: MapPlace[],
  animate = false,
) {
  if (samePlaceIds(previousPlaces, places)) return;

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
  const listPlacesRef = useRef<MapPlace[] | null>(null);
  const visiblePlacesRef = useRef<MapPlace[]>([]);
  const lastNotifiedViewportCountRef = useRef<number | null>(null);
  const lastNotifiedTruncatedRef = useRef(false);
  const mapDisplayedRef = useRef<MapPlace[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSyncRafRef = useRef<number | null>(null);
  const localSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const viewportAbortRef = useRef<AbortController | null>(null);
  const viewportRequestIdRef = useRef(0);
  const filtersRef = useRef(filters);
  const onPlacesLoadedRef = useRef(onPlacesLoaded);
  const onPlaceSelectRef = useRef(props.onPlaceSelect);
  const fetchPlacesRef = useRef<
    (map: maplibregl.Map, options?: { animate?: boolean; force?: boolean }) => Promise<void>
  >(async () => {});
  const syncVisiblePlacesRef = useRef<
    (map: maplibregl.Map, options?: { animate?: boolean }) => void
  >(() => {});
  const scheduleViewportSyncRef = useRef<(map: maplibregl.Map) => void>(() => {});
  const animateNextFetchRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const programmaticMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedPlaceIdRef = useRef<string | null>(null);
  const loadedFetchBoundsRef = useRef<ViewportBounds | null>(null);
  const loadedInViewListEnabledRef = useRef<boolean | null>(null);
  const loadedCitySummaryRef = useRef<MapCitySummary | null>(null);
  const loadedClusterTruncatedRef = useRef(false);
  const loadedClusterCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const loadedViewportTruncatedRef = useRef(false);
  const loadedViewportCountRef = useRef<number | null>(null);
  const loadedGridTruncatedRef = useRef(false);
  const loadedListBoundsRef = useRef<ViewportBounds | null>(null);
  const loadedListCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const loadedCityFiltersRef = useRef<string>("");
  const loadedOutOfAreaRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areaOverlay, setAreaOverlay] = useState<{
    summary: MapCitySummary;
    truncated: boolean;
  } | null>(null);
  const [outOfArea, setOutOfArea] = useState(false);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    onPlacesLoadedRef.current = onPlacesLoaded;
    onPlaceSelectRef.current = props.onPlaceSelect;
  }, [onPlacesLoaded, props.onPlaceSelect]);

  const syncVisiblePlaces = useCallback((
    map: maplibregl.Map,
    options: { animate?: boolean } = {},
  ) => {
    const zoom = map.getZoom();
    const center = map.getCenter();
    const currentBounds = getMapViewportBounds(map);
    const exactViewStillCurrent =
      loadedListBoundsRef.current !== null &&
      sameBounds(loadedListBoundsRef.current, currentBounds);
    const meta: MapViewportMeta = {
      center: { latitude: center.lat, longitude: center.lng },
      zoom,
      inViewListEnabled: true,
      truncated: exactViewStillCurrent
        ? loadedViewportTruncatedRef.current
        : false,
      viewportCount: exactViewStillCurrent
        ? loadedViewportCountRef.current
        : null,
    };

    const mapPlaces = filterPlacesInBounds(placesRef.current, currentBounds);
    const exactList = exactViewStillCurrent && listPlacesRef.current
      ? filterPlacesInBounds(listPlacesRef.current, currentBounds)
      : null;
    const listSource = exactList?.length ? exactList : mapPlaces;
    const previousVisible = visiblePlacesRef.current;

    updatePlacesSource(
      map,
      mapPlaces,
      meta.center,
      mapDisplayedRef.current,
      options.animate ?? false,
    );
    mapDisplayedRef.current = mapPlaces;

    const placeSetChanged = !samePlaceIds(previousVisible, listSource);
    const metaChanged =
      lastNotifiedViewportCountRef.current !== meta.viewportCount ||
      lastNotifiedTruncatedRef.current !== meta.truncated;
    const centerMoved =
      loadedListCenterRef.current !== null &&
      distanceMetres(
        center.lat,
        center.lng,
        loadedListCenterRef.current.latitude,
        loadedListCenterRef.current.longitude,
      ) >= MAP_DEFAULTS.listResortDistanceMetres;

    if (placeSetChanged || centerMoved || metaChanged) {
      visiblePlacesRef.current = listSource;
      loadedListCenterRef.current = meta.center;
      lastNotifiedViewportCountRef.current = meta.viewportCount ?? null;
      lastNotifiedTruncatedRef.current = meta.truncated ?? false;
      onPlacesLoadedRef.current?.(listSource, {
        ...meta,
        resetListPage: placeSetChanged,
      });
    }
  }, []);

  const cityFiltersKey = (activeFilters: MapFilters) =>
    `${activeFilters.multiplier}:${activeFilters.category}`;

  const fetchViewportDetails = useCallback(async (
    map: maplibregl.Map,
    options: {
      bounds: ViewportBounds;
      gridTruncated: boolean;
      filtersKey: string;
      animate?: boolean;
    },
  ) => {
    const { bounds, gridTruncated, filtersKey, animate } = options;
    const zoom = map.getZoom();
    const center = map.getCenter();
    const inViewListEnabled = isCityLevelZoom(zoom);

    if (inViewListEnabled && !gridTruncated) return;

    viewportAbortRef.current?.abort();
    const controller = new AbortController();
    viewportAbortRef.current = controller;
    const requestId = ++viewportRequestIdRef.current;

    const activeFilters = filtersRef.current;
    if (cityFiltersKey(activeFilters) !== filtersKey) return;

    const params = new URLSearchParams({
      viewNorth: bounds.north.toString(),
      viewSouth: bounds.south.toString(),
      viewEast: bounds.east.toString(),
      viewWest: bounds.west.toString(),
      zoom: Math.floor(zoom).toString(),
      latitude: center.lat.toString(),
      longitude: center.lng.toString(),
      gridTruncated: gridTruncated.toString(),
    });
    if (activeFilters.multiplier) {
      params.set("multiplier", activeFilters.multiplier.toString());
    }
    if (activeFilters.category) params.set("category", activeFilters.category);

    try {
      const res = await fetch(`/api/places/viewport?${params}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json();

      if (requestId !== viewportRequestIdRef.current) return;
      if (cityFiltersKey(filtersRef.current) !== filtersKey) return;

      if (inViewListEnabled) {
        loadedViewportCountRef.current = data.viewportCount ?? null;
        loadedViewportTruncatedRef.current =
          data.viewportCount != null &&
          (data.listPlaces?.length ?? 0) < data.viewportCount;
        loadedListBoundsRef.current = bounds;
        listPlacesRef.current = Array.isArray(data.listPlaces)
          ? data.listPlaces
          : null;
        if (data.listPlaces?.length) {
          placesRef.current = mergePlacesById(
            placesRef.current,
            data.listPlaces,
          );
        }
        syncVisiblePlaces(map, { animate: animate ?? false });
        return;
      }

      loadedCitySummaryRef.current = data.citySummary ?? null;
      setAreaOverlay({
        summary: data.citySummary ?? { count: placesRef.current.length },
        truncated: gridTruncated,
      });
      onPlacesLoadedRef.current?.([], {
        center: { latitude: center.lat, longitude: center.lng },
        zoom,
        inViewListEnabled: false,
        citySummary: data.citySummary ?? null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      if (viewportAbortRef.current === controller) {
        viewportAbortRef.current = null;
      }
    }
  }, [syncVisiblePlaces]);

  useEffect(() => {
    syncVisiblePlacesRef.current = syncVisiblePlaces;
  }, [syncVisiblePlaces]);

  const scheduleLocalSync = useCallback((map: maplibregl.Map) => {
    const filtersKey = cityFiltersKey(filtersRef.current);
    if (!isCityLevelZoom(map.getZoom())) return;
    if (loadedInViewListEnabledRef.current !== true) return;
    if (!loadedFetchBoundsRef.current) return;
    if (loadedCityFiltersRef.current !== filtersKey) return;
    if (localSyncTimerRef.current != null) return;

    localSyncTimerRef.current = setTimeout(() => {
      localSyncTimerRef.current = null;
      if (localSyncRafRef.current != null) return;
      localSyncRafRef.current = requestAnimationFrame(() => {
        localSyncRafRef.current = null;
        syncVisiblePlacesRef.current(map, { animate: false });
      });
    }, MAP_DEFAULTS.mapLocalSyncThrottleMs);
  }, []);

  const fetchPlaces = useCallback(async (
    map: maplibregl.Map,
    options: { animate?: boolean; force?: boolean } = {},
  ) => {
    const shouldAnimate = options.animate ?? animateNextFetchRef.current;
    animateNextFetchRef.current = false;

    const currentBounds = getMapViewportBounds(map);
    const center = map.getCenter();
    const zoom = map.getZoom();
    const activeFilters = filtersRef.current;
    const filtersKey = cityFiltersKey(activeFilters);
    const inViewListEnabled = isCityLevelZoom(zoom);
    const meta: MapViewportMeta = {
      center: { latitude: center.lat, longitude: center.lng },
      zoom,
      inViewListEnabled,
    };

    if (!isInCanada(center.lat, center.lng)) {
      if (
        !options.force &&
        loadedOutOfAreaRef.current &&
        loadedCityFiltersRef.current === filtersKey
      ) {
        setOutOfArea(true);
        setAreaOverlay(null);
        onPlacesLoadedRef.current?.([], { ...meta, inViewListEnabled: false, outOfArea: true });
        return;
      }

      fetchAbortRef.current?.abort();
      loadedOutOfAreaRef.current = true;
      loadedCitySummaryRef.current = null;
      loadedFetchBoundsRef.current = null;
      loadedCityFiltersRef.current = filtersKey;
      setOutOfArea(true);
      setAreaOverlay(null);
      setError(null);

      const previousPlaces = placesRef.current;
      placesRef.current = [];
      visiblePlacesRef.current = [];
      updatePlacesSource(
        map,
        [],
        { latitude: center.lat, longitude: center.lng },
        previousPlaces,
        false,
      );
      onPlacesLoadedRef.current?.([], { ...meta, inViewListEnabled: false, outOfArea: true });
      return;
    }

    loadedOutOfAreaRef.current = false;
    setOutOfArea(false);

    if (
      inViewListEnabled &&
      !options.force &&
      loadedInViewListEnabledRef.current === true &&
      loadedFetchBoundsRef.current &&
      boundsContains(loadedFetchBoundsRef.current, currentBounds) &&
      loadedCityFiltersRef.current === filtersKey
    ) {
      syncVisiblePlaces(map, { animate: shouldAnimate });
      return;
    }

    fetchAbortRef.current?.abort();
    viewportAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const aligned = alignViewportToGrid({
      ...currentBounds,
      zoom,
    });

    const params = new URLSearchParams({
      north: aligned.north.toString(),
      south: aligned.south.toString(),
      east: aligned.east.toString(),
      west: aligned.west.toString(),
      zoom: aligned.zoom.toString(),
    });

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
      setError(null);
      const previousPlaces = placesRef.current;
      const responsePlaces: MapPlace[] = data.places ?? [];
      const gridTruncated = data.truncated ?? false;

      loadedFetchBoundsRef.current = {
        north: aligned.north,
        south: aligned.south,
        east: aligned.east,
        west: aligned.west,
      };
      loadedCityFiltersRef.current = filtersKey;
      loadedGridTruncatedRef.current = gridTruncated;

      if (inViewListEnabled) {
        placesRef.current = responsePlaces;
        loadedInViewListEnabledRef.current = true;
        loadedCitySummaryRef.current = null;
        loadedClusterTruncatedRef.current = false;
        loadedClusterCenterRef.current = null;
        loadedViewportTruncatedRef.current = false;
        loadedViewportCountRef.current = null;
        loadedListBoundsRef.current = currentBounds;
        listPlacesRef.current = null;
        setAreaOverlay(null);
        syncVisiblePlaces(map, { animate: shouldAnimate });

        void fetchViewportDetails(map, {
          bounds: currentBounds,
          gridTruncated,
          filtersKey,
          animate: shouldAnimate,
        });
        return;
      }

      placesRef.current = responsePlaces;
      loadedInViewListEnabledRef.current = false;
      loadedCitySummaryRef.current = null;
      loadedClusterTruncatedRef.current = gridTruncated;
      loadedClusterCenterRef.current = null;
      loadedViewportTruncatedRef.current = false;
      loadedViewportCountRef.current = null;
      loadedListBoundsRef.current = null;
      listPlacesRef.current = null;
      loadedListCenterRef.current = null;
      visiblePlacesRef.current = [];
      setAreaOverlay({
        summary: { count: responsePlaces.length },
        truncated: gridTruncated,
      });

      updatePlacesSource(
        map,
        placesRef.current,
        { latitude: center.lat, longitude: center.lng },
        previousPlaces,
        shouldAnimate,
      );
      onPlacesLoadedRef.current?.([], {
        ...meta,
        inViewListEnabled: false,
        citySummary: null,
      });

      void fetchViewportDetails(map, {
        bounds: currentBounds,
        gridTruncated,
        filtersKey,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Could not load merchant data");
      setAreaOverlay(null);
      loadedFetchBoundsRef.current = null;
      loadedInViewListEnabledRef.current = null;
      loadedCitySummaryRef.current = null;
      loadedClusterTruncatedRef.current = false;
      loadedViewportTruncatedRef.current = false;
      loadedViewportCountRef.current = null;
      loadedListBoundsRef.current = null;
      listPlacesRef.current = null;
      loadedListCenterRef.current = null;
      const stalePlaces = placesRef.current;
      placesRef.current = [];
      visiblePlacesRef.current = [];
      mapDisplayedRef.current = [];
      updatePlacesSource(map, [], meta.center, stalePlaces, false);
      onPlacesLoadedRef.current?.([], {
        ...meta,
        citySummary: null,
        truncated: false,
        viewportCount: null,
      });
    } finally {
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [syncVisiblePlaces, fetchViewportDetails]);

  useEffect(() => {
    fetchPlacesRef.current = fetchPlaces;
  }, [fetchPlaces]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const container = containerRef.current;
    const map = new maplibregl.Map({
      container,
      style: getMapStyleUrl(),
      center: [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude],
      zoom: MAP_DEFAULTS.defaultZoom,
    });

    const scheduleViewportSync = (targetMap: maplibregl.Map) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => void fetchPlacesRef.current(targetMap),
        MAP_DEFAULTS.mapFetchDebounceMs,
      );
    };
    scheduleViewportSyncRef.current = scheduleViewportSync;

    const handleMove = () => scheduleLocalSync(map);

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
      void fetchPlacesRef.current(map, { animate: true });
    });

    map.on("error", (event) => {
      console.error("MapLibre error:", event.error);
      setError("Could not load map tiles");
    });

    map.on("move", handleMove);

    map.on("moveend", () => {
      if (programmaticMoveRef.current) return;
      scheduleViewportSync(map);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      scheduleViewportSync(map);
    });
    resizeObserver.observe(container);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      fetchAbortRef.current?.abort();
      viewportAbortRef.current?.abort();
      if (programmaticMoveTimerRef.current != null) {
        clearTimeout(programmaticMoveTimerRef.current);
        programmaticMoveTimerRef.current = null;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (localSyncRafRef.current != null) {
        cancelAnimationFrame(localSyncRafRef.current);
        localSyncRafRef.current = null;
      }
      if (localSyncTimerRef.current != null) {
        clearTimeout(localSyncTimerRef.current);
        localSyncTimerRef.current = null;
      }
      const popup = popupRef.current;
      popup?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      scheduleViewportSyncRef.current = () => {};
    };
  }, [scheduleLocalSync]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    loadedFetchBoundsRef.current = null;
    loadedInViewListEnabledRef.current = null;
    visiblePlacesRef.current = [];
    lastNotifiedViewportCountRef.current = null;
    lastNotifiedTruncatedRef.current = false;
    mapDisplayedRef.current = [];
    loadedCitySummaryRef.current = null;
    loadedClusterCenterRef.current = null;
    loadedViewportTruncatedRef.current = false;
    loadedViewportCountRef.current = null;
    loadedListBoundsRef.current = null;
    listPlacesRef.current = null;
    loadedListCenterRef.current = null;
    loadedCityFiltersRef.current = "";
    loadedOutOfAreaRef.current = false;
    setOutOfArea(false);
    setAreaOverlay(null);
    animateNextFetchRef.current = true;
    void fetchPlaces(map, { animate: true, force: true });
  }, [filters, fetchPlaces]);

  useEffect(() => {
    const map = mapRef.current;
    if (!selectedPlace) {
      selectedPlaceIdRef.current = null;
      return;
    }
    if (!map) return;

    if (selectedPlaceIdRef.current === selectedPlace.id) {
      showPlacePopup(map, selectedPlace, popupRef);
      return;
    }
    selectedPlaceIdRef.current = selectedPlace.id;

    const mapCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const placeInView = map
      .getBounds()
      .contains([selectedPlace.longitude, selectedPlace.latitude]);
    const distanceToPlace = distanceMetres(
      mapCenter.lat,
      mapCenter.lng,
      selectedPlace.latitude,
      selectedPlace.longitude,
    );

    showPlacePopup(map, selectedPlace, popupRef);

    if (placeInView && distanceToPlace <= 75 && currentZoom >= 15) {
      return;
    }

    const needsMove =
      !placeInView || distanceToPlace > 75 || currentZoom < 15;
    if (!needsMove) return;

    const from = { latitude: mapCenter.lat, longitude: mapCenter.lng };
    const to = {
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
    };
    const duration = getFlyDurationMs(from, to, distanceToPlace);
    programmaticMoveRef.current = true;
    if (programmaticMoveTimerRef.current != null) {
      clearTimeout(programmaticMoveTimerRef.current);
    }
    programmaticMoveTimerRef.current = setTimeout(() => {
      programmaticMoveRef.current = false;
      programmaticMoveTimerRef.current = null;
    }, duration + 100);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (selectedPlaceIdRef.current !== selectedPlace.id) return;
        easeToLocation(map, from, to, { targetZoom: 15 });
      });
    });
  }, [selectedPlace]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-xl" />
      {loading && (
        <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-1.5 text-sm shadow dark:bg-zinc-900/90">
          Loading…
        </div>
      )}
      {!loading && outOfArea && (
        <div className="absolute bottom-3 left-3 max-w-[min(20rem,calc(100%-6rem))] rounded-lg bg-white/95 px-3 py-2 text-sm shadow dark:bg-zinc-900/95">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            No merchant data in this area
          </p>
          <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
            Pan to Canada to see merchants
          </p>
        </div>
      )}
      {!loading && !outOfArea && areaOverlay && (
        <div className="absolute bottom-3 left-3 max-w-[min(20rem,calc(100%-6rem))] rounded-lg bg-white/95 px-3 py-2 text-sm shadow dark:bg-zinc-900/95">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {areaOverlay.truncated
              ? `${MAP_DEFAULTS.cityMapClusterLimit}+ merchants in ${areaOverlay.summary.city ?? "this area"}`
              : areaOverlay.summary.city
                ? `${areaOverlay.summary.count.toLocaleString()} merchants in ${areaOverlay.summary.city}`
                : `${areaOverlay.summary.count.toLocaleString()} merchants in this area`}
          </p>
          <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
            Tap a cluster or zoom in to browse
          </p>
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
              if (map) {
                void fetchPlaces(map, { force: true });
              }
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
