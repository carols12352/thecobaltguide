import { confidenceScoreForAdminLevel } from "@/server/services/aggregation";
import { adminPlaceQueryRepository } from "@/server/repositories/admin-place-query-repository";
import { placeCardRepository } from "@/server/repositories/place-card-repository";
import { publicMapPlaceRepository } from "@/server/repositories/public-map-place-repository";
import { publicPlaceRepository } from "@/server/repositories/public-place-repository";
import { placeWriteRepository } from "@/server/repositories/place-write-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfidenceLevel } from "@/types/domain";
import type { CreatePlaceInput } from "@/server/validation/schemas";

/**
 * Compatibility facade for existing services. Query implementation is owned by
 * the public-map, public detail/search, and admin query repositories.
 */
export class PlaceRepository {
  getDefaultCardProductId = placeCardRepository.getDefaultCardProductId.bind(placeCardRepository);
  findActiveForSitemap = publicPlaceRepository.findActiveForSitemap.bind(publicPlaceRepository);
  findInViewport = publicMapPlaceRepository.findInViewport.bind(publicMapPlaceRepository);
  countInViewport = publicMapPlaceRepository.countInViewport.bind(publicMapPlaceRepository);
  findInViewNear = publicMapPlaceRepository.findInViewNear.bind(publicMapPlaceRepository);
  countInCity = publicMapPlaceRepository.countInCity.bind(publicMapPlaceRepository);
  resolveCityNearPoint = publicMapPlaceRepository.resolveCityNearPoint.bind(publicMapPlaceRepository);
  findInCity = publicMapPlaceRepository.findInCity.bind(publicMapPlaceRepository);
  search = publicPlaceRepository.search.bind(publicPlaceRepository);
  findById = publicPlaceRepository.findById.bind(publicPlaceRepository);
  findReportClassificationMeta = adminPlaceQueryRepository.findReportClassificationMeta.bind(adminPlaceQueryRepository);
  findSummaryMultiplier = adminPlaceQueryRepository.findSummaryMultiplier.bind(adminPlaceQueryRepository);
  findByIdForAdmin = adminPlaceQueryRepository.findByIdForAdmin.bind(adminPlaceQueryRepository);
  searchForAdmin = adminPlaceQueryRepository.searchForAdmin.bind(adminPlaceQueryRepository);

  async create(
    input: CreatePlaceInput,
    userId: string,
    googlePlaceId?: string | null,
  ) {
    return placeWriteRepository.create(input, userId, googlePlaceId);
  }

  async findPossibleDuplicates(input: CreatePlaceInput) {
    return placeWriteRepository.findPossibleDuplicates(input);
  }

  async upsertSummaryForAdmin(
    placeId: string,
    cardProductId: string,
    updates: { confidenceLevel?: string; currentMultiplier?: number },
  ) {
    const supabase = createAdminClient();
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.confidenceLevel) {
      dbUpdates.confidence_level = updates.confidenceLevel;
      dbUpdates.confidence_score = confidenceScoreForAdminLevel(
        updates.confidenceLevel as ConfidenceLevel,
      );
    }
    if (updates.currentMultiplier !== undefined) {
      dbUpdates.current_multiplier = updates.currentMultiplier.toString();
    }

    const { data: existing } = await supabase
      .from("place_multiplier_summaries")
      .select("place_id")
      .eq("place_id", placeId)
      .eq("card_product_id", cardProductId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("place_multiplier_summaries")
        .update(dbUpdates)
        .eq("place_id", placeId)
        .eq("card_product_id", cardProductId)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("place_multiplier_summaries")
      .insert({
        place_id: placeId,
        card_product_id: cardProductId,
        confidence_level: updates.confidenceLevel ?? "insufficient",
        confidence_score: confidenceScoreForAdminLevel(
          (updates.confidenceLevel ?? "insufficient") as ConfidenceLevel,
        ),
        current_multiplier: updates.currentMultiplier?.toString() ?? null,
        ...dbUpdates,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
}

export const placeRepository = new PlaceRepository();
