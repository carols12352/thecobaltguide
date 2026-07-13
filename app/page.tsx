"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { MapFiltersBar, type MapFilters } from "@/components/filters/map-filters";
import { PlaceCard } from "@/components/places/place-card";
import { sortPlacesByDistance } from "@/lib/map/distance";
import {
  getHomeListWidthPx,
  isHomeSplitLayout,
} from "@/lib/layout/home-split";
import { useViewportWidth } from "@/lib/hooks/use-viewport-width";
import { cn } from "@/lib/utils";
import type { MapPlace } from "@/types/domain";
import type { MapViewportMeta } from "@/components/map/merchant-map";

const HOME_LIST_PAGE_SIZE = 10;

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
  const [listPage, setListPage] = useState(1);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const viewportWidth = useViewportWidth();
  const splitLayout = isHomeSplitLayout(viewportWidth);
  const listWidthPx = getHomeListWidthPx(viewportWidth);

  const listPlaces = searchResults ?? viewportPlaces;
  const isSearchMode = searchResults !== null;
  const maxListPage = Math.max(
    1,
    Math.ceil(listPlaces.length / HOME_LIST_PAGE_SIZE),
  );
  const currentListPage = Math.min(listPage, maxListPage);

  const paginatedPlaces = useMemo(() => {
    const start = (currentListPage - 1) * HOME_LIST_PAGE_SIZE;
    return listPlaces.slice(start, start + HOME_LIST_PAGE_SIZE);
  }, [currentListPage, listPlaces]);

  const handlePlacesLoaded = useCallback(
    (places: MapPlace[], meta: MapViewportMeta) => {
      setViewportPlaces(sortPlacesByDistance(places, meta.center));
      setListPage(1);
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
      setListPage(1);
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
      setListPage(1);
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
    setListPage(1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        <div
          className={cn(
            "relative h-[50vh] min-w-0 lg:h-[calc(100vh-12rem)]",
            splitLayout ? "flex-1" : "shrink-0",
          )}
        >
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
          style={splitLayout ? { width: listWidthPx } : undefined}
          className={cn(
            "flex min-h-0 flex-col gap-2 overflow-hidden",
            splitLayout
              ? "shrink-0 lg:h-[calc(100vh-12rem)]"
              : "w-full max-h-[45vh]",
            listOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <h2 className="shrink-0 text-sm font-semibold text-zinc-500">
            {isSearchMode
              ? `${listPlaces.length} search results`
              : `${listPlaces.length} places in view`}
          </h2>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
            {paginatedPlaces.map((place) => (
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
          </div>

          {listPlaces.length > HOME_LIST_PAGE_SIZE ? (
            <PaginationBar
              compact
              page={currentListPage}
              total={listPlaces.length}
              pageSize={HOME_LIST_PAGE_SIZE}
              itemLabel="places"
              onPageChange={setListPage}
              className="shrink-0"
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
