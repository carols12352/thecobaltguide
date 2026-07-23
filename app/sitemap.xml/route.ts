import { getSiteUrl } from "@/lib/site";
import { buildSitemapIndex } from "@/lib/sitemap";

export const revalidate = 86_400;

export function GET() {
  return new Response(buildSitemapIndex(getSiteUrl()), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
