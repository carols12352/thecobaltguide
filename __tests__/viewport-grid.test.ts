import { describe, expect, it } from "vitest";
import {
  alignViewportToGrid,
  boundsContains,
  boundsToGridKey,
  filterPlacesInBounds,
  getGridStepDegrees,
  gridKeyForBounds,
  mapViewportFromQuery,
  normalizeBoundsToGrid,
} from "@/lib/map/viewport-grid";

const ALL_ZOOM_LEVELS = [8, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;
const ALL_STEPS = [0.2, 0.1, 0.05, 0.025, 0.0125] as const;

function gridIndex(value: number, step: number): number {
  return Math.round(value * Math.round(1 / step));
}

function gridValue(index: number, step: number): number {
  return index / Math.round(1 / step);
}

function zoomForStep(step: number): number {
  return ALL_ZOOM_LEVELS.find((zoom) => getGridStepDegrees(zoom) === step) ?? 13;
}

function expectOutwardContains(
  raw: { north: number; south: number; east: number; west: number },
  normalized: { north: number; south: number; east: number; west: number },
) {
  expect(normalized.north).toBeGreaterThanOrEqual(raw.north);
  expect(normalized.south).toBeLessThanOrEqual(raw.south);
  expect(normalized.east).toBeGreaterThanOrEqual(raw.east);
  expect(normalized.west).toBeLessThanOrEqual(raw.west);
}

function randomBounds(seed: number) {
  const rand = (offset: number) => {
    const x = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const latA = rand(1) * 170 - 85;
  const latB = rand(2) * 170 - 85;
  const lngA = rand(3) * 340 - 170;
  const lngB = rand(4) * 340 - 170;
  return {
    north: Math.max(latA, latB),
    south: Math.min(latA, latB),
    east: Math.max(lngA, lngB),
    west: Math.min(lngA, lngB),
  };
}

describe("viewport grid", () => {
  it("uses coarser cells when zoomed out", () => {
    expect(getGridStepDegrees(10)).toBeGreaterThan(getGridStepDegrees(14));
  });

  it("aligns nearby viewports to the same grid key", () => {
    const a = alignViewportToGrid({
      north: 43.6731,
      south: 43.6333,
      east: -79.3441,
      west: -79.4223,
      zoom: 13,
    });
    const b = alignViewportToGrid({
      north: 43.6734,
      south: 43.6331,
      east: -79.3438,
      west: -79.4226,
      zoom: 13,
    });

    expect(a.gridKey).toBe(b.gridKey);
    expect(a.north).toBeGreaterThanOrEqual(43.6734);
    expect(a.south).toBeLessThanOrEqual(43.6331);
  });

  it("detects when the current viewport is still inside fetched bounds", () => {
    const fetched = alignViewportToGrid({
      north: 43.68,
      south: 43.63,
      east: -79.34,
      west: -79.43,
      zoom: 13,
    });

    expect(
      boundsContains(fetched, {
        north: 43.67,
        south: 43.64,
        east: -79.35,
        west: -79.42,
      }),
    ).toBe(true);

    expect(
      boundsContains(fetched, {
        north: 43.8,
        south: 43.76,
        east: -79.34,
        west: -79.43,
      }),
    ).toBe(false);
  });

  it("filters places to the current map viewport", () => {
    const bounds = {
      north: 43.7,
      south: 43.6,
      east: -79.3,
      west: -79.5,
    };
    const places = [
      { id: "in", latitude: 43.65, longitude: -79.4 },
      { id: "out", latitude: 43.8, longitude: -79.4 },
    ];

    expect(filterPlacesInBounds(places, bounds).map((place) => place.id)).toEqual(["in"]);
  });

  it("derives the same grid key from client-aligned bounds without re-padding", () => {
    const aligned = alignViewportToGrid({
      north: 43.6731,
      south: 43.6333,
      east: -79.3441,
      west: -79.4223,
      zoom: 13,
    });

    expect(gridKeyForBounds(aligned, aligned.zoom)).toBe(aligned.gridKey);

    const resolved = mapViewportFromQuery({
      north: aligned.north,
      south: aligned.south,
      east: aligned.east,
      west: aligned.west,
      zoom: aligned.zoom,
    });

    expect(resolved.gridKey).toBe(aligned.gridKey);
    expect(resolved.bounds).toEqual({
      north: aligned.north,
      south: aligned.south,
      east: aligned.east,
      west: aligned.west,
    });
  });

  it("collapses bounds that share a grid key but differ in query range", () => {
    const zoom = 13;
    const looseA = { north: 43.701, south: 43.651, east: -79.339, west: -79.419, zoom };
    const looseB = { north: 43.724, south: 43.674, east: -79.341, west: -79.421, zoom };

    expect(gridKeyForBounds(looseA, zoom)).toBe(gridKeyForBounds(looseB, zoom));

    const resolvedA = mapViewportFromQuery(looseA);
    const resolvedB = mapViewportFromQuery(looseB);

    expect(resolvedA.gridKey).toBe(resolvedB.gridKey);
    expect(resolvedA.bounds).toEqual(resolvedB.bounds);
  });

  describe("integer grid math", () => {
    it("keeps -17.45 on the grid under repeated outward snap", () => {
      const west = -17.45;
      const once = normalizeBoundsToGrid(
        { north: 17.4, south: -17.4, east: 17.45, west },
        13,
      );
      const twice = normalizeBoundsToGrid(once, 13);

      expect(once.west).toBe(west);
      expect(twice).toEqual(once);
    });

    it("maps 17.4 to grid index 348, not 347", () => {
      const step = 0.05;
      const bounds = {
        north: 17.4,
        south: 17.35,
        east: 17.4,
        west: 17.35,
      };

      expect(gridIndex(bounds.north, step)).toBe(348);
      expect(boundsToGridKey(bounds, 13, step)).toBe("13:347-348:347-348");
    });

    it.each(ALL_STEPS)("is idempotent on aligned lat/lng samples for step %s", (step) => {
      const zoom = zoomForStep(step);
      const scale = Math.round(1 / step);
      const latMax = Math.floor(90 * scale);
      const lngMax = Math.floor(180 * scale);

      for (let sample = 0; sample < 250; sample += 1) {
        const lat = Math.floor((sample * 17) % (latMax * 2 + 1)) - latMax;
        const lng = Math.floor((sample * 31) % (lngMax * 2 + 1)) - lngMax;
        const bounds = {
          north: gridValue(lat, step),
          south: gridValue(lat, step),
          east: gridValue(lng, step),
          west: gridValue(lng, step),
        };
        const once = normalizeBoundsToGrid(bounds, zoom);
        const twice = normalizeBoundsToGrid(once, zoom);
        expect(twice).toEqual(once);
      }
    });

    it.each(ALL_ZOOM_LEVELS)(
      "normalize(normalize(bounds)) equals normalize(bounds) at zoom %s",
      (zoom) => {
        for (let seed = 0; seed < 40; seed += 1) {
          const bounds = randomBounds(seed + zoom * 100);
          const once = normalizeBoundsToGrid(bounds, zoom);
          const twice = normalizeBoundsToGrid(once, zoom);
          expect(twice).toEqual(once);
        }
      },
    );

    it.each(ALL_ZOOM_LEVELS)(
      "assigns distinct keys to horizontally adjacent normalized cells at zoom %s",
      (zoom) => {
        const step = getGridStepDegrees(zoom);
        const baseLng = -79.45;
        const baseIndex = gridIndex(baseLng, step);

        const left = normalizeBoundsToGrid(
          {
            north: 43.75,
            south: 43.7,
            east: gridValue(baseIndex, step),
            west: gridValue(baseIndex - 1, step),
          },
          zoom,
        );
        const right = normalizeBoundsToGrid(
          {
            north: 43.75,
            south: 43.7,
            east: gridValue(baseIndex + 1, step),
            west: gridValue(baseIndex, step),
          },
          zoom,
        );

        expect(gridKeyForBounds(left, zoom)).not.toBe(gridKeyForBounds(right, zoom));
      },
    );

    it("property test: random coordinates stay stable after second normalize", () => {
      for (let seed = 0; seed < 300; seed += 1) {
        const zoom = ALL_ZOOM_LEVELS[seed % ALL_ZOOM_LEVELS.length];
        const bounds = randomBounds(seed * 1.37);
        const once = normalizeBoundsToGrid(bounds, zoom);
        const twice = normalizeBoundsToGrid(once, zoom);
        expect(twice).toEqual(once);
        expectOutwardContains(bounds, once);
      }
    });
  });
});
