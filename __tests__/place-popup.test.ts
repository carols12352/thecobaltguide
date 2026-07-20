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

  it("renders pills, safe external map links, and the report footer link", () => {
    const html = buildPlacePopupHtml(samplePlace);

    expect(html).toContain("place-popup-pill-multiplier");
    expect(html).toContain("place-popup-pill-success");
    expect(html).toContain("Something wrong?");
    expect(html).toContain('href="/place/abc-123"');
    expect(html).toContain(">Report</a>");
    expect(html).toContain("Google Maps");
    expect(html).toContain("Apple Maps");
    expect(html).not.toContain("OpenStreetMap");
    expect(html).toContain("https://cdn.simpleicons.org/googlemaps");
    expect(html).toContain("https://cdn.simpleicons.org/apple/71717A");
    expect(html).not.toContain("↗");
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html).toContain("43.650000%2C-79.380000");
  });

  it("escapes a merchant name used in popup labels", () => {
    const html = buildPlacePopupHtml({
      ...samplePlace,
      name: 'Cafe <script>alert("x")</script>',
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("%3Cscript%3E");
  });
});
