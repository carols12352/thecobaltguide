import type { MetadataRoute } from "next";

export const CANADIAN_PROVINCE_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;

export type CanadianProvinceCode = (typeof CANADIAN_PROVINCE_CODES)[number];

export const SITEMAP_IDS = [
  "static",
  ...CANADIAN_PROVINCE_CODES.map((province) => province.toLowerCase()),
] as const;

export const PUBLIC_SITEMAP_ROUTES = [
  "",
  "/map",
  "/about",
  "/privacy",
  "/terms",
] as const;

export function provinceFromSitemapId(
  id: string,
): CanadianProvinceCode | null {
  const province = id.toUpperCase();
  return CANADIAN_PROVINCE_CODES.find((candidate) => candidate === province) ?? null;
}

export function buildStaticSitemap(siteUrl: URL): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_ROUTES.map((path) => ({
    url: new URL(path || "/", siteUrl).toString(),
  }));
}

export function sitemapUrl(siteUrl: URL, id: string): string {
  return new URL(`/sitemaps/sitemap/${id}.xml`, siteUrl).toString();
}

export function buildSitemapIndex(siteUrl: URL): string {
  const entries = SITEMAP_IDS.map(
    (id) => `<sitemap><loc>${escapeXml(sitemapUrl(siteUrl, id))}</loc></sitemap>`,
  ).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>",
  ].join("");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
