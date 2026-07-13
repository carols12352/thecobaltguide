import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CARD_SLUG, DUPLICATE_DETECTION } from "@/config/constants";
import { parseGeoLocation } from "@/lib/map/parse-location";
import { normalizeMerchantName, nameSimilarity } from "@/lib/utils";
import type { CreatePlaceInput } from "@/server/validation/schemas";
import type { AdminPlaceDetail, MapPlace, MultiplierValue, PlaceDetail, PlaceSummary } from "@/types/domain";

export class PlaceRepository {
  async getDefaultCardProductId(): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("card_products")
      .select("id")
      .eq("slug", DEFAULT_CARD_SLUG)
      .single();
    if (error || !data) throw new Error("Default card product not found");
    return data.id;
  }

  async findInViewport(params: {
    north: number;
    south: number;
    east: number;
    west: number;
    cardProductId?: string;
    multiplier?: number;
    category?: string;
    limit?: number;
  }): Promise<MapPlace[]> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await this.getDefaultCardProductId());

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

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      addressLine1: row.address_line1 as string | undefined,
      city: row.city as string | undefined,
      province: row.province as string | undefined,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      multiplier: row.multiplier
        ? (parseInt(row.multiplier as string, 10) as MapPlace["multiplier"])
        : null,
      confidenceLevel: row.confidence_level as MapPlace["confidenceLevel"],
      recentReportCount: (row.recent_report_count as number) ?? 0,
      lastReportedAt: (row.last_reported_at as string) ?? null,
      category: row.category as string,
    }));
  }

  async search(query: string, limit = 20): Promise<MapPlace[]> {
    const supabase = await createClient();
    const normalized = normalizeMerchantName(query);

    const { data, error } = await supabase
      .from("places")
      .select(
        `
        id, name, address_line1, city, province, category, location,
        place_multiplier_summaries (
          current_multiplier, confidence_level,
          recent_report_count, last_reported_at
        )
      `,
      )
      .eq("status", "active")
      .or(`name.ilike.%${query}%,normalized_name.ilike.%${normalized}%`)
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((place) => {
      const summary = Array.isArray(place.place_multiplier_summaries)
        ? place.place_multiplier_summaries[0]
        : place.place_multiplier_summaries;

      const coords = parseGeoLocation(place.location) ?? {
        latitude: 0,
        longitude: 0,
      };

      return {
        id: place.id,
        name: place.name,
        addressLine1: place.address_line1 ?? undefined,
        city: place.city ?? undefined,
        province: place.province ?? undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        category: place.category,
        multiplier: summary?.current_multiplier
          ? (parseInt(summary.current_multiplier, 10) as MapPlace["multiplier"])
          : null,
        confidenceLevel: summary?.confidence_level ?? "insufficient",
        recentReportCount: summary?.recent_report_count ?? 0,
        lastReportedAt: summary?.last_reported_at ?? null,
      };
    });
  }

  async findById(id: string): Promise<PlaceDetail | null> {
    const supabase = await createClient();
    const cardProductId = await this.getDefaultCardProductId();

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

    return this.mapPlaceDetail(place, summary);
  }

  async findReportClassificationMeta(placeId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("places")
      .select("created_by")
      .eq("id", placeId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return { createdBy: data.created_by as string | null };
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
      currentMultiplier: parseInt(
        data.current_multiplier as string,
        10,
      ) as MultiplierValue,
    };
  }

  async findByIdForAdmin(id: string): Promise<AdminPlaceDetail | null> {
    const supabase = createAdminClient();
    const cardProductId = await this.getDefaultCardProductId();

    const { data: place, error } = await supabase
      .from("places")
      .select(
        `
        *,
        merchant_brands ( name ),
        creator:profiles!created_by ( username )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Admin place query failed: ${error.message}`);
    }
    if (!place) return null;

    const { data: summary } = await supabase
      .from("place_multiplier_summaries")
      .select("*")
      .eq("place_id", id)
      .eq("card_product_id", cardProductId)
      .maybeSingle();

    const { count: openFlagCount } = await supabase
      .from("place_flags")
      .select("id", { count: "exact", head: true })
      .eq("place_id", id)
      .eq("status", "open");

    const detail = this.mapPlaceDetail(place, summary);
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
    };
  }

  async upsertSummaryForAdmin(
    placeId: string,
    cardProductId: string,
    updates: {
      confidenceLevel?: string;
      confidenceScore?: number;
      currentMultiplier?: number;
    },
  ) {
    const supabase = createAdminClient();
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.confidenceLevel) {
      dbUpdates.confidence_level = updates.confidenceLevel;
    }
    if (updates.confidenceScore !== undefined) {
      dbUpdates.confidence_score = updates.confidenceScore;
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
        confidence_score: updates.confidenceScore ?? 0,
        current_multiplier: updates.currentMultiplier?.toString() ?? null,
        ...dbUpdates,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  private mapPlaceDetail(
    place: Record<string, unknown>,
    summary: Record<string, unknown> | null,
  ): PlaceDetail {
    const brand = place.merchant_brands as { name: string } | null;
    const coords = parseGeoLocation(place.location) ?? {
      latitude: 0,
      longitude: 0,
    };
    const { latitude, longitude } = coords;

    const placeSummary: PlaceSummary | null = summary
      ? {
          currentMultiplier: summary.current_multiplier
            ? (parseInt(summary.current_multiplier as string, 10) as PlaceSummary["currentMultiplier"])
            : null,
          confidenceScore: summary.confidence_score as number | null,
          confidenceLevel: summary.confidence_level as PlaceSummary["confidenceLevel"],
          recentReportCount: summary.recent_report_count as number,
          uniqueReporterCount: summary.unique_reporter_count as number,
          lastReportedAt: summary.last_reported_at as string | null,
          score1x: Number(summary.score_1x),
          score2x: Number(summary.score_2x),
          score3x: Number(summary.score_3x),
          score5x: Number(summary.score_5x),
        }
      : null;

    return {
      id: place.id as string,
      name: place.name as string,
      addressLine1: place.address_line1 as string,
      city: place.city as string,
      province: place.province as string,
      postalCode: place.postal_code as string,
      countryCode: place.country_code as string,
      category: place.category as string,
      acceptsAmex: place.accepts_amex as boolean | null,
      latitude,
      longitude,
      status: place.status as PlaceDetail["status"],
      brandId: place.brand_id as string | null,
      brandName: brand?.name ?? null,
      summary: placeSummary,
    };
  }

  async create(input: CreatePlaceInput, userId: string) {
    const supabase = createAdminClient();
    const normalizedName = normalizeMerchantName(input.name);

    const { data, error } = await supabase
      .from("places")
      .insert({
        name: input.name,
        normalized_name: normalizedName,
        address_line1: input.addressLine1,
        city: input.city,
        province: input.province,
        postal_code: input.postalCode,
        country_code: input.countryCode,
        location: `SRID=4326;POINT(${input.longitude} ${input.latitude})`,
        category: input.category,
        accepts_amex: input.acceptsAmex ?? null,
        external_place_id: input.externalPlaceId ?? null,
        brand_id: input.brandId ?? null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data;
  }

  async findPossibleDuplicates(input: CreatePlaceInput) {
    const supabase = createAdminClient();

    if (input.externalPlaceId) {
      const { data } = await supabase
        .from("places")
        .select("id, name, address_line1")
        .eq("external_place_id", input.externalPlaceId)
        .eq("status", "active")
        .limit(1);
      if (data?.length) return data;
    }

    const { data: nearby } = await supabase.rpc("places_nearby", {
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_radius_metres: DUPLICATE_DETECTION.maxDistanceMetres,
      p_limit: 10,
    });

    return (nearby ?? []).filter(
      (p: { name: string }) =>
        nameSimilarity(p.name, input.name) >=
        DUPLICATE_DETECTION.nameSimilarityThreshold,
    );
  }

  async searchForAdmin(options: {
    query?: string;
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

    if (options.status) {
      query = query.eq("status", options.status);
    }

    const trimmedQuery = options.query?.trim();
    if (trimmedQuery) {
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(trimmedQuery)) {
        query = query.eq("id", trimmedQuery);
      } else {
        const escaped = trimmedQuery.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        const pattern = `%${escaped}%`;
        query = query.or(
          `name.ilike.${pattern},address_line1.ilike.${pattern},city.ilike.${pattern},postal_code.ilike.${pattern}`,
        );
      }
    }

    const { data, error, count } = await query.range(from, to);
    if (error) {
      throw new Error(`Admin places query failed: ${error.message}`);
    }

    return {
      places: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    };
  }
}

export const placeRepository = new PlaceRepository();
