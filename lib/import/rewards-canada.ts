import { normalizeMerchantName } from "@/lib/utils";
import type { ConfidenceLevel, MultiplierValue } from "@/types/domain";

export const REWARDS_CANADA_SOURCES = {
  canada: "https://www.rewardscanada.ca/data/cobaltcanada.json",
  us: "https://www.rewardscanada.ca/data/cobaltus.json",
  row: "https://www.rewardscanada.ca/data/cobaltrow.json",
} as const;

export const REWARDS_CANADA_ATTRIBUTION =
  "Merchant multiplier data initially sourced from Rewards Canada community list (rewardscanada.ca).";

export interface RewardsCanadaRecord {
  Merchant: string;
  City: string;
  Province: string;
  Points: number | string;
}

export interface ParsedRewardsCanadaPlace {
  name: string;
  normalizedName: string;
  city: string;
  provinceCode: string;
  provinceName: string;
  multiplier: MultiplierValue;
  category: string;
  externalPlaceId: string;
  addressLine1: string;
  postalCode: string;
  sourceUrl: string;
}

const PROVINCE_CODES: Record<string, string> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "northwest territories": "NT",
  "nova scotia": "NS",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
};

/** Records without a specific mappable address (chains, province/country wide). */
export function isNonMappableLocation(record: RewardsCanadaRecord): boolean {
  const city = record.City?.trim() ?? "";
  const province = record.Province?.trim() ?? "";
  const combined = `${city} ${province}`.toLowerCase();

  if (city.startsWith("*") || province.startsWith("*")) return true;
  if (combined.includes("canada wide") || combined.includes("province wide")) {
    return true;
  }
  return false;
}

/** @deprecated Use isNonMappableLocation */
export function isCanadaWide(record: RewardsCanadaRecord): boolean {
  return isNonMappableLocation(record);
}

export function parseMultiplier(points: number | string): MultiplierValue | null {
  const value = typeof points === "string" ? parseInt(points, 10) : points;
  if (value === 1 || value === 2 || value === 3 || value === 5) {
    return value;
  }
  return null;
}

export function provinceToCode(province: string): string | null {
  const normalized = province.trim().toLowerCase();
  if (normalized.length === 2) return normalized.toUpperCase();
  return PROVINCE_CODES[normalized] ?? null;
}

export function inferCategory(multiplier: MultiplierValue): string {
  if (multiplier === 5) return "restaurant";
  if (multiplier === 2) return "gas";
  if (multiplier === 3) return "entertainment";
  return "retail";
}

export const REWARDS_CANADA_EXTERNAL_PREFIX = "rewards-canada:";

export function isRewardsCanadaImported(
  externalPlaceId: string | null | undefined,
): boolean {
  return (
    typeof externalPlaceId === "string" &&
    externalPlaceId.startsWith(REWARDS_CANADA_EXTERNAL_PREFIX)
  );
}

export function buildExternalPlaceId(
  merchant: string,
  city: string,
  provinceCode: string,
): string {
  const slug = [
    normalizeMerchantName(merchant),
    normalizeMerchantName(city),
    provinceCode.toLowerCase(),
  ].join(":");
  return `${REWARDS_CANADA_EXTERNAL_PREFIX}${slug}`;
}

export function parseRewardsCanadaRecord(
  record: RewardsCanadaRecord,
): ParsedRewardsCanadaPlace | null {
  if (isNonMappableLocation(record)) return null;

  const multiplier = parseMultiplier(record.Points);
  if (!multiplier) return null;

  const name = record.Merchant.trim();
  const city = record.City.trim();
  const provinceName = record.Province.trim();
  const provinceCode = provinceToCode(provinceName);

  if (!name || !city || !provinceCode) return null;

  return {
    name,
    normalizedName: normalizeMerchantName(name),
    city,
    provinceCode,
    provinceName,
    multiplier,
    category: inferCategory(multiplier),
    externalPlaceId: buildExternalPlaceId(name, city, provinceCode),
    addressLine1: name,
    postalCode: "",
    sourceUrl: "https://www.rewardscanada.ca/cobaltmultipliers.html",
  };
}

/** Rewards Canada community list is treated as high-confidence seed data. */
export function confidenceForImport(_multiplier: MultiplierValue): ConfidenceLevel {
  return "high";
}

export async function fetchRewardsCanadaData(
  region: keyof typeof REWARDS_CANADA_SOURCES = "canada",
): Promise<RewardsCanadaRecord[]> {
  const response = await fetch(REWARDS_CANADA_SOURCES[region]);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${region} data: ${response.status}`);
  }
  return response.json() as Promise<RewardsCanadaRecord[]>;
}
