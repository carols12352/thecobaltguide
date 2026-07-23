import { describe, expect, it, vi } from "vitest";
import {
  buildSitemapIndex,
  buildStaticSitemap,
  CANADIAN_PROVINCE_CODES,
  provinceFromSitemapId,
  SITEMAP_IDS,
} from "@/lib/sitemap";
import {
  collectSitemapPages,
  latestSitemapModification,
  type SitemapPlaceRow,
} from "@/server/repositories/public-place-repository";

function sitemapPlace(id: string, updatedAt = "2026-07-01T00:00:00Z"): SitemapPlaceRow {
  return {
    id,
    updated_at: updatedAt,
    place_multiplier_summaries: [],
  };
}

describe("sitemap configuration", () => {
  it("creates one static and one child sitemap per province or territory", () => {
    expect(SITEMAP_IDS).toHaveLength(CANADIAN_PROVINCE_CODES.length + 1);
    expect(SITEMAP_IDS).toContain("static");
    expect(SITEMAP_IDS).toContain("on");
    expect(SITEMAP_IDS).toContain("nu");
  });

  it("builds a root index containing every child sitemap URL", () => {
    const xml = buildSitemapIndex(new URL("https://example.com"));

    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    for (const id of SITEMAP_IDS) {
      expect(xml).toContain(
        `<loc>https://example.com/sitemaps/sitemap/${id}.xml</loc>`,
      );
    }
    expect(xml.match(/<sitemap>/g)).toHaveLength(SITEMAP_IDS.length);
  });

  it("keeps static routes separate and validates province IDs", () => {
    const sitemap = buildStaticSitemap(new URL("https://example.com"));

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://example.com/",
      "https://example.com/map",
      "https://example.com/about",
      "https://example.com/privacy",
      "https://example.com/terms",
    ]);
    expect(provinceFromSitemapId("on")).toBe("ON");
    expect(provinceFromSitemapId("invalid")).toBeNull();
  });
});

describe("sitemap pagination", () => {
  it("collects every page until the data source is exhausted", async () => {
    const rows = Array.from({ length: 2_501 }, (_, index) =>
      sitemapPlace(String(index + 1).padStart(5, "0")),
    );
    const fetchPage = vi.fn(async (afterId: string | null) => {
      const start = afterId
        ? rows.findIndex((row) => row.id === afterId) + 1
        : 0;
      return rows.slice(start, start + 1_000);
    });

    const result = await collectSitemapPages(fetchPage);

    expect(result).toEqual(rows);
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(fetchPage.mock.calls.map(([afterId]) => afterId)).toEqual([
      null,
      "01000",
      "02000",
      "02501",
    ]);
  });

  it("propagates page failures instead of returning a partial sitemap", async () => {
    const fetchPage = vi
      .fn<(afterId: string | null) => Promise<SitemapPlaceRow[]>>()
      .mockResolvedValueOnce([sitemapPlace("00001")])
      .mockRejectedValueOnce(new Error("database unavailable"));

    await expect(collectSitemapPages(fetchPage)).rejects.toThrow(
      "database unavailable",
    );
  });

  it("uses the latest visible place or summary modification", () => {
    expect(
      latestSitemapModification({
        ...sitemapPlace("00001", "2026-07-01T00:00:00Z"),
        place_multiplier_summaries: [
          { updated_at: "2026-07-03T00:00:00Z" },
          { updated_at: "2026-07-02T00:00:00Z" },
        ],
      }),
    ).toBe("2026-07-03T00:00:00Z");
  });
});
