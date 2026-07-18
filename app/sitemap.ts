import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { placeRepository } from "@/server/repositories/place-repository";

export const revalidate = 86_400;

const PUBLIC_ROUTES = ["", "/map", "/about", "/privacy", "/terms"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((path) => ({
    url: new URL(path || "/", siteUrl).toString(),
    changeFrequency: path === "/map" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/map" ? 0.9 : 0.5,
  }));

  try {
    const places = await placeRepository.findActiveForSitemap();
    return [
      ...staticEntries,
      ...places.map((place) => ({
        url: new URL(`/place/${place.id}`, siteUrl).toString(),
        lastModified: place.updated_at,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
