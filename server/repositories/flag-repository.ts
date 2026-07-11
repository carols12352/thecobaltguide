import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CreateFlagInput } from "@/server/validation/schemas";

export class FlagRepository {
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

  async findOpenForAdmin(limit = 50) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("place_flags")
      .select("*, places ( name ), profiles ( username )")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
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
  async updateProfile(
    userId: string,
    updates: { role?: string; status?: string },
  ) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }
}

export const flagRepository = new FlagRepository();
export const cardRepository = new CardRepository();
export const userRepository = new UserRepository();
