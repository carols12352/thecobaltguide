import { DUPLICATE_DETECTION } from "@/config/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { nameSimilarity, normalizeMerchantName } from "@/lib/utils";
import type { CreatePlaceInput } from "@/server/validation/schemas";

export class PlaceWriteRepository {
  async create(input: CreatePlaceInput, userId: string) {
    const { data, error } = await createAdminClient().from("places").insert({
      name: input.name,
      normalized_name: normalizeMerchantName(input.name),
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
    }).select("id").single();
    if (error) throw error;
    return data;
  }

  async findPossibleDuplicates(input: CreatePlaceInput) {
    const supabase = createAdminClient();
    if (input.externalPlaceId) {
      const { data } = await supabase.from("places").select("id, name, address_line1")
        .eq("external_place_id", input.externalPlaceId).eq("status", "active").limit(1);
      if (data?.length) return data;
    }
    const { data: nearby, error } = await supabase.rpc("places_nearby", {
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_radius_metres: DUPLICATE_DETECTION.maxDistanceMetres,
      p_limit: 10,
    });
    if (error) throw error;
    return (nearby ?? []).filter((place: { name: string }) =>
      nameSimilarity(place.name, input.name) >= DUPLICATE_DETECTION.nameSimilarityThreshold);
  }
}

export const placeWriteRepository = new PlaceWriteRepository();
