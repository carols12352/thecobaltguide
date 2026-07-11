import { describe, expect, it } from "vitest";
import {
  buildPlacePopupHtml,
  confidencePillClass,
} from "@/lib/map/place-popup";
import type { MapPlace } from "@/types/domain";

const samplePlace: MapPlace = {
  id: "abc-123",
  name: "Test Cafe",
  city: "Toronto",
  province: "ON",
  latitude: 43.65,
  longitude: -79.38,
  multiplier: 5,
  confidenceLevel: "high",
  recentReportCount: 2,
  lastReportedAt: null,
};

describe("place popup", () => {
  it("maps confidence levels to pill classes", () => {
    expect(confidencePillClass("high")).toBe("place-popup-pill-success");
    expect(confidencePillClass("medium")).toBe("place-popup-pill-warning");
    expect(confidencePillClass("disputed")).toBe("place-popup-pill-danger");
    expect(confidencePillClass("insufficient")).toBe("place-popup-pill-muted");
  });

  it("renders pills and report footer link", () => {
    const html = buildPlacePopupHtml(samplePlace);

    expect(html).toContain("place-popup-pill-multiplier");
    expect(html).toContain("place-popup-pill-success");
    expect(html).toContain("Something wrong?");
    expect(html).toContain('href="/place/abc-123"');
    expect(html).toContain(">Report</a>");
  });
});
