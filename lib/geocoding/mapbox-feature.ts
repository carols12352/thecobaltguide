import { looksLikeStreetAddress } from "@/lib/geocoding/address-query";

/** Extract a street line from Mapbox POI `place_name` (comma-separated). */
export function streetFromMapboxPlaceName(placeName: string): string {
  const parts = placeName.split(",").map((part) => part.trim());
  return parts.find((part) => looksLikeStreetAddress(part)) ?? "";
}

const PROVINCE_LABELS =
  /^(Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Prince Edward Island|Newfoundland and Labrador|Northwest Territories|Nunavut|Yukon|ON|QC|BC|AB|MB|SK|NS|NB|PE|NL|NT|NU|YT)$/i;

/** Best-effort city extraction from Mapbox `place_name` when context lacks place.* */
export function cityFromMapboxPlaceName(placeName: string): string {
  const parts = placeName.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return "";

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    if (/^Canada$/i.test(part)) continue;
    if (PROVINCE_LABELS.test(part) || /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d/i.test(part)) {
      const previous = parts[i - 1]?.trim();
      if (previous && !looksLikeStreetAddress(previous)) {
        return previous;
      }
    }
  }

  return "";
}
