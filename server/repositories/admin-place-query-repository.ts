import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCanadianPostalCode } from "@/lib/validation/canadian-postal-code";
import { placeCardRepository } from "@/server/repositories/place-card-repository";
import { projectAdminFlag, projectPlaceDetail } from "@/server/repositories/place-projections";
import type { AdminPlaceDetail, MultiplierValue } from "@/types/domain";

export function adminIlikePattern(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

export class AdminPlaceQueryRepository {
  async findReportClassificationMeta(placeId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("places")
      .select("created_by")
      .eq("id", placeId)
      .maybeSingle();
    if (error) throw error;
    return data ? { createdBy: data.created_by as string | null } : null;
  }

  async findSummaryMultiplier(placeId: string, cardProductId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_multiplier_summaries")
      .select("current_multiplier")
      .eq("place_id", placeId)
      .eq("card_product_id", cardProductId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.current_multiplier) return null;
    return {
      currentMultiplier: parseInt(data.current_multiplier as string, 10) as MultiplierValue,
    };
  }

  async findByIdForAdmin(id: string): Promise<AdminPlaceDetail | null> {
    const supabase = createAdminClient();
    const cardProductId = await placeCardRepository.getDefaultCardProductId();
    const { data: place, error } = await supabase
      .from("places")
      .select(`
        *,
        merchant_brands ( name ),
        creator:profiles!created_by ( username )
      `)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Admin place query failed: ${error.message}`);
    if (!place) return null;

    const [{ data: summary }, { count: openFlagCount }, { data: flagRows }] = await Promise.all([
      supabase
        .from("place_multiplier_summaries")
        .select("*")
        .eq("place_id", id)
        .eq("card_product_id", cardProductId)
        .maybeSingle(),
      supabase
        .from("place_flags")
        .select("id", { count: "exact", head: true })
        .eq("place_id", id)
        .eq("status", "open"),
      supabase
        .from("place_flags")
        .select(`
          id, reason, details, status, created_at, resolved_at,
          reporter:profiles!user_id ( username ),
          resolver:profiles!resolved_by ( username )
        `)
        .eq("place_id", id)
        .order("created_at", { ascending: false }),
    ]);

    const detail = projectPlaceDetail(place, summary);
    const creator = place.creator as { username: string | null } | null;
    return {
      ...detail,
      normalizedName: place.normalized_name as string,
      externalPlaceId: place.external_place_id as string | null,
      createdBy: place.created_by as string | null,
      createdByUsername: creator?.username ?? null,
      createdAt: place.created_at as string,
      updatedAt: place.updated_at as string,
      cardProductId,
      openFlagCount: openFlagCount ?? 0,
      flags: ((flagRows ?? []) as Record<string, unknown>[]).map(projectAdminFlag),
    };
  }

  async searchForAdmin(options: {
    placeId?: string;
    name?: string;
    postalCode?: string;
    addressLine1?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const supabase = createAdminClient();
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from("places")
      .select(
        "id, name, address_line1, city, province, postal_code, category, status, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (options.status) query = query.eq("status", options.status);
    if (options.placeId) {
      query = query.eq("id", options.placeId);
    } else {
      if (options.name) query = query.ilike("name", adminIlikePattern(options.name));
      if (options.postalCode) {
        query = query.ilike(
          "postal_code",
          adminIlikePattern(normalizeCanadianPostalCode(options.postalCode)),
        );
      }
      if (options.addressLine1) {
        query = query.ilike("address_line1", adminIlikePattern(options.addressLine1));
      }
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw new Error(`Admin places query failed: ${error.message}`);
    return { places: data ?? [], total: count ?? 0, page, pageSize };
  }
}

export const adminPlaceQueryRepository = new AdminPlaceQueryRepository();
