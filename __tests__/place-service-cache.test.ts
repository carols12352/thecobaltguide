import { beforeEach, describe, expect, it, vi } from "vitest";
import { alignViewportToGrid, mapViewportFromQuery } from "@/lib/map/viewport-grid";
import { ServerTiming } from "@/lib/api/server-timing";
import type { MapPlace, PlaceDetail } from "@/types/domain";

const cacheMocks = vi.hoisted(() => ({
  getCachedMapPlaces: vi.fn(),
  setCachedMapPlaces: vi.fn(),
  getCachedViewportDetails: vi.fn(),
  setCachedViewportDetails: vi.fn(),
  getCachedCityMap: vi.fn(),
  setCachedCityMap: vi.fn(),
  getCachedCityResolve: vi.fn(),
  setCachedCityResolve: vi.fn(),
  getCachedPlace: vi.fn(),
  setCachedPlace: vi.fn(),
  getCachedSearch: vi.fn(),
  setCachedSearch: vi.fn(),
  invalidatePlaceReadCaches: vi.fn(),
}));

vi.mock("@/lib/cache/place-cache", () => cacheMocks);

const repoMocks = vi.hoisted(() => ({
  findInViewport: vi.fn(),
  findInViewNear: vi.fn(),
  countInViewport: vi.fn(),
  findInCity: vi.fn(),
  resolveCityNearPoint: vi.fn(),
  getDefaultCardProductId: vi.fn(),
  countInCity: vi.fn(),
  findById: vi.fn(),
  search: vi.fn(),
  create: vi.fn(),
  findPossibleDuplicates: vi.fn(),
}));

vi.mock("@/server/repositories/place-repository", () => ({
  placeRepository: repoMocks,
}));

const googlePlacesMocks = vi.hoisted(() => ({
  findGooglePlaceId: vi.fn(),
}));

vi.mock("@/server/geocoding/google-places", () => googlePlacesMocks);

import { placeService } from "@/server/services/place-service";

const samplePlace = {
  id: "place-1",
  name: "Test Cafe",
} as PlaceDetail;

const sampleMapPlace = {
  id: "place-1",
  name: "Test Cafe",
} as MapPlace;

describe("placeService cache integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.getCachedMapPlaces.mockResolvedValue(null);
    cacheMocks.getCachedViewportDetails.mockResolvedValue(null);
    cacheMocks.getCachedCityMap.mockResolvedValue(null);
    cacheMocks.getCachedCityResolve.mockResolvedValue(null);
    cacheMocks.getCachedPlace.mockResolvedValue(null);
    cacheMocks.getCachedSearch.mockResolvedValue(null);
    repoMocks.findPossibleDuplicates.mockResolvedValue([]);
    googlePlacesMocks.findGooglePlaceId.mockResolvedValue("google-place-1");
    repoMocks.getDefaultCardProductId.mockResolvedValue("card-1");
  });

  it("returns cached map places without hitting the repository", async () => {
    cacheMocks.getCachedMapPlaces.mockResolvedValue({
      places: [sampleMapPlace],
      truncated: false,
    });

    const result = await placeService.getMapPlaces({
      north: 43.7,
      south: 43.6,
      east: -79.3,
      west: -79.4,
    });

    expect(result.places).toHaveLength(1);
    expect(repoMocks.findInViewport).not.toHaveBeenCalled();
    expect(cacheMocks.setCachedMapPlaces).not.toHaveBeenCalled();
  });

  it("loads map places from db then writes cache on miss", async () => {
    repoMocks.findInViewport.mockResolvedValue([sampleMapPlace]);

    await placeService.getMapPlaces({
      north: 43.7,
      south: 43.6,
      east: -79.3,
      west: -79.4,
      zoom: 13,
    });

    expect(repoMocks.findInViewport).toHaveBeenCalledOnce();
    expect(repoMocks.countInViewport).not.toHaveBeenCalled();
    expect(cacheMocks.setCachedMapPlaces).toHaveBeenCalledOnce();
  });

  it("returns viewport count and an in-view list when grid results truncate", async () => {
    const gridPlaces = Array.from({ length: 201 }, (_, index) => ({
      ...sampleMapPlace,
      id: `place-${index}`,
    }));
    repoMocks.findInViewport.mockResolvedValueOnce(gridPlaces);
    repoMocks.countInViewport.mockResolvedValue(342);
    repoMocks.findInViewNear.mockResolvedValue([sampleMapPlace]);

    const mapResult = await placeService.getMapPlaces({
      north: 43.7,
      south: 43.6,
      east: -79.3,
      west: -79.4,
      zoom: 13,
    });

    expect(mapResult.truncated).toBe(true);
    expect(mapResult.places).toHaveLength(200);

    const details = await placeService.getViewportDetails({
      viewNorth: 43.69,
      viewSouth: 43.61,
      viewEast: -79.31,
      viewWest: -79.39,
      zoom: 13,
      latitude: 43.65,
      longitude: -79.35,
      gridTruncated: true,
    });

    expect(details.viewportCount).toBe(342);
    expect(details.listPlaces).toEqual([sampleMapPlace]);
    expect(repoMocks.findInViewport).toHaveBeenCalledOnce();
    expect(repoMocks.countInViewport).toHaveBeenCalledOnce();
    expect(repoMocks.findInViewNear).toHaveBeenCalledOnce();
  });

  it("skips viewport details when the in-view grid is not truncated", async () => {
    const result = await placeService.getViewportDetails({
      viewNorth: 43.69,
      viewSouth: 43.61,
      viewEast: -79.31,
      viewWest: -79.39,
      zoom: 13,
      gridTruncated: false,
    });

    expect(result).toEqual({
      viewportCount: null,
      listPlaces: null,
      citySummary: null,
    });
    expect(repoMocks.countInViewport).not.toHaveBeenCalled();
    expect(repoMocks.findInViewNear).not.toHaveBeenCalled();
  });

  it("returns cached wide-viewport count from viewport details", async () => {
    cacheMocks.getCachedViewportDetails.mockResolvedValue({
      viewportCount: 128,
      listPlaces: null,
      citySummary: { count: 128 },
    });

    const result = await placeService.getViewportDetails({
      viewNorth: 45.8,
      viewSouth: 43.2,
      viewEast: -73.2,
      viewWest: -79.8,
      zoom: 10,
    });

    expect(result).toEqual({
      viewportCount: 128,
      listPlaces: null,
      citySummary: { count: 128 },
    });
    expect(repoMocks.countInViewport).not.toHaveBeenCalled();
  });

  it("queries the entire normalized viewport when zoomed out", async () => {
    repoMocks.findInViewport.mockResolvedValue([sampleMapPlace]);
    repoMocks.countInViewport.mockResolvedValue(128);

    await placeService.getMapPlaces({
      north: 46,
      south: 43,
      east: -73,
      west: -80,
      zoom: 10,
    });

    expect(repoMocks.findInViewport).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 501 }),
    );
    expect(repoMocks.findInCity).not.toHaveBeenCalled();
    expect(repoMocks.resolveCityNearPoint).not.toHaveBeenCalled();
    expect(repoMocks.countInViewport).not.toHaveBeenCalled();
    expect(cacheMocks.setCachedMapPlaces).toHaveBeenCalledOnce();
  });

  it("queries the repository with normalized bounds, not raw client input", async () => {
    repoMocks.findInViewport.mockResolvedValue([sampleMapPlace]);

    const params = {
      north: 43.701,
      south: 43.651,
      east: -79.339,
      west: -79.419,
      zoom: 13,
    };

    await placeService.getMapPlaces(params);

    const { bounds, gridKey } = mapViewportFromQuery(params);
    expect(repoMocks.findInViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        north: bounds.north,
        south: bounds.south,
        east: bounds.east,
        west: bounds.west,
      }),
    );
    expect(cacheMocks.setCachedMapPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ gridKey }),
      expect.any(Object),
    );
  });

  it("does not re-pad client-aligned bounds before querying", async () => {
    repoMocks.findInViewport.mockResolvedValue([sampleMapPlace]);

    const aligned = alignViewportToGrid({
      north: 43.6731,
      south: 43.6333,
      east: -79.3441,
      west: -79.4223,
      zoom: 13,
    });

    await placeService.getMapPlaces({
      north: aligned.north,
      south: aligned.south,
      east: aligned.east,
      west: aligned.west,
      zoom: aligned.zoom,
    });

    expect(repoMocks.findInViewport).toHaveBeenCalledWith(
      expect.objectContaining({
        north: aligned.north,
        south: aligned.south,
        east: aligned.east,
        west: aligned.west,
      }),
    );
  });

  it("invalidates cache after creating a place", async () => {
    repoMocks.create.mockResolvedValue(samplePlace);

    await placeService.createPlace(
      {
        name: "Test Cafe",
        addressLine1: "1 Main St",
        city: "Toronto",
        province: "ON",
        postalCode: "M5V 1A1",
        countryCode: "CA",
        latitude: 43.65,
        longitude: -79.38,
        category: "restaurant",
      },
      "user-1",
    );

    expect(cacheMocks.invalidatePlaceReadCaches).toHaveBeenCalledWith("place-1");
    expect(repoMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test Cafe" }),
      "user-1",
      "google-place-1",
    );
  });

  it("records Redis timing for cached search results", async () => {
    cacheMocks.getCachedSearch.mockResolvedValue([sampleMapPlace]);
    const timing = new ServerTiming();

    await placeService.searchPlaces("cafe", 20, timing);

    expect(timing.headerValue()).toMatch(/^redis;dur=/);
    expect(repoMocks.search).not.toHaveBeenCalled();
  });

  it("records database and cache-write timing for search misses", async () => {
    repoMocks.search.mockResolvedValue([sampleMapPlace]);
    const timing = new ServerTiming();

    await placeService.searchPlaces("cafe", 20, timing);

    expect(timing.headerValue()).toMatch(/redis;dur=.*db;dur=.*redis-write;dur=/);
    expect(cacheMocks.setCachedSearch).toHaveBeenCalledOnce();
  });
});
