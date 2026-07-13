import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { accountListSinceIso } from "@/lib/account/recent-list-window";
import type { CreateFlagInput } from "@/server/validation/schemas";
import type { FlagReason, FlagStatus, UserPlaceFlag } from "@/types/domain";

export class FlagRepository {
  async findById(flagId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .select("id, user_id, status, place_id")
      .eq("id", flagId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async findOpenForPlaceWithReporters(placeId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .select("id, user_id, status")
      .eq("place_id", placeId)
      .eq("status", "open");

    if (error) throw error;
    return data ?? [];
  }

  async findByUserId(
    userId: string,
    options: {
      view?: "active" | "archive";
      page?: number;
      pageSize?: number;
      since?: string;
    } = {},
  ): Promise<{
    flags: UserPlaceFlag[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const supabase = await createClient();
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 5));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const since = options.since ?? accountListSinceIso();

    let query = supabase
      .from("place_flags")
      .select(
        `
        id, place_id, user_id, reason, details, status, created_at, resolved_at,
        places ( id, name, city, province )
      `,
        { count: "exact" },
      )
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (options.view === "active") {
      query = query.eq("status", "open");
    } else if (options.view === "archive") {
      query = query.in("status", ["resolved", "dismissed"]);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    return {
      flags: (data ?? []).map((row) => this.mapUserFlag(row)),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  private mapUserFlag(row: Record<string, unknown>): UserPlaceFlag {
    const place = row.places as
      | { name?: string; city?: string; province?: string }
      | { name?: string; city?: string; province?: string }[]
      | null;

    const placeRecord = Array.isArray(place) ? place[0] : place;

    return {
      id: row.id as string,
      placeId: row.place_id as string,
      userId: row.user_id as string,
      reason: row.reason as FlagReason,
      details: (row.details as string | null) ?? null,
      status: row.status as FlagStatus,
      createdAt: row.created_at as string,
      resolvedAt: (row.resolved_at as string | null) ?? null,
      placeName: placeRecord?.name ?? null,
      placeCity: placeRecord?.city ?? null,
      placeProvince: placeRecord?.province ?? null,
    };
  }

  async create(placeId: string, userId: string, input: CreateFlagInput) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .insert({
        place_id: placeId,
        user_id: userId,
        reason: input.reason,
        details: input.details ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async findOpenForPlace(placeId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .select("id")
      .eq("place_id", placeId)
      .eq("status", "open")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async resolveOpenFlagsForPlace(
    placeId: string,
    resolvedBy: string,
    status: "resolved" | "dismissed",
  ) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .update({
        status,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq("place_id", placeId)
      .eq("status", "open")
      .select("id");

    if (error) throw error;
    return data ?? [];
  }

  async countOpenForPlace(placeId: string) {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("place_flags")
      .select("id", { count: "exact", head: true })
      .eq("place_id", placeId)
      .eq("status", "open");

    if (error) throw error;
    return count ?? 0;
  }

  async findOpenForAdmin(limit = 50) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .select(
        `
        id, reason, details, status, created_at, place_id,
        places ( id, name, city ),
        reporter:profiles!user_id ( id, username )
      `,
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Admin flags query failed: ${error.message}`);
    }
    return data;
  }

  async dismissOpenFlagsForPlace(placeId: string, resolvedBy: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .update({
        status: "dismissed",
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq("place_id", placeId)
      .eq("status", "open")
      .select("id");

    if (error) throw error;
    return data ?? [];
  }

  async updateStatus(
    flagId: string,
    status: "open" | "resolved" | "dismissed",
    resolvedBy: string,
  ) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .update({
        status,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", flagId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }
}

export class CardRepository {
  async findAllActive() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("card_products")
      .select("*")
      .eq("active", true)
      .order("product_name");

    if (error) throw error;
    return (data ?? []).map((c) => ({
      id: c.id,
      issuer: c.issuer,
      productName: c.product_name,
      slug: c.slug,
      countryCode: c.country_code,
      active: c.active,
    }));
  }
}

export class UserRepository {
  async getReputationScore(userId: string): Promise<number> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("reputation_score")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return data.reputation_score as number;
  }

  async findByIdForAdmin(userId: string) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, role, status, report_count, reputation_score, created_at",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Admin user lookup failed: ${error.message}`);
    }
    return data;
  }

  async findForAdmin(limit = 100) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, role, status, report_count, reputation_score, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Admin users query failed: ${error.message}`);
    }
    return data;
  }

  async updateProfile(
    userId: string,
    updates: {
      role?: string;
      status?: string;
      reputationScore?: number;
    },
  ) {
    const supabase = createAdminClient();
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.reputationScore !== undefined) {
      dbUpdates.reputation_score = updates.reputationScore;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(dbUpdates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async adjustReputationScore(userId: string, delta: number): Promise<number> {
    const supabase = createAdminClient();
    const { data: current, error: readError } = await supabase
      .from("profiles")
      .select("reputation_score")
      .eq("id", userId)
      .single();

    if (readError) throw readError;

    const nextScore = (current.reputation_score as number) + delta;
    const { data, error } = await supabase
      .from("profiles")
      .update({
        reputation_score: nextScore,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("reputation_score")
      .single();

    if (error) throw error;
    return data.reputation_score as number;
  }

  async adjustReportCount(userId: string, delta: number): Promise<number> {
    const supabase = createAdminClient();
    const { data: current, error: readError } = await supabase
      .from("profiles")
      .select("report_count")
      .eq("id", userId)
      .single();

    if (readError) throw readError;

    const nextCount = Math.max(0, (current.report_count as number) + delta);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        report_count: nextCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("report_count")
      .single();

    if (error) throw error;
    return data.report_count as number;
  }
}

export const flagRepository = new FlagRepository();
export const cardRepository = new CardRepository();
export const userRepository = new UserRepository();
