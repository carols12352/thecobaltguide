import { MAP_DEFAULTS } from "@/config/constants";
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
    const limit = MAP_DEFAULTS.maxResults;
    const places = await placeRepository.findInViewport({
      ...params,
      limit: limit + 1,
    });

    const truncated = places.length > limit;
    return {
      places: truncated ? places.slice(0, limit) : places,
      truncated,
    };
  }

  async searchPlaces(query: string, limit = 20) {
    return placeRepository.search(query, limit);
  }

  async getPlaceById(id: string) {
    return placeRepository.findById(id);
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
    return { created: true as const, place };
  }
}

export const placeService = new PlaceService();
