import { MAP_DEFAULTS } from "@/config/constants";
import {
  getCachedMapPlaces,
  getCachedPlace,
  getCachedSearch,
  invalidatePlaceReadCaches,
  setCachedMapPlaces,
  setCachedPlace,
  setCachedSearch,
} from "@/lib/cache/place-cache";
import { placeRepository } from "@/server/repositories/place-repository";
import type { CreatePlaceInput } from "@/server/validation/schemas";
import type { MapPlace } from "@/types/domain";

export class PlaceService {
  async getMapPlaces(params: {
    north: number;
    south: number;
    east: number;
    west: number;
    zoom?: number;
    multiplier?: number;
    category?: string;
  }): Promise<{ places: MapPlace[]; truncated: boolean }> {
    const cached = await getCachedMapPlaces(params);
    if (cached) return cached;

    const limit = MAP_DEFAULTS.maxResults;
    const places = await placeRepository.findInViewport({
      ...params,
      limit: limit + 1,
    });

    const truncated = places.length > limit;
    const result = {
      places: truncated ? places.slice(0, limit) : places,
      truncated,
    };

    await setCachedMapPlaces(params, result);
    return result;
  }

  async searchPlaces(query: string, limit = 20) {
    const cached = await getCachedSearch(query, limit);
    if (cached) return cached;

    const places = await placeRepository.search(query, limit);
    await setCachedSearch(query, limit, places);
    return places;
  }

  async getPlaceById(id: string) {
    const cached = await getCachedPlace(id);
    if (cached) return cached;

    const place = await placeRepository.findById(id);
    if (place) await setCachedPlace(place);
    return place;
  }

  async createPlace(input: CreatePlaceInput, userId: string) {
    const duplicates = await placeRepository.findPossibleDuplicates(input);
    if (duplicates.length > 0) {
      return {
        created: false as const,
        possibleDuplicates: duplicates,
      };
    }

    const place = await placeRepository.create(input, userId);
    await invalidatePlaceReadCaches(place.id);
    return { created: true as const, place };
  }
}

export const placeService = new PlaceService();
