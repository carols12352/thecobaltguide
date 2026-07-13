"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapStyleUrl } from "@/lib/map/config";
import { easeToLocation } from "@/lib/map/place-animation";
import { registerPoiIconFallback } from "@/lib/map/poi-icon-fallback";

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
  readOnly?: boolean;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  readOnly = false,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const previousCoordsRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(),
      center: [longitude, latitude],
      zoom: 16,
    });

    registerPoiIconFallback(map);

    const marker = new maplibregl.Marker({ draggable: !readOnly })
      .setLngLat([longitude, latitude])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      onChangeRef.current(lngLat.lat, lngLat.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Map initializes once; coordinate updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    marker.setLngLat([longitude, latitude]);

    const previous = previousCoordsRef.current;
    previousCoordsRef.current = { latitude, longitude };

    if (!previous) {
      map.jumpTo({ center: [longitude, latitude], zoom: 16 });
      return;
    }

    if (
      previous.latitude === latitude &&
      previous.longitude === longitude
    ) {
      return;
    }

    easeToLocation(
      map,
      previous,
      { latitude, longitude },
      { targetZoom: 16 },
    );
  }, [latitude, longitude]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700"
      />
      <p className="text-xs text-zinc-500">
        {readOnly
          ? "Exact map pin location (moderator view)."
          : "Drag the pin if the location needs adjustment."}
      </p>
    </div>
  );
}
