/**
 * Replace the existing Rewards Canada seed from the reviewed local JSON.
 *
 * Preview only:
 *   npm run replace:rewards-canada
 *
 * Replace existing Rewards Canada seed rows:
 *   npm run replace:rewards-canada -- --apply --replace
 *
 * The apply path uploads into staging tables first. One database transaction
 * then deletes the old seed and inserts the complete new seed.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { invalidatePlaceReadCaches } from "../../lib/cache/place-cache";
import { getSupabaseSecretKey } from "../../lib/supabase/env";
import {
  reviewedPlaceDisposition,
  rewardsCanadaDisplayName,
} from "../../lib/import/rewards-canada-reviewed";
import { normalizeMerchantName } from "../../lib/utils";

const DEFAULT_INPUT = "data/rewards-canada/cobaltcanada-canada-reviewed.json";
const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;
const multiplierSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(5),
]);

const placeSchema = z.object({
  name: z.string().min(1),
  normalized_name: z.string().min(1),
  address_line1: z.string().min(1),
  city: z.string().min(1),
  province: z.enum(PROVINCES),
  postal_code: z.string(),
  country_code: z.literal("CA"),
  latitude: z.number().min(40).max(84),
  longitude: z.number().min(-142).max(-52),
  category: z.string().min(1),
  accepts_amex: z.boolean().optional(),
  external_place_id: z.string().regex(/^overture:place:/),
  multiplier: multiplierSchema,
  source: z.object({
    rewards_canada_id: z.string().startsWith("rewards-canada:"),
    scope: z.string(),
    url: z.string().url(),
  }).passthrough(),
  match: z.object({
    basis: z.string().optional(),
    osm_name: z.string().optional(),
  }).passthrough(),
}).passthrough();

const onlineSchema = z.object({
  external_source_id: z.string().startsWith("rewards-canada:"),
  merchant_name: z.string().min(1),
  normalized_name: z.string().min(1),
  city: z.string().nullable().optional(),
  province: z.enum(PROVINCES).nullable().optional(),
  country_code: z.literal("CA"),
  multiplier: multiplierSchema,
  category: z.string().min(1),
  source_url: z.string().url(),
}).passthrough();

const reviewedPayloadSchema = z.object({
  schema_version: z.literal(2),
  generated_at: z.string().datetime({ offset: true }),
  statistics: z.object({
    places: z.number().int().nonnegative(),
    online_merchants: z.number().int().nonnegative(),
  }).passthrough(),
  places: z.array(placeSchema).min(1),
  online_merchants: z.array(onlineSchema),
  brand_review: z.array(z.unknown()),
  name_review: z.array(z.unknown()),
  location_review: z.array(z.unknown()),
  channel_review: z.array(z.unknown()),
  status_review: z.array(z.unknown()),
  review: z.array(z.unknown()),
  rejected: z.array(z.unknown()),
}).passthrough();

type ReviewedPayload = z.infer<typeof reviewedPayloadSchema>;
type ReviewedPlace = ReviewedPayload["places"][number];

interface Args {
  input: string;
  apply: boolean;
  replace: boolean;
  replaceAllPlaces: boolean;
  allowCascade: boolean;
  batchSize: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const valueFor = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : (argv[index + 1] ?? fallback);
  };
  const batchSize = Number.parseInt(valueFor("--batch-size", "500"), 10);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("--batch-size must be between 1 and 1000");
  }
  const args = {
    input: valueFor("--input", DEFAULT_INPUT),
    apply: argv.includes("--apply"),
    replace: argv.includes("--replace"),
    replaceAllPlaces: argv.includes("--replace-all-places"),
    allowCascade: argv.includes("--allow-cascade"),
    batchSize,
  };
  if (args.apply && !args.replace) {
    throw new Error("Database writes require both --apply and --replace");
  }
  return args;
}

function loadEnv(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator);
    if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1);
  }
}

function loadPayload(input: string): ReviewedPayload {
  const inputPath = path.resolve(process.cwd(), input);
  if (!existsSync(inputPath)) throw new Error(`Reviewed JSON not found: ${input}`);
  const payload = reviewedPayloadSchema.parse(JSON.parse(readFileSync(inputPath, "utf8")));
  if (payload.statistics.places !== payload.places.length) {
    throw new Error("statistics.places does not match places length");
  }
  if (payload.statistics.online_merchants !== payload.online_merchants.length) {
    throw new Error("statistics.online_merchants does not match online_merchants length");
  }
  if (payload.brand_review.length || payload.name_review.length) {
    throw new Error("Brand and name review queues must be empty before import");
  }
  return payload;
}

function stableExternalPlaceId(place: ReviewedPlace): string {
  const identity = `${place.external_place_id}|${place.source.rewards_canada_id}|${place.multiplier}`;
  const suffix = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return `rewards-canada:${place.external_place_id}:${suffix}`;
}

function buildPlaceRows(payload: ReviewedPayload, runId: string) {
  const uniquePlaces = new Map<string, ReviewedPlace>();
  for (const place of payload.places) {
    if (reviewedPlaceDisposition(place) !== "physical") continue;
    const displayName = rewardsCanadaDisplayName(place.name);
    const identity = [
      place.external_place_id,
      normalizeMerchantName(displayName),
      place.multiplier,
    ].join("|");
    if (!uniquePlaces.has(identity)) uniquePlaces.set(identity, place);
  }

  const rows = [...uniquePlaces.values()].map((place) => {
    const displayName = rewardsCanadaDisplayName(place.name);
    return {
      run_id: runId,
      external_place_id: stableExternalPlaceId(place),
      name: displayName,
      normalized_name: normalizeMerchantName(displayName),
      address_line1: place.address_line1,
      city: place.city,
      province: place.province,
      postal_code: place.postal_code,
      country_code: "CA",
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
      accepts_amex: place.accepts_amex ?? true,
      multiplier: String(place.multiplier),
    };
  });
  const ids = new Set(rows.map((row) => row.external_place_id));
  if (ids.size !== rows.length) throw new Error("Generated external place IDs are not unique");
  return rows;
}

function buildOnlineRows(payload: ReviewedPayload, runId: string) {
  const merchants = new Map(payload.online_merchants.map((merchant) => [
    merchant.external_source_id,
    merchant,
  ]));
  for (const place of payload.places) {
    if (reviewedPlaceDisposition(place) !== "online") continue;
    merchants.set(place.source.rewards_canada_id, {
      external_source_id: place.source.rewards_canada_id,
      merchant_name: place.name,
      normalized_name: place.normalized_name,
      city: null,
      province: null,
      country_code: "CA",
      multiplier: place.multiplier,
      category: place.category,
      source_url: place.source.url,
    });
  }
  const rows = [...merchants.values()].map((merchant) => ({
    run_id: runId,
    external_source_id: merchant.external_source_id,
    merchant_name: merchant.merchant_name,
    normalized_name: merchant.normalized_name,
    city: merchant.city ?? null,
    province: merchant.province ?? null,
    country_code: "CA",
    multiplier: String(merchant.multiplier),
    category: merchant.category,
    source_url: merchant.source_url,
    source_updated_at: payload.generated_at,
  }));
  const ids = new Set(rows.map((row) => row.external_source_id));
  if (ids.size !== rows.length) throw new Error("Online merchant source IDs are not unique");
  return rows;
}

async function uploadBatches(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  batchSize: number,
): Promise<void> {
  for (let start = 0; start < rows.length; start += batchSize) {
    const { error } = await supabase.from(table).insert(rows.slice(start, start + batchSize));
    if (error) throw new Error(`${table} staging upload failed: ${error.message}`);
    const completed = Math.min(start + batchSize, rows.length);
    if (completed % 5000 === 0 || completed === rows.length) {
      console.log(`  ${table}: ${completed}/${rows.length}`);
    }
  }
}

async function clearStage(supabase: SupabaseClient, runId: string): Promise<void> {
  await Promise.all([
    supabase.from("rewards_canada_place_import_stage").delete().eq("run_id", runId),
    supabase.from("rewards_canada_online_import_stage").delete().eq("run_id", runId),
  ]);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const payload = loadPayload(args.input);
  const previewRunId = "00000000-0000-0000-0000-000000000000";
  const previewPlaces = buildPlaceRows(payload, previewRunId);
  const previewOnline = buildOnlineRows(payload, previewRunId);
  const movedOnline = payload.places.filter(
    (place) => reviewedPlaceDisposition(place) === "online",
  ).length;
  const excludedByNameReview = payload.places.filter(
    (place) => reviewedPlaceDisposition(place) === "exclude",
  ).length;
  const physicalBeforeDeduplication = payload.places.length
    - movedOnline - excludedByNameReview;

  console.log(JSON.stringify({
    input: args.input,
    source_places: payload.places.length,
    places: previewPlaces.length,
    online_merchants: previewOnline.length,
    moved_physical_rows_to_online: movedOnline,
    excluded_by_name_review: excludedByNameReview,
    removed_duplicate_display_rows: physicalBeforeDeduplication - previewPlaces.length,
    excluded_review_records:
      payload.location_review.length + payload.channel_review.length
      + payload.status_review.length + payload.review.length,
    replace_all_places: args.replaceAllPlaces,
    allow_cascade: args.allowCascade,
    dry_run: !args.apply,
  }, null, 2));

  if (!args.apply) return;

  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = getSupabaseSecretKey();
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: cardProduct, error: cardError } = await supabase
    .from("card_products")
    .select("id")
    .eq("slug", "amex-cobalt-ca")
    .single();
  if (cardError || !cardProduct) {
    throw new Error(`Cobalt card product not found: ${cardError?.message ?? "missing row"}`);
  }

  const runId = randomUUID();
  const places = buildPlaceRows(payload, runId);
  const online = buildOnlineRows(payload, runId);
  try {
    await uploadBatches(supabase, "rewards_canada_place_import_stage", places, args.batchSize);
    await uploadBatches(supabase, "rewards_canada_online_import_stage", online, args.batchSize);
    const { data, error } = await supabase.rpc("replace_rewards_canada_seed", {
      p_run_id: runId,
      p_card_product_id: cardProduct.id,
      p_expected_place_count: places.length,
      p_expected_online_count: online.length,
      p_replace_all_places: args.replaceAllPlaces,
      p_allow_cascade: args.allowCascade,
    });
    if (error) throw new Error(`Atomic replacement failed: ${error.message}`);
    console.log(JSON.stringify(data, null, 2));
    const cacheVersionsBumped = await invalidatePlaceReadCaches(
      "rewards-canada-seed-replacement",
    );
    console.log(JSON.stringify({ cache_versions_bumped: cacheVersionsBumped }, null, 2));
  } finally {
    await clearStage(supabase, runId);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
