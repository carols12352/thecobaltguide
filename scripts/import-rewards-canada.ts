/**
 * Import Rewards Canada Cobalt multiplier data into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-rewards-canada.ts --dry-run --limit 10
 *   npx tsx scripts/import-rewards-canada.ts --geocode city
 *   npx tsx scripts/import-rewards-canada.ts --geocode precise
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "../lib/supabase/env";
import {
  confidenceForImport,
  fetchRewardsCanadaData,
  parseRewardsCanadaRecord,
  REWARDS_CANADA_ATTRIBUTION,
  type RewardsCanadaRecord,
} from "../lib/import/rewards-canada";
import { flushGeocodeCache, geocodeMerchantLocation, preloadCityGeocodes } from "../lib/import/geocode";
import { spreadCoordinates } from "../lib/map/spread-coordinates";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(".env.local not found. Add Supabase credentials first.");
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    limit: (() => {
      const idx = args.indexOf("--limit");
      return idx >= 0 ? parseInt(args[idx + 1] ?? "0", 10) : 0;
    })(),
    geocode: (() => {
      const idx = args.indexOf("--geocode");
      const mode = idx >= 0 ? args[idx + 1] : "city";
      return mode === "precise" ? "precise" : "city";
    })() as "precise" | "city",
    useLocal: args.includes("--local"),
  };
}

async function loadRecords(useLocal: boolean): Promise<RewardsCanadaRecord[]> {
  const localPath = path.join(process.cwd(), "data", "rewards-canada", "cobaltcanada.json");
  if (useLocal && existsSync(localPath)) {
    return JSON.parse(readFileSync(localPath, "utf-8")) as RewardsCanadaRecord[];
  }
  const records = await fetchRewardsCanadaData("canada");
  const dir = path.dirname(localPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(localPath, JSON.stringify(records, null, 2));
  return records;
}

async function main() {
  loadEnv();
  const { dryRun, limit, geocode, useLocal } = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceKey: string | undefined;
  try {
    serviceKey = getSupabaseSecretKey();
  } catch {
    serviceKey = undefined;
  }
  if (!dryRun && (!supabaseUrl || !serviceKey)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  }

  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  let cardProductId: string | null = null;
  if (supabase) {
    const { data: cardProduct, error: cardError } = await supabase
      .from("card_products")
      .select("id")
      .eq("slug", "amex-cobalt-ca")
      .single();

    if (cardError || !cardProduct) {
      if (dryRun) {
        console.warn("Warning: card_products seed missing — dry-run will skip DB duplicate checks.");
      } else {
        throw new Error("card_products seed missing — run Supabase migration first");
      }
    } else {
      cardProductId = cardProduct.id;
    }
  }

  const rawRecords = await loadRecords(useLocal);
  const parsed = rawRecords
    .map(parseRewardsCanadaRecord)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const toImport = limit > 0 ? parsed.slice(0, limit) : parsed;

  console.log(`Rewards Canada import`);
  console.log(`  Raw records:     ${rawRecords.length}`);
  console.log(`  Mappable:        ${parsed.length}`);
  console.log(`  To import:       ${toImport.length}`);
  console.log(`  Geocode mode:    ${geocode}`);
  console.log(`  Dry run:         ${dryRun}`);
  console.log(`  ${REWARDS_CANADA_ATTRIBUTION}\n`);

  if (geocode === "city" && !dryRun) {
    const uniqueCities = new Map(
      toImport.map((p) => [`${p.city}|${p.provinceName}`, p]),
    );
    console.log(`  Pre-geocoding ${uniqueCities.size} unique cities…`);
    await preloadCityGeocodes([...uniqueCities.values()], (done, total) => {
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`\r  Geocoded cities: ${done}/${total}`);
      }
    });
    console.log("\n");
  }

  let imported = 0;
  let skipped = 0;
  let geocodeFailed = 0;
  let processed = 0;

  for (const place of toImport) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`  Progress: ${processed}/${toImport.length} (imported ${imported}, skipped ${skipped})`);
    }
    if (supabase) {
      const { data: existing } = await supabase
        .from("places")
        .select("id")
        .eq("external_place_id", place.externalPlaceId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }
    }

    const coords = await geocodeMerchantLocation({
      merchant: place.name,
      city: place.city,
      provinceName: place.provinceName,
      mode: geocode,
    });

    if (!coords) {
      geocodeFailed++;
      console.warn(`  ✗ geocode failed: ${place.name} (${place.city})`);
      continue;
    }

    const spread = spreadCoordinates(
      coords.latitude,
      coords.longitude,
      place.externalPlaceId,
    );

    if (dryRun) {
      console.log(
        `  ✓ would import: ${place.name} · ${place.multiplier}x · ${place.city}, ${place.provinceCode} → ${spread.latitude.toFixed(4)}, ${spread.longitude.toFixed(4)}`,
      );
      imported++;
      continue;
    }

    if (!supabase || !cardProductId) {
      throw new Error("Supabase not configured for live import");
    }

    const { data: inserted, error: placeError } = await supabase
      .from("places")
      .insert({
        name: place.name,
        normalized_name: place.normalizedName,
        address_line1: place.addressLine1,
        city: place.city,
        province: place.provinceCode,
        postal_code: place.postalCode,
        country_code: "CA",
        location: `SRID=4326;POINT(${spread.longitude} ${spread.latitude})`,
        category: place.category,
        accepts_amex: true,
        external_place_id: place.externalPlaceId,
        status: "active",
      })
      .select("id")
      .single();

    if (placeError || !inserted) {
      console.warn(`  ✗ insert failed: ${place.name} — ${placeError?.message}`);
      continue;
    }

    const scoreKey = `score_${place.multiplier}x` as
      | "score_1x"
      | "score_2x"
      | "score_3x"
      | "score_5x";

    const summaryScores = {
      score_1x: 0,
      score_2x: 0,
      score_3x: 0,
      score_5x: 0,
    };
    summaryScores[scoreKey] = 1;

    await supabase.from("place_multiplier_summaries").upsert({
      place_id: inserted.id,
      card_product_id: cardProductId,
      current_multiplier: place.multiplier.toString(),
      confidence_score: 1,
      confidence_level: confidenceForImport(place.multiplier),
      recent_report_count: 1,
      unique_reporter_count: 1,
      last_reported_at: new Date("2026-07-09").toISOString(),
      ...summaryScores,
      updated_at: new Date().toISOString(),
    });

    imported++;
    if (imported % 50 === 0) {
      console.log(`  … ${imported} imported so far`);
    }
  }

  flushGeocodeCache();

  console.log(`\nDone.`);
  console.log(`  Imported:        ${imported}`);
  console.log(`  Skipped (dup):   ${skipped}`);
  console.log(`  Geocode failed:  ${geocodeFailed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
