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
    const submitted = await admin.rpc("submit_report_transactional", {
      p_place_id: placeId,
      p_user_id: userId,
      p_card_product_id: cardId,
      p_multiplier: "5",
      p_transaction_date: new Date().toISOString().slice(0, 10),
      p_payment_context: "in_store",
      p_notes: null,
      p_report_kind: "confirm",
    });
    if (submitted.error) throw submitted.error;
    reportId = (submitted.data as { id: string }).id;

    const profile = await admin.from("profiles").select("report_count,reputation_score").eq("id", userId).single();
    const summary = await admin.from("place_multiplier_summaries")
      .select("current_multiplier,recent_report_count")
      .eq("place_id", placeId).eq("card_product_id", cardId).single();
    expect(profile.data?.report_count).toBe((before.data?.report_count ?? 0) + 1);
    expect(profile.data?.reputation_score).toBe((before.data?.reputation_score ?? 0) + 1);
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
      p_report_kind: "confirm",
    });
    expect(repeated.error?.code).toBe("23505");
    const reports = await admin.from("multiplier_reports").select("id", { count: "exact" })
      .eq("place_id", placeId).eq("user_id", userId);
    expect(reports.count).toBe(1);
  });

  it("deletes the report and reverses its contribution atomically", async () => {
    const deleted = await admin.rpc("delete_own_report_transactional", {
      p_report_id: reportId!, p_user_id: userId,
    });
    if (deleted.error) throw deleted.error;
    reportId = undefined;
    const profile = await admin.from("profiles").select("report_count,reputation_score").eq("id", userId).single();
    expect(profile.data).toMatchObject({ report_count: 0, reputation_score: 0 });
    const report = await admin.from("multiplier_reports").select("id").eq("place_id", placeId).maybeSingle();
    expect(report.data).toBeNull();
  });
});
