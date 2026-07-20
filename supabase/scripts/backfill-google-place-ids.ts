import { createAdminClient } from "../../lib/supabase/admin";
import { parseGeoLocation } from "../../lib/map/parse-location";
import { findGooglePlaceId } from "../../server/geocoding/google-places";
import { invalidatePlaceReadCaches } from "../../lib/cache/place-cache";
import { invalidateAdminCaches } from "../../lib/cache/admin-cache";

const write = process.argv.includes("--write");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const requestedLimit = Number.parseInt(limitArg?.split("=")[1] ?? "100", 10);
const limit = Number.isFinite(requestedLimit)
  ? Math.min(Math.max(requestedLimit, 1), 1_000)
  : 100;

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is required");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("places")
    .select(
      "id, name, address_line1, city, province, postal_code, country_code, location",
    )
    .eq("status", "active")
    .is("google_place_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  let matched = 0;
  let updated = 0;
  for (const place of data ?? []) {
    const coordinates = parseGeoLocation(place.location);
    if (!coordinates) continue;

    const googlePlaceId = await findGooglePlaceId({
      name: place.name,
      addressLine1: place.address_line1,
      city: place.city,
      province: place.province,
      postalCode: place.postal_code,
      countryCode: place.country_code,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });

    if (!googlePlaceId) continue;
    matched += 1;

    if (write) {
      const { error: updateError } = await supabase
        .from("places")
        .update({ google_place_id: googlePlaceId })
        .eq("id", place.id)
        .is("google_place_id", null);
      if (updateError) throw updateError;
      await invalidatePlaceReadCaches(place.id);
      updated += 1;
    }
  }

  if (updated > 0) await invalidateAdminCaches();
  console.log(
    JSON.stringify({ scanned: data?.length ?? 0, matched, updated, write }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
