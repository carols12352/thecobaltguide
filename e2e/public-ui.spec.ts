import { expect, test } from "@playwright/test";

test("public discovery routes expose crawler metadata", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Disallow: /account");
  expect(robotsBody).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(sitemapBody).toContain("/map</loc>");
});

test("home remains usable on a narrow viewport without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cobalt card goes further/i })).toBeVisible();

  const mapPreview = page.locator('[data-map-preview-state]');
  await expect(mapPreview).toHaveAttribute("data-map-preview-state", "deferred");
  await mapPreview.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await expect(mapPreview).toHaveAttribute("data-map-preview-state", "active");
  await expect(mapPreview.locator(".maplibregl-map")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Load map preview" })).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByTestId("hero-map-illustration")).toBeHidden();
});

test("desktop home uses three viewport sections and a static hero map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("hero-map-illustration")).toBeVisible();
  const sectionHeights = await page.locator("[data-home-section]").evaluateAll(
    (sections) => sections.map((section) => section.getBoundingClientRect().height),
  );
  expect(sectionHeights).toHaveLength(3);
  for (const height of sectionHeights) expect(height).toBeGreaterThanOrEqual(736);
});

test("reduced-motion preference suppresses decorative entrance motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const duration = await page.locator(".hero-enter").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).animationDuration) || 0,
  );
  expect(duration).toBeLessThanOrEqual(0.001);
});

test("unknown public routes render the safe not-found experience", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist-c3");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page is not on the map." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
});
