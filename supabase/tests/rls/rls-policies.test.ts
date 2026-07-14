/**
 * Live RLS matrix against local Supabase.
 * Prerequisites: `supabase start` + migrations applied (see supabase/tests/README.md).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type RlsEnvironment = {
  url: string;
  anonKey: string;
  serviceKey: string;
};

function resolveRlsEnvironment(): RlsEnvironment {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const configuredAnon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configuredService =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (configuredUrl || configuredAnon || configuredService) {
    if (!configuredUrl || !configuredAnon || !configuredService) {
      throw new Error(
        "RLS test environment is incomplete: provide URL, anon/publishable key, and service/secret key together",
      );
    }
    return {
      url: configuredUrl,
      anonKey: configuredAnon,
      serviceKey: configuredService,
    };
  }

  try {
    const output = execFileSync("supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const status = JSON.parse(output) as {
      API_URL?: string;
      ANON_KEY?: string;
      SERVICE_ROLE_KEY?: string;
    };
    if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
      throw new Error("Supabase status did not return the required local credentials");
    }
    return {
      url: status.API_URL,
      anonKey: status.ANON_KEY,
      serviceKey: status.SERVICE_ROLE_KEY,
    };
  } catch (error) {
    throw new Error(
      `Unable to discover local Supabase credentials. Run supabase start or provide explicit test environment variables. ${String(error)}`,
    );
  }
}

const { url, anonKey, serviceKey } = resolveRlsEnvironment();

const PASSWORD = "RlsTest-Password-123!";

type Fixture = {
  userAId: string;
  userBId: string;
  modId: string;
  placeId: string;
  inactivePlaceId: string;
  reportId: string;
  flagId: string;
  cardProductId: string;
  inactiveCardProductId: string;
};

function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function anonClient(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function userClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  role: "user" | "moderator" | "admin" = "user",
): Promise<string> {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw listed.error;
  const existing = listed.data.users.find((u) => u.email === email);
  if (existing) {
    await admin.from("profiles").update({ role, status: "active" }).eq("id", existing.id);
    return existing.id;
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error(`Failed to create ${email}`);
  }
  const id = created.data.user.id;
  // handle_new_user may race; upsert profile then set role
  await admin.from("profiles").upsert({ id, username: email.split("@")[0], role });
  await admin.from("profiles").update({ role, status: "active" }).eq("id", id);
  return id;
}

async function assertReachable(): Promise<void> {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (res.status >= 500) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    throw new Error(
      `Local Supabase is not reachable at ${url}. Run: supabase start && supabase db reset`,
    );
  }
}

describe("RLS lockdown matrix", () => {
  const admin = adminClient();
  let fixture: Fixture;
  const emails = {
    a: `rls-user-a-${Date.now()}@example.com`,
    b: `rls-user-b-${Date.now()}@example.com`,
    mod: `rls-mod-${Date.now()}@example.com`,
  };

  beforeAll(async () => {
    await assertReachable();

    const userAId = await ensureUser(admin, emails.a, "user");
    const userBId = await ensureUser(admin, emails.b, "user");
    const modId = await ensureUser(admin, emails.mod, "moderator");

    const { data: card, error: cardError } = await admin
      .from("card_products")
      .select("id")
      .eq("slug", "amex-cobalt-ca")
      .single();
    if (cardError || !card) throw cardError ?? new Error("missing card product");

    const { data: inactiveCard, error: inactiveCardError } = await admin
      .from("card_products")
      .insert({
        issuer: "RLS Test Issuer",
        product_name: "Inactive Test Card",
        slug: `rls-inactive-card-${Date.now()}`,
        country_code: "CA",
        active: false,
      })
      .select("id")
      .single();
    if (inactiveCardError || !inactiveCard) {
      throw inactiveCardError ?? new Error("inactive card insert failed");
    }

    const { data: place, error: placeError } = await admin
      .from("places")
      .insert({
        name: "RLS Test Cafe",
        normalized_name: "rls test cafe",
        address_line1: "1 Test St",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V1A1",
        country_code: "CA",
        location: "SRID=4326;POINT(-79.38 43.65)",
        category: "dining",
        status: "active",
        created_by: userAId,
      })
      .select("id")
      .single();
    if (placeError || !place) throw placeError ?? new Error("place insert failed");

    const { data: inactivePlace, error: inactivePlaceError } = await admin
      .from("places")
      .insert({
        name: "RLS Closed Cafe",
        normalized_name: "rls closed cafe",
        address_line1: "9 Test St",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V1A1",
        country_code: "CA",
        location: "SRID=4326;POINT(-79.381 43.651)",
        category: "dining",
        status: "permanently_closed",
        created_by: userAId,
      })
      .select("id")
      .single();
    if (inactivePlaceError || !inactivePlace) {
      throw inactivePlaceError ?? new Error("inactive place insert failed");
    }

    const { error: summaryError } = await admin.from("place_multiplier_summaries").upsert({
      place_id: place.id,
      card_product_id: card.id,
      current_multiplier: "5",
      confidence_level: "medium",
      recent_report_count: 1,
    });
    if (summaryError) throw summaryError;

    const { data: report, error: reportError } = await admin
      .from("multiplier_reports")
      .insert({
        place_id: place.id,
        user_id: userAId,
        card_product_id: card.id,
        multiplier: "5",
        transaction_date: "2026-07-01",
        payment_context: "in_store",
        notes: "private note should not leak to anon",
        status: "active",
        report_kind: "update",
      })
      .select("id")
      .single();
    if (reportError || !report) throw reportError ?? new Error("report insert failed");

    const { data: flag, error: flagError } = await admin
      .from("place_flags")
      .insert({
        place_id: place.id,
        user_id: userAId,
        reason: "wrong_address",
        details: "flag detail",
        status: "open",
      })
      .select("id")
      .single();
    if (flagError || !flag) throw flagError ?? new Error("flag insert failed");

    fixture = {
      userAId,
      userBId,
      modId,
      placeId: place.id,
      inactivePlaceId: inactivePlace.id,
      reportId: report.id,
      flagId: flag.id,
      cardProductId: card.id,
      inactiveCardProductId: inactiveCard.id,
    };
  });

  afterAll(async () => {
    if (!fixture) return;
    await admin.from("place_flags").delete().eq("id", fixture.flagId);
    await admin.from("multiplier_reports").delete().eq("id", fixture.reportId);
    await admin.from("place_multiplier_summaries").delete().eq("place_id", fixture.placeId);
    await admin.from("places").delete().eq("id", fixture.inactivePlaceId);
    await admin.from("places").delete().eq("id", fixture.placeId);
    await admin.from("card_products").delete().eq("id", fixture.inactiveCardProductId);
    await admin.auth.admin.deleteUser(fixture.userAId);
    await admin.auth.admin.deleteUser(fixture.userBId);
    await admin.auth.admin.deleteUser(fixture.modId);
  });

  describe("anon", () => {
    it("can read active places, summaries, and card products", async () => {
      const anon = anonClient();

      const places = await anon.from("places").select("id").eq("id", fixture.placeId);
      expect(places.error).toBeNull();
      expect(places.data?.length).toBe(1);

      const cards = await anon
        .from("card_products")
        .select("id")
        .eq("slug", "amex-cobalt-ca");
      expect(cards.error).toBeNull();
      expect(cards.data?.length).toBe(1);

      const summaries = await anon
        .from("place_multiplier_summaries")
        .select("place_id")
        .eq("place_id", fixture.placeId);
      expect(summaries.error).toBeNull();
      expect(summaries.data?.length).toBe(1);
    });

    it("cannot read inactive cards or non-active places, including through RPC", async () => {
      const anon = anonClient();

      const cards = await anon
        .from("card_products")
        .select("id")
        .eq("id", fixture.inactiveCardProductId);
      expect(cards.error).toBeNull();
      expect(cards.data ?? []).toEqual([]);

      const places = await anon
        .from("places")
        .select("id")
        .eq("id", fixture.inactivePlaceId);
      expect(places.error).toBeNull();
      expect(places.data ?? []).toEqual([]);

      const viewport = await anon.rpc("places_in_viewport", {
        p_north: 44,
        p_south: 43,
        p_east: -79,
        p_west: -80,
        p_limit: -100,
      });
      expect(viewport.error).toBeNull();
      expect(viewport.data?.map((row: { id: string }) => row.id)).toEqual([
        fixture.placeId,
      ]);

      const nearby = await anon.rpc("places_nearby", {
        p_latitude: 43.65,
        p_longitude: -79.38,
        p_radius_metres: -100,
        p_limit: 100000,
      });
      expect(nearby.error).toBeNull();
      expect(nearby.data?.map((row: { id: string }) => row.id)).toEqual([
        fixture.placeId,
      ]);
    });

    it("cannot read profiles or raw reports", async () => {
      const anon = anonClient();

      const profiles = await anon.from("profiles").select("id").eq("id", fixture.userAId);
      expect(profiles.error?.code).toBe("42501");
      expect(profiles.data ?? []).toEqual([]);

      const reports = await anon
        .from("multiplier_reports")
        .select("id, notes")
        .eq("id", fixture.reportId);
      expect(reports.error?.code).toBe("42501");
      expect(reports.data ?? []).toEqual([]);
    });

    it("cannot execute the service-only auth account lookup", async () => {
      const anon = anonClient();
      const result = await anon.rpc("lookup_auth_account_hints", {
        target_email: emails.a,
      });
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it("cannot insert places, reports, or flags", async () => {
      const anon = anonClient();

      const place = await anon.from("places").insert({
        name: "Anon Insert",
        normalized_name: "anon insert",
        address_line1: "2 Test St",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V1A1",
        country_code: "CA",
        location: "SRID=4326;POINT(-79.39 43.66)",
        category: "dining",
        status: "active",
      });
      expect(place.error).toBeTruthy();

      const report = await anon.from("multiplier_reports").insert({
        place_id: fixture.placeId,
        user_id: fixture.userAId,
        card_product_id: fixture.cardProductId,
        multiplier: "5",
        transaction_date: "2026-07-02",
        payment_context: "in_store",
        status: "active",
        report_kind: "update",
      });
      expect(report.error).toBeTruthy();

      const flag = await anon.from("place_flags").insert({
        place_id: fixture.placeId,
        user_id: fixture.userAId,
        reason: "other",
        status: "open",
      });
      expect(flag.error).toBeTruthy();
    });

    it("cannot update profiles", async () => {
      const anon = anonClient();
      const updated = await anon
        .from("profiles")
        .update({ role: "admin", reputation_score: 9999 })
        .eq("id", fixture.userAId)
        .select();
      expect(updated.error?.code).toBe("42501");
      expect(updated.data ?? []).toEqual([]);
      const check = await admin
        .from("profiles")
        .select("role, reputation_score")
        .eq("id", fixture.userAId)
        .single();
      expect(check.data?.role).toBe("user");
      expect(check.data?.reputation_score).not.toBe(9999);
    });
  });

  describe("authenticated user", () => {
    it("can read own profile, reports, and flags; not another user's", async () => {
      const userA = await userClient(emails.a);
      const userB = await userClient(emails.b);

      const ownProfile = await userA
        .from("profiles")
        .select("id, role")
        .eq("id", fixture.userAId)
        .single();
      expect(ownProfile.error).toBeNull();
      expect(ownProfile.data?.id).toBe(fixture.userAId);

      const otherProfile = await userA
        .from("profiles")
        .select("id")
        .eq("id", fixture.userBId);
      expect(otherProfile.data ?? []).toEqual([]);

      const ownReport = await userA
        .from("multiplier_reports")
        .select("id")
        .eq("id", fixture.reportId);
      expect(ownReport.data?.length).toBe(1);

      const otherSeesReport = await userB
        .from("multiplier_reports")
        .select("id")
        .eq("id", fixture.reportId);
      expect(otherSeesReport.data ?? []).toEqual([]);

      const ownFlag = await userA.from("place_flags").select("id").eq("id", fixture.flagId);
      expect(ownFlag.data?.length).toBe(1);

      const otherFlag = await userB.from("place_flags").select("id").eq("id", fixture.flagId);
      expect(otherFlag.data ?? []).toEqual([]);
    });

    it("cannot escalate role, status, or reputation via direct update", async () => {
      const userA = await userClient(emails.a);
      await userA
        .from("profiles")
        .update({ role: "admin", status: "active", reputation_score: 9999 })
        .eq("id", fixture.userAId);

      const check = await admin
        .from("profiles")
        .select("role, status, reputation_score")
        .eq("id", fixture.userAId)
        .single();
      expect(check.data?.role).toBe("user");
      expect(check.data?.reputation_score).not.toBe(9999);
    });

    it("cannot execute the service-only auth account lookup", async () => {
      const userA = await userClient(emails.a);
      const result = await userA.rpc("lookup_auth_account_hints", {
        target_email: emails.b,
      });
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });

    it("cannot insert places, reports, or flags via client JWT", async () => {
      const userA = await userClient(emails.a);

      const place = await userA.from("places").insert({
        name: "User Direct Place",
        normalized_name: "user direct place",
        address_line1: "3 Test St",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V1A1",
        country_code: "CA",
        location: "SRID=4326;POINT(-79.4 43.67)",
        category: "dining",
        status: "active",
        created_by: fixture.userAId,
      });
      expect(place.error).toBeTruthy();

      const report = await userA.from("multiplier_reports").insert({
        place_id: fixture.placeId,
        user_id: fixture.userAId,
        card_product_id: fixture.cardProductId,
        multiplier: "3",
        transaction_date: "2026-07-03",
        payment_context: "online",
        status: "active",
        report_kind: "confirm",
      });
      expect(report.error).toBeTruthy();

      const flag = await userA.from("place_flags").insert({
        place_id: fixture.placeId,
        user_id: fixture.userAId,
        reason: "duplicate",
        status: "open",
      });
      expect(flag.error).toBeTruthy();
    });

    it("cannot mutate public catalogue or derived summary tables", async () => {
      const userA = await userClient(emails.a);

      const brand = await userA.from("merchant_brands").insert({
        name: "Direct Brand",
        normalized_name: `direct-brand-${Date.now()}`,
      });
      expect(brand.error?.code).toBe("42501");

      const card = await userA
        .from("card_products")
        .update({ active: false })
        .eq("id", fixture.cardProductId);
      expect(card.error?.code).toBe("42501");

      const summary = await userA
        .from("place_multiplier_summaries")
        .update({ recent_report_count: 9999 })
        .eq("place_id", fixture.placeId);
      expect(summary.error?.code).toBe("42501");

      const deleted = await userA.from("places").delete().eq("id", fixture.placeId);
      expect(deleted.error?.code).toBe("42501");
    });

    it("cannot soft-delete or mutate reports via client JWT", async () => {
      const userA = await userClient(emails.a);
      const updated = await userA
        .from("multiplier_reports")
        .update({ status: "removed" })
        .eq("id", fixture.reportId)
        .select();
      expect(updated.data ?? []).toEqual([]);

      const check = await admin
        .from("multiplier_reports")
        .select("status")
        .eq("id", fixture.reportId)
        .single();
      expect(check.data?.status).toBe("active");
    });
  });

  describe("moderator JWT", () => {
    it("still cannot write moderation_logs without service role", async () => {
      const mod = await userClient(emails.mod);
      const inserted = await mod.from("moderation_logs").insert({
        moderator_id: fixture.modId,
        entity_type: "place",
        entity_id: fixture.placeId,
        action: "test",
      });
      expect(inserted.error).toBeTruthy();

      const selected = await mod.from("moderation_logs").select("id").limit(1);
      expect(selected.error?.code).toBe("42501");
      expect(selected.data ?? []).toEqual([]);
    });

    it("has no privileged table write policies beyond a normal user", async () => {
      const mod = await userClient(emails.mod);
      const place = await mod.from("places").insert({
        name: "Mod Direct Place",
        normalized_name: "mod direct place",
        address_line1: "4 Test St",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V1A1",
        country_code: "CA",
        location: "SRID=4326;POINT(-79.41 43.68)",
        category: "dining",
        status: "active",
        created_by: fixture.modId,
      });
      expect(place.error).toBeTruthy();
    });
  });
});
