import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CARD_SLUG, DUPLICATE_DETECTION, MAP_DEFAULTS } from "@/config/constants";
import { parseGeoLocation } from "@/lib/map/parse-location";
import { normalizeMerchantName, nameSimilarity } from "@/lib/utils";
import { normalizeCanadianPostalCode } from "@/lib/validation/canadian-postal-code";
import { confidenceScoreForAdminLevel } from "@/server/services/aggregation";
import type { CreatePlaceInput } from "@/server/validation/schemas";
import type { AdminPlaceDetail, ConfidenceLevel, MapPlace, MultiplierValue, PlaceDetail, PlaceSummary } from "@/types/domain";

export class PlaceRepository {
  private defaultCardProductIdPromise: Promise<string> | null = null;

  async getDefaultCardProductId(): Promise<string> {
    if (!this.defaultCardProductIdPromise) {
      this.defaultCardProductIdPromise = this.fetchDefaultCardProductId();
    }
    return this.defaultCardProductIdPromise;
  }

  private async fetchDefaultCardProductId(): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("card_products")
      .select("id")
      .eq("slug", DEFAULT_CARD_SLUG)
      .single();
    if (error || !data) throw new Error("Default card product not found");
    return data.id;
  }

  private mapViewportRows(data: Record<string, unknown>[] | null): MapPlace[] {
    return (data ?? []).map((row) => ({
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

    return this.mapViewportRows(data as Record<string, unknown>[] | null);
  }

  async countInViewport(params: {
    north: number;
    south: number;
    east: number;
    west: number;
    cardProductId?: string;
    multiplier?: number;
    category?: string;
  }): Promise<number> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await this.getDefaultCardProductId());

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

  async findInViewNear(params: {
    north: number;
    south: number;
    east: number;
    west: number;
    latitude: number;
    longitude: number;
    cardProductId?: string;
    multiplier?: number;
    category?: string;
    limit?: number;
  }): Promise<MapPlace[]> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await this.getDefaultCardProductId());

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
    return this.mapViewportRows(data as Record<string, unknown>[] | null);
  }

  async countInCity(params: {
    city: string;
    province: string;
    cardProductId?: string;
    multiplier?: number;
    category?: string;
  }): Promise<number> {
    const supabase = await createClient();
    const cardId = params.cardProductId ?? (await this.getDefaultCardProductId());

    if (params.multiplier) {
      let query = supabase
        .from("places")
        .select("id, place_multiplier_summaries!inner(current_multiplier)", {
          count: "exact",
          head: true,
        })
        .eq("status", "active")
        .eq("city", params.city)
        .eq("province", params.province)
        .eq("place_multiplier_summaries.card_product_id", cardId)
        .eq(
          "place_multiplier_summaries.current_multiplier",
          params.multiplier.toString(),
        );

      if (params.category) {
        query = query.eq("category", params.category);
      }

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

    if (params.category) {
      query = query.eq("category", params.category);
    }

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
    const cardId = params.cardProductId ?? (await this.getDefaultCardProductId());
    const limit = params.limit ?? MAP_DEFAULTS.cityMapClusterLimit;

    if (params.multiplier) {
      let query = supabase
        .from("places")
        .select(
          `
          id, name, address_line1, city, province, category, location,
          place_multiplier_summaries!inner (
            current_multiplier, confidence_level,
            recent_report_count, last_reported_at
          )
        `,
        )
        .eq("status", "active")
        .eq("city", params.city)
        .eq("province", params.province)
        .eq("place_multiplier_summaries.card_product_id", cardId)
        .eq(
          "place_multiplier_summaries.current_multiplier",
          params.multiplier.toString(),
        )
        .limit(limit);

      if (params.category) {
        query = query.eq("category", params.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return this.mapPlacesWithSummaries(data ?? [], cardId);
    }

    let query = supabase
      .from("places")
      .select(
        `
        id, name, address_line1, city, province, category, location,
        place_multiplier_summaries (
          current_multiplier, confidence_level,
          recent_report_count, last_reported_at, card_product_id
        )
      `,
      )
      .eq("status", "active")
      .eq("city", params.city)
      .eq("province", params.province)
      .limit(limit);

    if (params.category) {
      query = query.eq("category", params.category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return this.mapPlacesWithSummaries(data ?? [], cardId);
  }

  private mapPlacesWithSummaries(
    rows: Record<string, unknown>[],
    cardProductId: string,
  ): MapPlace[] {
    return rows.map((place) => {
      const summaries = place.place_multiplier_summaries;
      const summaryList = Array.isArray(summaries)
        ? summaries
        : summaries
          ? [summaries]
          : [];
      const summary = summaryList.find(
        (entry) =>
          (entry as { card_product_id?: string }).card_product_id ===
          cardProductId,
      ) as
        | {
            current_multiplier?: string;
            confidence_level?: MapPlace["confidenceLevel"];
            recent_report_count?: number;
            last_reported_at?: string | null;
          }
        | undefined;

      const coords = parseGeoLocation(place.location) ?? {
        latitude: 0,
        longitude: 0,
      };

      return {
        id: place.id as string,
        name: place.name as string,
        addressLine1: (place.address_line1 as string | null) ?? undefined,
        city: (place.city as string | null) ?? undefined,
        province: (place.province as string | null) ?? undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        category: place.category as string,
        multiplier: summary?.current_multiplier
          ? (parseInt(summary.current_multiplier, 10) as MapPlace["multiplier"])
          : null,
        confidenceLevel: summary?.confidence_level ?? "insufficient",
        recentReportCount: summary?.recent_report_count ?? 0,
        lastReportedAt: summary?.last_reported_at ?? null,
      };
    });
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

    const { data: flagRows } = await supabase
      .from("place_flags")
      .select(
        `
        id, reason, details, status, created_at, resolved_at,
        reporter:profiles!user_id ( username ),
        resolver:profiles!resolved_by ( username )
      `,
      )
      .eq("place_id", id)
      .order("created_at", { ascending: false });

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
      flags: (flagRows ?? []).map((flag) => {
        const reporter = profileUsername(flag.reporter);
        const resolver = profileUsername(flag.resolver);
        return {
          id: flag.id as string,
          reason: flag.reason as string,
          details: flag.details as string | null,
          status: flag.status as AdminPlaceDetail["flags"][number]["status"],
          createdAt: flag.created_at as string,
          resolvedAt: flag.resolved_at as string | null,
          reporterUsername: reporter,
          reviewedByUsername: resolver,
        };
      }),
    };
  }

  async upsertSummaryForAdmin(
    placeId: string,
    cardProductId: string,
    updates: {
      confidenceLevel?: string;
      currentMultiplier?: number;
    },
  ) {
    const supabase = createAdminClient();
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

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

    if (options.status) {
      query = query.eq("status", options.status);
    }

    if (options.placeId) {
      query = query.eq("id", options.placeId);
    } else {
      if (options.name) {
        query = query.ilike("name", ilikePattern(options.name));
      }
      if (options.postalCode) {
        query = query.ilike(
          "postal_code",
          ilikePattern(normalizeCanadianPostalCode(options.postalCode)),
        );
      }
      if (options.addressLine1) {
        query = query.ilike("address_line1", ilikePattern(options.addressLine1));
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

function ilikePattern(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `%${escaped}%`;
}

function profileUsername(
  profile: unknown,
): string | null {
  if (!profile) return null;
  if (Array.isArray(profile)) {
    const first = profile[0] as { username?: string | null } | undefined;
    return first?.username ?? null;
  }
  return (profile as { username?: string | null }).username ?? null;
}

export const placeRepository = new PlaceRepository();
