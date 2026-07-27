import { MAP_DEFAULTS } from "@/config/constants";
import { createClient } from "@/lib/supabase/server";
import { placeCardRepository } from "@/server/repositories/place-card-repository";
import { projectMapPlace, projectViewportPlace } from "@/server/repositories/place-projections";
import type { MapPlace } from "@/types/domain";

type ViewportFilters = {
  north: number;
  south: number;
  east: number;
  west: number;
  cardProductId?: string;
  multiplier?: number;
  category?: string;
};

export class PublicMapPlaceRepository {
  async findInViewport(params: ViewportFilters & { limit?: number }): Promise<MapPlace[]> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await placeCardRepository.getDefaultCardProductId());
    const { data, error } = await supabase.rpc("places_in_viewport", {
      p_north: params.north,
      p_south: params.south,
      p_east: params.east,
      p_west: params.west,
      p_card_product_id: cardId,
      p_multiplier: params.multiplier?.toString() ?? null,
      p_category: params.category ?? null,
      p_limit: params.limit ?? 200,
    });

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(projectViewportPlace);
  }

  async countInViewport(params: ViewportFilters): Promise<number> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await placeCardRepository.getDefaultCardProductId());
    const { data, error } = await supabase.rpc("count_places_in_viewport", {
      p_north: params.north,
      p_south: params.south,
      p_east: params.east,
      p_west: params.west,
      p_card_product_id: cardId,
      p_multiplier: params.multiplier?.toString() ?? null,
      p_category: params.category ?? null,
    });

    if (error) throw error;
    return Number(data ?? 0);
  }

  async findInViewNear(
    params: ViewportFilters & { latitude: number; longitude: number; limit?: number },
  ): Promise<MapPlace[]> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await placeCardRepository.getDefaultCardProductId());
    const { data, error } = await supabase.rpc("places_in_view_near", {
      p_north: params.north,
      p_south: params.south,
      p_east: params.east,
      p_west: params.west,
      p_latitude: params.latitude,
      p_longitude: params.longitude,
      p_card_product_id: cardId,
      p_multiplier: params.multiplier?.toString() ?? null,
      p_category: params.category ?? null,
      p_limit: params.limit ?? MAP_DEFAULTS.maxResults,
    });

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(projectViewportPlace);
  }

  async countInCity(params: {
    city: string;
    province: string;
    cardProductId?: string;
    multiplier?: number;
    category?: string;
  }): Promise<number> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await placeCardRepository.getDefaultCardProductId());

    if (params.multiplier) {
      let query = supabase
        .from("places")
        .select("id, place_multiplier_summaries!inner(current_multiplier)", { count: "exact", head: true })
        .eq("status", "active")
        .eq("city", params.city)
        .eq("province", params.province)
        .eq("place_multiplier_summaries.card_product_id", cardId)
        .eq("place_multiplier_summaries.current_multiplier", params.multiplier.toString());
      if (params.category) query = query.eq("category", params.category);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    }

    let query = supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("city", params.city)
      .eq("province", params.province);
    if (params.category) query = query.eq("category", params.category);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async resolveCityNearPoint(
    latitude: number,
    longitude: number,
    radiusMetres = MAP_DEFAULTS.cityResolveRadiusMetres,
  ): Promise<{ city: string; province: string } | null> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("places_nearby", {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_metres: radiusMetres,
      p_limit: 1,
    });
    if (error) throw error;
    const nearby = data?.[0] as { id?: string } | undefined;
    if (!nearby?.id) return null;

    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("city, province")
      .eq("id", nearby.id)
      .maybeSingle();
    if (placeError) throw placeError;
    if (!place?.city || !place.province) return null;
    return { city: place.city, province: place.province };
  }

  async findInCity(params: {
    city: string;
    province: string;
    cardProductId?: string;
    multiplier?: number;
    category?: string;
    limit?: number;
  }): Promise<MapPlace[]> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await placeCardRepository.getDefaultCardProductId());
    const limit = params.limit ?? MAP_DEFAULTS.cityMapClusterLimit;

    if (params.multiplier) {
      let query = supabase
        .from("places")
        .select(`
          id, name, address_line1, city, province, category, source_kind, location,
          place_multiplier_summaries!inner (
            current_multiplier, confidence_level,
            recent_report_count, last_reported_at
          )
        `)
        .eq("status", "active")
        .eq("city", params.city)
        .eq("province", params.province)
        .eq("place_multiplier_summaries.card_product_id", cardId)
        .eq("place_multiplier_summaries.current_multiplier", params.multiplier.toString())
        .limit(limit);
      if (params.category) query = query.eq("category", params.category);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => projectMapPlace(row));
    }

    let query = supabase
      .from("places")
      .select(`
        id, name, address_line1, city, province, category, source_kind, location,
        place_multiplier_summaries (
          current_multiplier, confidence_level,
          recent_report_count, last_reported_at, card_product_id
        )
      `)
      .eq("status", "active")
      .eq("city", params.city)
      .eq("province", params.province)
      .limit(limit);
    if (params.category) query = query.eq("category", params.category);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => projectMapPlace(row, cardId));
  }
}

export const publicMapPlaceRepository = new PublicMapPlaceRepository();
