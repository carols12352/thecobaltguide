/**
 * Spread stacked city-center coordinates for Rewards Canada imports.
 * Run once after city-mode import: npx tsx scripts/fix-imported-coordinates.ts
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spreadCoordinates } from "../lib/map/spread-coordinates";
import { parseGeoLocation } from "../lib/map/parse-location";
import { REWARDS_CANADA_EXTERNAL_PREFIX } from "../lib/import/rewards-canada";

const PAGE_SIZE = 500;

type ScriptSupabase = SupabaseClient<any, "public", "public", any, any>;

interface ImportedPlaceRow {
  id: string;
  external_place_id: string | null;
  location: unknown;
}

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) throw new Error(".env.local not found");
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

async function fetchImportedPlaces(supabase: ScriptSupabase, from: number) {
  return supabase
    .from("places")
    .select("id, external_place_id, location")
    .like("external_place_id", `${REWARDS_CANADA_EXTERNAL_PREFIX}%`)
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
}

async function main() {
  loadEnv();
  const supabase: ScriptSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let updated = 0;
  let skipped = 0;
  let processed = 0;
  let from = 0;

  while (true) {
    const { data, error } = await fetchImportedPlaces(supabase, from);
    if (error) throw error;

    const places = (data ?? []) as ImportedPlaceRow[];
    if (!places.length) break;

    for (const place of places) {
      processed++;
      if (!place.external_place_id) {
        skipped++;
        continue;
      }

      const coords = parseGeoLocation(place.location);
      if (!coords) {
        skipped++;
        continue;
      }

      const spread = spreadCoordinates(
        coords.latitude,
        coords.longitude,
        place.external_place_id,
      );

      const { error: updateError } = await supabase
        .from("places")
        .update({
          location: `SRID=4326;POINT(${spread.longitude} ${spread.latitude})`,
        })
        .eq("id", place.id);

      if (updateError) {
        console.warn(
          `Failed to update ${place.external_place_id}: ${updateError.message}`,
        );
        skipped++;
      } else {
        updated++;
      }
    }

    if (places.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    process.stdout.write(`\rProcessed ${processed} places…`);
  }

  if (processed > PAGE_SIZE) process.stdout.write("\n");

  if (processed === 0) {
    console.log("No Rewards Canada imports found.");
    return;
  }

  console.log(`Updated coordinates for ${updated} imported places.`);
  if (skipped > 0) {
    console.log(`Skipped ${skipped} places with unparseable location data.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
