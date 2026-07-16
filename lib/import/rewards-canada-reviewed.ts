import { normalizeMerchantName } from "@/lib/utils";

export type ReviewedPlaceDisposition = "physical" | "online" | "exclude";

interface ReviewedPlaceIdentity {
  name: string;
  match?: {
    basis?: string;
    osm_name?: string;
  };
}

const DISPLAY_NAME_OVERRIDES = new Map<string, string>([
  ["CAA (Canadian Automobile Association)", "CAA"],
  ["Cineplex (including food)", "Cineplex"],
  ["Comfort Inn (Choice Hotels)", "Comfort Inn"],
  ["Ikea (including dining & frozen food)", "IKEA"],
  ["Karahi Boys (multiple locations)", "Karahi Boys"],
  ["Landmark Theatres (including concessions and bar)", "Landmark Theatres"],
  ["LOCAL Public Eatery Barclay", "LOCAL Public Eatery"],
  ["Quality Inn (Choice Hotels)", "Quality Inn"],
  ["Safeway (Gas stations & Liquor Stores included)", "Safeway"],
  ["Sobeys (includes Sobeys Liquor)", "Sobeys"],
  ["Starbucks (including app reloads)", "Starbucks"],
  ["Tim Hortons (including app reloads)", "Tim Hortons"],
  ["Plaza Grocery  1864 Albemarle St", "Plaza Grocery"],
  ["Salt Yard Social  1599 Lower Water St", "Salt Yard Social"],
  ["Straight Brooklyn Pizza - Vancouver", "Straight Brooklyn Pizza"],
  ["Sulbing Cafe - Burnaby", "Sulbing Cafe"],
  ["Sun Wah Supermarket - Winnipeg", "Sun Wah Supermarket"],
  ["Wal-Mart Kenora 5854", "Walmart"],
  ["Wilsons Haus of Lechon\tToronto", "Wilson's Haus of Lechon"],
]);

const ALWAYS_EXCLUDED_PHYSICAL_NAMES = new Set([
  "Needs 99 Morton Ave",
  "Needs FastFuel 29 Elmwood",
  "Rexall (Post Office)",
]);

export function rewardsCanadaDisplayName(sourceName: string): string {
  return DISPLAY_NAME_OVERRIDES.get(sourceName) ?? sourceName.trim().replace(/\s+/g, " ");
}

export function reviewedPlaceDisposition(place: ReviewedPlaceIdentity): ReviewedPlaceDisposition {
  if (place.name === "RBC Insurance (Aviva)") return "online";
  if (ALWAYS_EXCLUDED_PHYSICAL_NAMES.has(place.name)) return "exclude";
  if (place.match?.basis !== "brand") return "physical";

  const primaryName = normalizeMerchantName(place.match.osm_name ?? "");
  const sourceName = place.name;
  if (sourceName === "Gong Cha" && primaryName === "cha house") return "exclude";
  if (sourceName === "Husky" && primaryName === "chevron") return "exclude";
  if (sourceName === "East Side Marios" && primaryName === "fionn maccools") {
    return "exclude";
  }
  if (
    sourceName === "Esso"
    && (primaryName.startsWith("petro canada") || primaryName.startsWith("petrocanada"))
  ) {
    return "exclude";
  }
  if (sourceName === "Fido" && primaryName === "rogers") return "exclude";
  if (sourceName === "Shell" && primaryName === "flying j") return "exclude";
  if (
    (sourceName === "Pizza Hut" || sourceName === "Pizza Pizza")
    && primaryName.startsWith("pizza salvator")
  ) {
    return "exclude";
  }
  if (sourceName === "Rexall" && !primaryName.includes("rexall")) return "exclude";
  if (sourceName === "Tim Hortons (including app reloads)") {
    return primaryName.includes("tim horton")
      && !(primaryName.includes("children") && primaryName.includes("camp"))
      ? "physical"
      : "exclude";
  }
  if (sourceName === "Starbucks (including app reloads)") {
    return primaryName.includes("starbuck") ? "physical" : "exclude";
  }
  if (sourceName === "Safeway (Gas stations & Liquor Stores included)") {
    return primaryName.includes("safeway")
      && !primaryName.includes("voila by safeway")
      && !primaryName.includes("safeway talks")
      && !primaryName.includes("safeway head office")
      ? "physical"
      : "exclude";
  }
  if (sourceName === "Sobeys (includes Sobeys Liquor)") {
    return primaryName.includes("sobeys") || primaryName.includes("safeway liquor")
      ? "physical"
      : "exclude";
  }
  if (sourceName === "Ikea (including dining & frozen food)") {
    return primaryName.includes("ikea") ? "physical" : "exclude";
  }
  return "physical";
}
