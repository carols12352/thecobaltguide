import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeMerchantName } from "@/lib/utils";
import { placeCardRepository } from "@/server/repositories/place-card-repository";
import { projectMapPlace, projectPlaceDetail } from "@/server/repositories/place-projections";
import type { MapPlace, PlaceDetail } from "@/types/domain";

export type SitemapPlaceRow = {
  id: string;
  updated_at: string;
  place_multiplier_summaries:
    | { updated_at: string }[]
    | { updated_at: string }
    | null;
};

const SITEMAP_PAGE_SIZE = 1_000;

export async function collectSitemapPages(
  fetchPage: (afterId: string | null) => Promise<SitemapPlaceRow[]>,
): Promise<SitemapPlaceRow[]> {
  const places: SitemapPlaceRow[] = [];
  let afterId: string | null = null;

  while (true) {
    const page = await fetchPage(afterId);
    if (page.length === 0) return places;

    const nextAfterId = page.at(-1)?.id;
    if (!nextAfterId || nextAfterId === afterId) {
      throw new Error("Sitemap pagination did not advance");
    }

    places.push(...page);
    afterId = nextAfterId;
  }
}

export function latestSitemapModification(place: SitemapPlaceRow): string {
  const summaries = Array.isArray(place.place_multiplier_summaries)
    ? place.place_multiplier_summaries
    : place.place_multiplier_summaries
      ? [place.place_multiplier_summaries]
      : [];

  return summaries.reduce(
    (latest, summary) =>
      new Date(summary.updated_at).getTime() > new Date(latest).getTime()
        ? summary.updated_at
        : latest,
    place.updated_at,
  );
}

export class PublicPlaceRepository {
  async findActiveForSitemap(province: string): Promise<SitemapPlaceRow[]> {
    const supabase = createAdminClient();

    return collectSitemapPages(async (afterId) => {
      let query = supabase
        .from("places")
        .select("id, updated_at, place_multiplier_summaries(updated_at)")
        .eq("status", "active")
        .eq("province", province)
        .order("id", { ascending: true })
        .limit(SITEMAP_PAGE_SIZE);

      if (afterId) query = query.gt("id", afterId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SitemapPlaceRow[];
    });
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
