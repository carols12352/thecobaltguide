"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapFiltersBar, type MapFilters } from "@/components/filters/map-filters";
import { PlaceCard } from "@/components/places/place-card";
import { sortPlacesByDistance } from "@/lib/map/distance";
import { cn } from "@/lib/utils";
import type { MapPlace } from "@/types/domain";
import type { MapViewportMeta } from "@/components/map/merchant-map";

const MerchantMap = dynamic(
  () =>
    import("@/components/map/merchant-map").then((m) => m.MerchantMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
      <p className="text-zinc-500">Loading map…</p>
    </div>
  );
}

export default function HomePage() {
  const [filters, setFilters] = useState<MapFilters>({
    multiplier: "",
    category: "",
  });
  const [viewportPlaces, setViewportPlaces] = useState<MapPlace[]>([]);
  const [searchResults, setSearchResults] = useState<MapPlace[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);

  const listPlaces = searchResults ?? viewportPlaces;
  const isSearchMode = searchResults !== null;

  const handlePlacesLoaded = useCallback(
    (places: MapPlace[], meta: MapViewportMeta) => {
      setViewportPlaces(sortPlacesByDistance(places, meta.center));
    },
    [],
  );

  function handlePlaceSelect(place: MapPlace) {
    setSelectedPlace(place);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setListOpen(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSelectedPlace(null);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/places/search?q=${encodeURIComponent(searchQuery)}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.places ?? []);
      setSelectedPlace(null);
      setListOpen(true);
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
    setSearchError(null);
    setSelectedPlace(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold">Find 5x Merchants Near You</h1>
            <p className="text-sm text-zinc-600">
              Community-sourced Amex Cobalt multiplier data for the GTA.
            </p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchants…"
              aria-label="Search merchants"
              className="w-64"
            />
            <Button type="submit" disabled={searchLoading}>
              {searchLoading ? "Searching…" : "Search"}
            </Button>
            {isSearchMode && (
              <Button type="button" variant="outline" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </form>
        </div>
        {searchError && (
          <p className="mx-auto mt-2 max-w-7xl text-sm text-red-600">{searchError}</p>
        )}
        <div className="mx-auto mt-4 max-w-7xl">
          <MapFiltersBar filters={filters} onChange={setFilters} />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 lg:flex-row">
        <div className="relative h-[50vh] lg:h-[calc(100vh-12rem)] lg:flex-1">
          <MerchantMap
            filters={filters}
            selectedPlace={selectedPlace}
            onPlaceSelect={handlePlaceSelect}
            onPlacesLoaded={handlePlacesLoaded}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute bottom-3 right-3 z-10 bg-white/95 shadow lg:hidden"
            onClick={() => setListOpen((open) => !open)}
          >
            {listOpen
              ? "Hide list"
              : `${listPlaces.length} places in view`}
          </Button>
        </div>

        <aside
          className={cn(
            "w-full space-y-2 overflow-y-auto lg:w-80 lg:shrink-0",
            "max-h-[45vh] lg:max-h-[calc(100vh-12rem)]",
            listOpen ? "block" : "hidden lg:block",
          )}
        >
          <h2 className="text-sm font-semibold text-zinc-500">
            {isSearchMode
              ? `${listPlaces.length} search results`
              : `${listPlaces.length} places in view`}
          </h2>
          {listPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              selected={place.id === selectedPlace?.id}
              onSelect={handlePlaceSelect}
            />
          ))}
          {listPlaces.length === 0 && (
            <p className="text-sm text-zinc-500">
              {isSearchMode
                ? "No merchants match your search."
                : "Move the map or adjust filters to see merchants."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
