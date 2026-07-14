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
import { MAP_DEFAULTS } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { MapCitySummary, MapPlace } from "@/types/domain";
import type { MapViewportMeta } from "@/components/map/merchant-map";

const HOME_LIST_PAGE_SIZE = 10;

const MerchantMap = dynamic(
  () =>
    import("@/components/map/merchant-map").then((m) => m.MerchantMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800" aria-live="polite">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 via-zinc-50 to-cobalt-50 dark:from-zinc-900 dark:via-zinc-800 dark:to-cobalt-950/20" />
      <p className="relative text-sm font-medium text-zinc-500">Loading map…</p>
    </div>
  );
}

export default function MapPage() {
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
  const [mapInViewEnabled, setMapInViewEnabled] = useState(true);
  const [outOfArea, setOutOfArea] = useState(false);
  const [citySummary, setCitySummary] = useState<MapCitySummary | null>(null);
  const [listTruncated, setListTruncated] = useState(false);
  const [viewportCount, setViewportCount] = useState<number | null>(null);
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
      setMapInViewEnabled(meta.inViewListEnabled);
      setOutOfArea(meta.outOfArea ?? false);
      setCitySummary(meta.citySummary ?? null);
      setListTruncated(meta.truncated ?? false);
      setViewportCount(meta.viewportCount ?? null);
      setViewportPlaces(sortPlacesByDistance(places, meta.center));
      if (meta.resetListPage !== false) {
        setListPage(1);
      }
    },
    [],
  );

  function formatCityListLabel(summary: MapCitySummary): string {
    return summary.city
      ? `${summary.count.toLocaleString()} in ${summary.city}`
      : `${summary.count.toLocaleString()} merchants in view`;
  }

  function formatInViewListLabel(
    visibleCount: number,
    truncated: boolean,
    totalCount: number | null,
  ): string {
    if (truncated && totalCount != null && totalCount > visibleCount) {
      return `${totalCount.toLocaleString()} places in view`;
    }
    if (truncated) {
      return `${MAP_DEFAULTS.maxResults}+ places in view`;
    }
    return `${visibleCount.toLocaleString()} places in view`;
  }

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
    <section aria-labelledby="map-heading" className="flex min-h-[calc(100svh-4rem)] flex-col bg-white dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-zinc-50/80 px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase dark:text-cobalt-300">Live guide</p>
            <h1 id="map-heading" className="mt-1 text-2xl font-semibold tracking-tight">Find rewarding places near you</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Community-sourced Amex Cobalt multiplier data across Canada.
            </p>
          </div>
          <form onSubmit={handleSearch} role="search" className="flex w-full gap-2 sm:w-auto">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchants…"
              aria-label="Search merchants"
              className="min-w-0 flex-1 sm:w-64"
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
          <p role="alert" className="mx-auto mt-2 max-w-7xl text-sm text-red-600">{searchError}</p>
        )}
        <div className="mx-auto mt-4 max-w-7xl">
          <MapFiltersBar filters={filters} onChange={setFilters} />
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6 lg:flex-row">
        <div
          className={cn(
            "relative h-[55vh] min-w-0 lg:h-[calc(100svh-13rem)]",
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
              : isSearchMode || mapInViewEnabled
                ? formatInViewListLabel(
                    listPlaces.length,
                    listTruncated,
                    viewportCount,
                  )
                : outOfArea
                  ? "Outside Canada"
                  : citySummary
                    ? formatCityListLabel(citySummary)
                    : "Zoom in to see places"}
          </Button>
        </div>

        <aside
          style={splitLayout ? { width: listWidthPx } : undefined}
          className={cn(
            "flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden",
            splitLayout
              ? "shrink-0 lg:h-[calc(100svh-13rem)]"
              : "w-full max-h-[45vh]",
            listOpen ? "flex" : "hidden lg:flex",
          )}
        >
          <h2 className="shrink-0 text-sm font-semibold text-zinc-500">
            {isSearchMode
              ? `${listPlaces.length} search results`
              : mapInViewEnabled
                ? formatInViewListLabel(
                    listPlaces.length,
                    listTruncated,
                    viewportCount,
                  )
                : outOfArea
                  ? "Outside Canada"
                  : citySummary
                    ? formatCityListLabel(citySummary)
                    : "Zoom in to browse merchants"}
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
            {!isSearchMode && mapInViewEnabled && listTruncated ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {viewportCount != null && viewportCount > listPlaces.length
                  ? `${viewportCount.toLocaleString()} merchants in this view. Showing ${listPlaces.length}. Zoom in for full results.`
                  : "Showing a limited set of merchants in this area. Zoom in for full results."}
              </p>
            ) : null}
            {!isSearchMode && outOfArea ? (
              <p className="text-sm text-zinc-500">
                Merchant data covers Canada. Pan the map back to see merchants.
              </p>
            ) : null}
            {!isSearchMode && !mapInViewEnabled && !outOfArea && citySummary ? (
              <p className="text-sm text-zinc-500">
                {citySummary.count.toLocaleString()} merchants in this view.
                Zoom in to browse the list.
              </p>
            ) : null}
            {!isSearchMode && !mapInViewEnabled && !outOfArea && !citySummary ? (
              <p className="text-sm text-zinc-500">
                Zoom in on the map to browse merchants in this area.
              </p>
            ) : null}
            {listPlaces.length === 0 && (isSearchMode || mapInViewEnabled) && (
              <p className="text-sm text-zinc-500">
                {isSearchMode
                  ? "No merchants match your search."
                  : "Move the map or adjust filters to see merchants."}
              </p>
            )}
          </div>

          {mapInViewEnabled && listPlaces.length > HOME_LIST_PAGE_SIZE ? (
            <PaginationBar
              compact
              availableWidth={listWidthPx}
              page={currentListPage}
              total={listPlaces.length}
              pageSize={HOME_LIST_PAGE_SIZE}
              itemLabel="places"
              onPageChange={setListPage}
              className="shrink-0 min-w-0"
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}
