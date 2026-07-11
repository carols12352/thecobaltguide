import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

/** Simple name similarity using Jaccard index on word tokens. */
export function nameSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeMerchantName(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeMerchantName(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

export function formatMultiplier(value: number | null | undefined): string {
  if (value == null) return "Unknown";
  return `${value}x`;
}

export function formatConfidence(level: string): string {
  const labels: Record<string, string> = {
    insufficient: "Insufficient data",
    disputed: "Disputed",
    medium: "Medium confidence",
    high: "High confidence",
    recently_confirmed: "Recently confirmed",
  };
  return labels[level] ?? level;
}

export function formatDate(date: string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatPlaceLocation(place: {
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
}): string {
  if (place.city && place.province) {
    return `${place.city}, ${place.province}`;
  }
  if (place.addressLine1) {
    return place.addressLine1;
  }
  return "Location unknown";
}
