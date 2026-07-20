import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function environment() {
  const explicit = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (explicit.url || explicit.key) {
    if (!explicit.url || !explicit.key) {
      throw new Error("Integration test URL and service key must be provided together");
    }
    const hostname = new URL(explicit.url).hostname;
    if (!["127.0.0.1", "localhost"].includes(hostname)
      && process.env.ALLOW_REMOTE_DATABASE_TESTS !== "true") {
      throw new Error("Refusing remote database tests without ALLOW_REMOTE_DATABASE_TESTS=true");
    }
    return explicit as { url: string; key: string };
  }
  const status = JSON.parse(
    execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }),
  ) as { API_URL: string; SERVICE_ROLE_KEY: string };
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

const env = environment();
const admin = createClient(env.url, env.key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("transactional report workflow", () => {
  const suffix = Date.now();
  let userId: string;
  let placeId: string;
  let cardId: string;
  let reportId: string | undefined;
  let initialReportCount = 0;
  let initialReputationScore = 0;

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({
      email: `integration-report-${suffix}@example.com`,
      password: "Integration-Password-123!",
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error;
    userId = created.data.user.id;
    const card = await admin.from("card_products").select("id").eq("slug", "amex-cobalt-ca").single();
    if (card.error) throw card.error;
    cardId = card.data.id;
    const place = await admin.from("places").insert({
      name: "Integration Transaction Cafe",
      normalized_name: "integration transaction cafe",
      address_line1: "1 Integration Way",
      city: "Toronto",
      province: "ON",
      postal_code: "M5V1A1",
      country_code: "CA",
      location: "SRID=4326;POINT(-79.38 43.65)",
      category: "dining",
      status: "active",
      created_by: userId,
    }).select("id").single();
    if (place.error) throw place.error;
    placeId = place.data.id;
  });

  afterAll(async () => {
    if (reportId) await admin.from("multiplier_reports").delete().eq("id", reportId);
    if (placeId) await admin.from("places").delete().eq("id", placeId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("commits report, profile and summary as one action", async () => {
    const before = await admin.from("profiles").select("report_count,reputation_score").eq("id", userId).single();
    if (before.error) throw before.error;
    initialReportCount = before.data.report_count ?? 0;
    initialReputationScore = before.data.reputation_score ?? 0;
    const submitted = await admin.rpc("submit_report_transactional", {
      p_place_id: placeId,
      p_user_id: userId,
      p_card_product_id: cardId,
      p_multiplier: "5",
      p_transaction_date: new Date().toISOString().slice(0, 10),
      p_payment_context: "in_store",
      p_notes: null,
      p_report_kind: "error",
    });
    if (submitted.error) throw submitted.error;
    reportId = (submitted.data as { id: string }).id;

    const profile = await admin.from("profiles").select("report_count,reputation_score").eq("id", userId).single();
    const summary = await admin.from("place_multiplier_summaries")
      .select("current_multiplier,recent_report_count")
      .eq("place_id", placeId).eq("card_product_id", cardId).single();
    expect(profile.data?.report_count).toBe(initialReportCount + 1);
    expect(profile.data?.reputation_score).toBe(initialReputationScore);
    expect(summary.data).toMatchObject({ current_multiplier: "5", recent_report_count: 1 });
  });

  it("returns a stable conflict for a repeated daily submission", async () => {
    const repeated = await admin.rpc("submit_report_transactional", {
      p_place_id: placeId,
      p_user_id: userId,
      p_card_product_id: cardId,
      p_multiplier: "5",
      p_transaction_date: new Date().toISOString().slice(0, 10),
      p_payment_context: "in_store",
      p_notes: null,
      p_report_kind: "error",
    });
    expect(repeated.error?.code).toBe("23505");
    const reports = await admin.from("multiplier_reports").select("id", { count: "exact" })
      .eq("place_id", placeId).eq("user_id", userId);
    expect(reports.count).toBe(1);
  });

  it("marks the report removed and reverses its contribution atomically", async () => {
    const deleted = await admin.rpc("delete_own_report_transactional", {
      p_report_id: reportId!, p_user_id: userId,
    });
    if (deleted.error) throw deleted.error;
    const profile = await admin.from("profiles").select("report_count,reputation_score").eq("id", userId).single();
    expect(profile.data).toMatchObject({
      report_count: initialReportCount,
      reputation_score: initialReputationScore,
    });
    const report = await admin.from("multiplier_reports").select("status").eq("id", reportId).single();
    expect(report.data?.status).toBe("removed");
  });
});

describe("transactional account deletion", () => {
  const suffix = Date.now();
  let userId: string;
  let placeId: string;
  let cardId: string;
  let reportId: string;
  let flagId: string;

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({
      email: `integration-account-delete-${suffix}@example.com`,
      password: "Integration-Password-123!",
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error;
    userId = created.data.user.id;

    const card = await admin
      .from("card_products")
      .select("id")
      .eq("slug", "amex-cobalt-ca")
      .single();
    if (card.error) throw card.error;
    cardId = card.data.id;

    const place = await admin
      .from("places")
      .insert({
        name: "Integration Privacy Cafe",
        normalized_name: "integration privacy cafe",
        address_line1: "2 Integration Way",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V1A1",
        country_code: "CA",
        location: "SRID=4326;POINT(-79.381 43.651)",
        category: "dining",
        status: "active",
        created_by: userId,
      })
      .select("id")
      .single();
    if (place.error) throw place.error;
    placeId = place.data.id;

    const report = await admin
      .from("multiplier_reports")
      .insert({
        place_id: placeId,
        user_id: userId,
        card_product_id: cardId,
        multiplier: "5",
        transaction_date: "2026-07-01",
        payment_context: "in_store",
        notes: "private account deletion note",
        report_kind: "update",
      })
      .select("id")
      .single();
    if (report.error) throw report.error;
    reportId = report.data.id;

    const flag = await admin
      .from("place_flags")
      .insert({
        place_id: placeId,
        user_id: userId,
        reason: "wrong_address",
        details: "private account deletion detail",
      })
      .select("id")
      .single();
    if (flag.error) throw flag.error;
    flagId = flag.data.id;
  });

  afterAll(async () => {
    if (flagId) await admin.from("place_flags").delete().eq("id", flagId);
    if (reportId) await admin.from("multiplier_reports").delete().eq("id", reportId);
    if (placeId) await admin.from("places").delete().eq("id", placeId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("removes identity and free-form data while retaining anonymous evidence", async () => {
    const deleted = await admin.rpc("delete_own_account_transactional", {
      p_user_id: userId,
    });
    if (deleted.error) throw deleted.error;
    expect(deleted.data).toMatchObject({
      deleted: true,
      reportsAnonymized: 1,
      flagsAnonymized: 1,
      affectedPlaceIds: [placeId],
    });

    const [profile, report, flag] = await Promise.all([
      admin.from("profiles").select("id").eq("id", userId),
      admin
        .from("multiplier_reports")
        .select("user_id, notes")
        .eq("id", reportId)
        .single(),
      admin
        .from("place_flags")
        .select("user_id, details")
        .eq("id", flagId)
        .single(),
    ]);

    expect(profile.data ?? []).toEqual([]);
    expect(report.data).toEqual({ user_id: null, notes: null });
    expect(flag.data).toEqual({ user_id: null, details: null });
  });
});
