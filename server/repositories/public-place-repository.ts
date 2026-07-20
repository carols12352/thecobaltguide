import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeMerchantName } from "@/lib/utils";
import { placeCardRepository } from "@/server/repositories/place-card-repository";
import { projectMapPlace, projectPlaceDetail } from "@/server/repositories/place-projections";
import type { MapPlace, PlaceDetail } from "@/types/domain";

export class PublicPlaceRepository {
  async findActiveForSitemap(limit = 10_000) {
    const supabase = createAdminClient();
    const boundedLimit = Math.min(10_000, Math.max(1, limit));
    const { data, error } = await supabase
      .from("places")
      .select("id, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(boundedLimit);
    if (error) throw error;
    return data ?? [];
  }

  async search(query: string, limit = 20): Promise<MapPlace[]> {
    const supabase = await createClient();
    const normalized = normalizeMerchantName(query);
    const { data, error } = await supabase
      .from("places")
      .select(`
        id, name, address_line1, city, province, category, location,
        place_multiplier_summaries (
          current_multiplier, confidence_level,
          recent_report_count, last_reported_at
        )
      `)
      .eq("status", "active")
      .or(`name.ilike.%${query}%,normalized_name.ilike.%${normalized}%`)
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => projectMapPlace(row));
  }

  async findById(id: string): Promise<PlaceDetail | null> {
    const supabase = await createClient();
    const cardProductId = await placeCardRepository.getDefaultCardProductId();
    const { data: place, error } = await supabase
      .from("places")
      .select("*, merchant_brands ( name )")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!place) return null;

    const { data: summary } = await supabase
      .from("place_multiplier_summaries")
      .select("*")
      .eq("place_id", id)
      .eq("card_product_id", cardProductId)
      .maybeSingle();
    return projectPlaceDetail(place, summary);
  }
}

export const publicPlaceRepository = new PublicPlaceRepository();
