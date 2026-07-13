import { MAP_DEFAULTS } from "@/config/constants";
import type { ServerTiming } from "@/lib/api/server-timing";
import {
  getCachedMapPlaces,
  getCachedPlace,
  getCachedSearch,
  getCachedViewportDetails,
  invalidatePlaceReadCaches,
  setCachedMapPlaces,
  setCachedPlace,
  setCachedSearch,
  setCachedViewportDetails,
} from "@/lib/cache/place-cache";
import { invalidateAdminCaches } from "@/lib/cache/admin-cache";
import {
  mapViewportFromQuery,
  viewBoundsGridKey,
  type ViewportBounds,
} from "@/lib/map/viewport-grid";
import { isCityLevelZoom } from "@/lib/map/zoom-threshold";
import { placeRepository } from "@/server/repositories/place-repository";
import type { CreatePlaceInput } from "@/server/validation/schemas";
import type { MapCitySummary, MapPlace } from "@/types/domain";

export class PlaceService {
  /** Grid map points only — fully CDN/Redis cacheable, no viewport count/list. */
  async getMapPlaces(
    params: {
      north: number;
      south: number;
      east: number;
      west: number;
      zoom?: number;
      multiplier?: number;
      category?: string;
    },
    timing?: ServerTiming,
  ): Promise<{
    places: MapPlace[];
    truncated: boolean;
    citySummary?: MapCitySummary | null;
  }> {
    const zoom = Math.floor(params.zoom ?? MAP_DEFAULTS.defaultZoom);
    const { bounds, gridKey } = mapViewportFromQuery({
      north: params.north,
      south: params.south,
      east: params.east,
      west: params.west,
      zoom,
    });

    const cacheParams = {
      gridKey,
      zoom,
      multiplier: params.multiplier,
      category: params.category,
    };

    const cached = timing
      ? await timing.measure("redis", () => getCachedMapPlaces(cacheParams))
      : await getCachedMapPlaces(cacheParams);

    if (cached) {
      return {
        places: cached.places,
        truncated: cached.truncated,
        citySummary: cached.citySummary ?? null,
      };
    }

    const limit = isCityLevelZoom(zoom)
      ? MAP_DEFAULTS.maxResults
      : MAP_DEFAULTS.cityMapClusterLimit;
    const cardProductId = timing
      ? await timing.measure("card", () => placeRepository.getDefaultCardProductId())
      : await placeRepository.getDefaultCardProductId();

    const fetched = timing
      ? await timing.measure("grid", () =>
          placeRepository.findInViewport({
            north: bounds.north,
            south: bounds.south,
            east: bounds.east,
            west: bounds.west,
            cardProductId,
            multiplier: params.multiplier,
            category: params.category,
            limit: limit + 1,
          }),
        )
      : await placeRepository.findInViewport({
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
          cardProductId,
          multiplier: params.multiplier,
          category: params.category,
          limit: limit + 1,
        });

    const truncated = fetched.length > limit;
    const places = truncated ? fetched.slice(0, limit) : fetched;
    const result = {
      places,
      truncated,
      citySummary: null,
    };

    if (timing) {
      await timing.measure("redis-write", () => setCachedMapPlaces(cacheParams, result));
    } else {
      await setCachedMapPlaces(cacheParams, result);
    }

    return result;
  }

  /** Viewport count + optional distance-sorted list — async supplement, short Redis TTL. */
  async getViewportDetails(
    params: {
      viewNorth: number;
      viewSouth: number;
      viewEast: number;
      viewWest: number;
      zoom?: number;
      latitude?: number;
      longitude?: number;
      gridTruncated?: boolean;
      multiplier?: number;
      category?: string;
    },
    timing?: ServerTiming,
  ): Promise<{
    viewportCount: number | null;
    listPlaces: MapPlace[] | null;
    citySummary?: MapCitySummary | null;
  }> {
    const zoom = Math.floor(params.zoom ?? MAP_DEFAULTS.defaultZoom);
    const viewBounds: ViewportBounds = {
      north: params.viewNorth,
      south: params.viewSouth,
      east: params.viewEast,
      west: params.viewWest,
    };
    const viewCenter = {
      latitude:
        params.latitude ?? (viewBounds.north + viewBounds.south) / 2,
      longitude:
        params.longitude ?? (viewBounds.east + viewBounds.west) / 2,
    };
    const inViewList = isCityLevelZoom(zoom);
    const gridTruncated = params.gridTruncated ?? false;

    if (inViewList && !gridTruncated) {
      return { viewportCount: null, listPlaces: null, citySummary: null };
    }

    const viewGridKey = viewBoundsGridKey(viewBounds, zoom);
    const cacheParams = {
      viewGridKey,
      zoom,
      gridTruncated,
      multiplier: params.multiplier,
      category: params.category,
    };

    const cached = timing
      ? await timing.measure("redis", () => getCachedViewportDetails(cacheParams))
      : await getCachedViewportDetails(cacheParams);

    if (cached) {
      return cached;
    }

    const cardProductId = timing
      ? await timing.measure("card", () => placeRepository.getDefaultCardProductId())
      : await placeRepository.getDefaultCardProductId();

    if (inViewList && gridTruncated) {
      const [viewportCount, listPlaces] = timing
        ? await timing.measure("db", () =>
            Promise.all([
              placeRepository.countInViewport({
                ...viewBounds,
                cardProductId,
                multiplier: params.multiplier,
                category: params.category,
              }),
              placeRepository.findInViewNear({
                ...viewBounds,
                latitude: viewCenter.latitude,
                longitude: viewCenter.longitude,
                cardProductId,
                multiplier: params.multiplier,
                category: params.category,
                limit: MAP_DEFAULTS.maxResults,
              }),
            ]),
          )
        : await Promise.all([
            placeRepository.countInViewport({
              ...viewBounds,
              cardProductId,
              multiplier: params.multiplier,
              category: params.category,
            }),
            placeRepository.findInViewNear({
              ...viewBounds,
              latitude: viewCenter.latitude,
              longitude: viewCenter.longitude,
              cardProductId,
              multiplier: params.multiplier,
              category: params.category,
              limit: MAP_DEFAULTS.maxResults,
            }),
          ]);

      const result = { viewportCount, listPlaces, citySummary: null };
      if (timing) {
        await timing.measure("redis-write", () =>
          setCachedViewportDetails(cacheParams, result),
        );
      } else {
        await setCachedViewportDetails(cacheParams, result);
      }
      return result;
    }

    const viewportCount = timing
      ? await timing.measure("count", () =>
          placeRepository.countInViewport({
            ...viewBounds,
            cardProductId,
            multiplier: params.multiplier,
            category: params.category,
          }),
        )
      : await placeRepository.countInViewport({
          ...viewBounds,
          cardProductId,
          multiplier: params.multiplier,
          category: params.category,
        });

    const citySummary: MapCitySummary = { count: viewportCount };
    const result = {
      viewportCount,
      listPlaces: null,
      citySummary,
    };

    if (timing) {
      await timing.measure("redis-write", () =>
        setCachedViewportDetails(cacheParams, result),
      );
    } else {
      await setCachedViewportDetails(cacheParams, result);
    }

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
    await invalidateAdminCaches();
    return { created: true as const, place };
  }
}

export const placeService = new PlaceService();
