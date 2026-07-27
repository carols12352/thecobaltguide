import { expect, test } from "@playwright/test";

test("map search shows Rewards Canada provenance", async ({ page }) => {
  await page.route("**/api/places/search?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        places: [
          {
            id: "rewards-canada-place",
            name: "Source Test Market",
            addressLine1: "1 King St",
            city: "Toronto",
            province: "ON",
            latitude: 43.65,
            longitude: -79.38,
            multiplier: 5,
            confidenceLevel: "high",
            recentReportCount: 0,
            lastReportedAt: null,
            category: "grocery",
            sourceKind: "rewards_canada",
          },
        ],
      }),
    }),
  );

  await page.goto("/map");
  await page.getByLabel("Search merchants").fill("Source Test Market");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByText("Source Test Market", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Source: Rewards Canada"),
  ).toBeVisible();
});

test("login hydrates cleanly with a stored last-used method", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login");
  await page.evaluate(() => {
    window.localStorage.setItem("cobalt-last-used-auth-method", "google");
  });
  await page.reload();

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("cobalt-last-used-auth-method"),
      ),
    )
    .toBe("google");
  expect(
    browserErrors.filter((message) => message.includes("Hydration failed")),
  ).toEqual([]);
  await expect(page.getByText("Last used", { exact: true })).toBeVisible();
});

test("public discovery routes expose crawler metadata", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("Disallow: /account");
  expect(robotsBody).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("<sitemapindex");
  expect(sitemapBody).toContain("/sitemaps/static.xml</loc>");
  expect(sitemapBody).toContain("/sitemaps/on.xml</loc>");

  const staticSitemap = await request.get("/sitemaps/static.xml");
  expect(staticSitemap.ok()).toBe(true);
  const staticSitemapBody = await staticSitemap.text();
  expect(staticSitemapBody).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(staticSitemapBody).toContain("/map</loc>");
});

test("home remains usable on a narrow viewport without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cobalt card goes further/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the map", exact: true }).first()).toHaveAttribute("href", "/map");
  await expect(page.getByText("Community-reported merchant multipliers across Canada, with recency and confidence context.")).toHaveCount(0);

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
  await expect(page.getByTestId("hero-map-illustration")).toBeVisible();
});

test("desktop home uses two full visual sections and a compact detail section", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("hero-map-illustration")).toBeVisible();
  const sectionHeights = await page.locator("[data-home-section]").evaluateAll(
    (sections) => sections.map((section) => section.getBoundingClientRect().height),
  );
  expect(sectionHeights).toHaveLength(3);
  expect(sectionHeights[0]).toBeGreaterThanOrEqual(736);
  expect(sectionHeights[1]).toBeGreaterThanOrEqual(736);
  expect(sectionHeights[2]).toBeGreaterThanOrEqual(420);
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
