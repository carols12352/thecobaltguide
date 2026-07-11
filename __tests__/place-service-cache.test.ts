import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MapPlace, PlaceDetail } from "@/types/domain";

const cacheMocks = vi.hoisted(() => ({
  getCachedMapPlaces: vi.fn(),
  setCachedMapPlaces: vi.fn(),
  getCachedPlace: vi.fn(),
  setCachedPlace: vi.fn(),
  getCachedSearch: vi.fn(),
  setCachedSearch: vi.fn(),
  invalidatePlaceReadCaches: vi.fn(),
}));

vi.mock("@/lib/cache/place-cache", () => cacheMocks);

const repoMocks = vi.hoisted(() => ({
  findInViewport: vi.fn(),
  findById: vi.fn(),
  search: vi.fn(),
  create: vi.fn(),
  findPossibleDuplicates: vi.fn(),
}));

vi.mock("@/server/repositories/place-repository", () => ({
  placeRepository: repoMocks,
}));

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
    cacheMocks.getCachedPlace.mockResolvedValue(null);
    cacheMocks.getCachedSearch.mockResolvedValue(null);
    repoMocks.findPossibleDuplicates.mockResolvedValue([]);
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
    });

    expect(repoMocks.findInViewport).toHaveBeenCalledOnce();
    expect(cacheMocks.setCachedMapPlaces).toHaveBeenCalledOnce();
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
  });
});
