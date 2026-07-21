import { ImageResponse } from "next/og";

export const alt = "The Cobalt Guide — Cobalt merchant multipliers across Canada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#09090b",
        color: "#fafafa",
        display: "flex",
        height: "100%",
        padding: "72px",
        width: "100%",
      }}
    >
      <div
        style={{
          borderLeft: "12px solid #2563eb",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "10px 0 10px 48px",
          width: "100%",
        }}
      >
        <div style={{ color: "#93c5fd", display: "flex", fontSize: 28, letterSpacing: 5 }}>
          COMMUNITY DATA · CANADA
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, letterSpacing: -4 }}>
            The Cobalt Guide
          </div>
          <div style={{ color: "#d4d4d8", display: "flex", fontSize: 36, marginTop: 20 }}>
            Find where your Cobalt card goes further.
          </div>
        </div>
        <div style={{ color: "#a1a1aa", display: "flex", fontSize: 24 }}>
          Find Cobalt merchant multipliers across Canada
        </div>
      </div>
    </div>,
    size,
  );
}
