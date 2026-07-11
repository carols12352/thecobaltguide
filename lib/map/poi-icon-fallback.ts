import type maplibregl from "maplibre-gl";

/** Map missing OpenMapTiles POI class names to icons in the OFM sprite. */
export const POI_ICON_ALIASES: Record<string, string> = {
  ferry_terminal: "ferry_11",
  swimming_pool: "swimming_11",
  bicycle_parking: "bicycle_11",
  motorcycle_parking: "bicycle_11",
  recycling: "waste_basket_11",
  sports_centre: "stadium_11",
  ice_rink: "stadium_11",
  ice_hockey: "stadium_11",
  boxing: "stadium_11",
  yoga: "stadium_11",
  running: "stadium_11",
  cycling: "bicycle_11",
  skateboard: "bicycle_11",
  chess: "stadium_11",
  billiards: "stadium_11",
  escape_game: "attraction_11",
  hackerspace: "building_11",
  atm: "bank_11",
  office: "building_11",
  gate: "dot_11",
  lift_gate: "dot_11",
  toll_booth: "dot_11",
  bollard: "dot_11",
  brownfield: "dot_11",
  multi: "shop_11",
};

export const POI_ICON_DEFAULT = "dot_11";

export function resolvePoiIconAlias(iconId: string): string {
  return POI_ICON_ALIASES[iconId] ?? POI_ICON_DEFAULT;
}

function copyStyleImage(
  map: maplibregl.Map,
  sourceId: string,
  targetId: string,
): boolean {
  if (map.hasImage(targetId) || !map.hasImage(sourceId)) return false;

  const image = map.getImage(sourceId);
  map.addImage(targetId, image.data, {
    pixelRatio: image.pixelRatio,
    sdf: image.sdf,
    stretchX: image.stretchX,
    stretchY: image.stretchY,
    content: image.content,
    textFitWidth: image.textFitWidth,
    textFitHeight: image.textFitHeight,
  });
  return true;
}

/** Show a visible POI icon when the basemap style references a missing sprite. */
export function registerPoiIconFallback(map: maplibregl.Map) {
  map.on("styleimagemissing", (event) => {
    if (map.hasImage(event.id)) return;

    const alias = resolvePoiIconAlias(event.id);
    if (copyStyleImage(map, alias, event.id)) return;

    if (alias !== POI_ICON_DEFAULT && copyStyleImage(map, POI_ICON_DEFAULT, event.id)) {
      return;
    }

    map.addImage(event.id, {
      width: 1,
      height: 1,
      data: new Uint8Array(4),
    });
  });
}
