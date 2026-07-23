import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import {
  buildStaticSitemap,
  provinceFromSitemapId,
  SITEMAP_IDS,
} from "@/lib/sitemap";
import {
  latestSitemapModification,
} from "@/server/repositories/public-place-repository";
import { placeRepository } from "@/server/repositories/place-repository";

export const revalidate = 86_400;
export const dynamicParams = false;

export function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const sitemapId = await id;
  const siteUrl = getSiteUrl();

  if (sitemapId === "static") {
    return buildStaticSitemap(siteUrl);
  }

  const province = provinceFromSitemapId(sitemapId);
  if (!province) {
    throw new Error(`Unknown sitemap province: ${sitemapId}`);
  }

  const places = await placeRepository.findActiveForSitemap(province);
  return places.map((place) => ({
    url: new URL(`/place/${place.id}`, siteUrl).toString(),
    lastModified: latestSitemapModification(place),
  }));
}
