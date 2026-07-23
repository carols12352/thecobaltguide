import { getSiteUrl } from "@/lib/site";
import {
  buildSitemapUrlSet,
  buildStaticSitemap,
  provinceFromSitemapId,
} from "@/lib/sitemap";
import {
  latestSitemapModification,
} from "@/server/repositories/public-place-repository";
import { placeRepository } from "@/server/repositories/place-repository";

export const revalidate = 86_400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sitemapId = id.endsWith(".xml") ? id.slice(0, -4) : "";
  const siteUrl = getSiteUrl();

  if (sitemapId === "static") {
    return xmlResponse(buildSitemapUrlSet(buildStaticSitemap(siteUrl)));
  }

  const province = provinceFromSitemapId(sitemapId);
  if (!province) {
    return new Response("Not found", { status: 404 });
  }

  const places = await placeRepository.findActiveForSitemap(province);
  const entries = places.map((place) => ({
    url: new URL(`/place/${place.id}`, siteUrl).toString(),
    lastModified: latestSitemapModification(place),
  }));

  return xmlResponse(buildSitemapUrlSet(entries));
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
