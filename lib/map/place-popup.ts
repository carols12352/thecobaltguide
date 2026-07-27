import maplibregl from "maplibre-gl";
import { formatConfidence, formatMultiplier, formatPlaceLocation } from "@/lib/utils";
import type { ConfidenceLevel, MapPlace } from "@/types/domain";
import {
  buildExternalMapLinks,
  EXTERNAL_MAP_ICON_URLS,
} from "@/lib/map/external-map-links";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function confidencePillClass(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
    case "recently_confirmed":
      return "place-popup-pill-success";
    case "medium":
      return "place-popup-pill-warning";
    case "disputed":
      return "place-popup-pill-danger";
    default:
      return "place-popup-pill-muted";
  }
}

export function buildPlacePopupHtml(place: MapPlace): string {
  const name = escapeHtml(place.name);
  const location = escapeHtml(formatPlaceLocation(place));
  const multiplier = escapeHtml(formatMultiplier(place.multiplier));
  const confidence = escapeHtml(formatConfidence(place.confidenceLevel));
  const confidenceClass = confidencePillClass(place.confidenceLevel);
  const reportsLabel = escapeHtml(
    `${place.recentReportCount} recent report${place.recentReportCount === 1 ? "" : "s"}`,
  );
  const sourceBadge = place.sourceKind === "rewards_canada"
    ? '<span class="place-popup-pill place-popup-pill-muted" aria-label="Source: Rewards Canada"><span class="place-popup-source-dot" aria-hidden="true"></span>Rewards Canada</span>'
    : "";
  const mapLinks = buildExternalMapLinks({
    latitude: place.latitude,
    longitude: place.longitude,
    label: place.name,
    addressLine1: place.addressLine1,
    city: place.city,
    province: place.province,
  })
    .map(
      (link) =>
        `<a class="place-popup-map-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><img class="place-popup-map-icon" src="${escapeHtml(EXTERNAL_MAP_ICON_URLS[link.provider])}" alt="" aria-hidden="true">${escapeHtml(link.label)}<span class="place-popup-sr-only"> (opens in a new tab)</span></a>`,
    )
    .join("");

  return `
    <div class="place-popup">
      <p class="place-popup-name">${name}</p>
      <p class="place-popup-location">${location}</p>
      <div class="place-popup-pills">
        <span class="place-popup-pill place-popup-pill-multiplier">${multiplier}</span>
        <span class="place-popup-pill ${confidenceClass}">${confidence}</span>
        <span class="place-popup-pill place-popup-pill-muted">${reportsLabel}</span>
        ${sourceBadge}
      </div>
      ${mapLinks ? `<nav class="place-popup-map-links" aria-label="Open ${name} in an external map">${mapLinks}</nav>` : ""}
      <p class="place-popup-footer">
        Something wrong?
        <a class="place-popup-report-link" href="/place/${place.id}">Report</a>
      </p>
    </div>
  `;
}

export function showPlacePopup(
  map: maplibregl.Map,
  place: MapPlace,
  popupRef: { current: maplibregl.Popup | null },
): void {
  popupRef.current?.remove();

  popupRef.current = new maplibregl.Popup({
    offset: 20,
    closeButton: true,
    maxWidth: "320px",
    className: "merchant-place-popup",
  })
    .setLngLat([place.longitude, place.latitude])
    .setHTML(buildPlacePopupHtml(place))
    .addTo(map);
}

export function placeFromGeoJsonFeature(
  feature: GeoJSON.Feature,
): MapPlace | null {
  const props = feature.properties;
  if (!props?.id) return null;

  const coordinates = (feature.geometry as GeoJSON.Point).coordinates;

  return {
    id: String(props.id),
    name: String(props.name ?? ""),
    city: props.city ? String(props.city) : undefined,
    province: props.province ? String(props.province) : undefined,
    latitude: coordinates[1],
    longitude: coordinates[0],
    multiplier:
      props.multiplier != null && props.multiplier !== "?"
        ? (Number(props.multiplier) as MapPlace["multiplier"])
        : null,
    confidenceLevel: (props.confidenceLevel ??
      "insufficient") as MapPlace["confidenceLevel"],
    recentReportCount: Number(props.recentReportCount ?? 0),
    lastReportedAt: null,
    sourceKind:
      props.sourceKind === "rewards_canada" ? "rewards_canada" : "community",
  };
}
