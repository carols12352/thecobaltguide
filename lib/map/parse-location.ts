/** Parse PostGIS HEXEWKB Point (Supabase default geography output). */
function parseHexEwkbPoint(
  hex: string,
): { latitude: number; longitude: number } | null {
  const normalized = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length < 42) {
    return null;
  }

  const buf = Buffer.from(normalized, "hex");
  if (buf.length < 21) return null;

  const littleEndian = buf[0] === 1;
  const readUInt32 = littleEndian
    ? (offset: number) => buf.readUInt32LE(offset)
    : (offset: number) => buf.readUInt32BE(offset);
  const readDouble = littleEndian
    ? (offset: number) => buf.readDoubleLE(offset)
    : (offset: number) => buf.readDoubleBE(offset);

  const type = readUInt32(1);
  const baseType = type & 0xff;
  if (baseType !== 1) return null;

  let offset = 5;
  if ((type & 0x20000000) !== 0) offset += 4;

  const longitude = readDouble(offset);
  offset += 8;
  const latitude = readDouble(offset);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function parseGeoJsonLocation(
  value: unknown,
): { latitude: number; longitude: number } | null {
  if (!value || typeof value !== "object" || !("coordinates" in value)) {
    return null;
  }

  const coordinates = (value as { coordinates?: number[] }).coordinates;
  if (coordinates?.length !== 2) return null;

  return {
    longitude: coordinates[0],
    latitude: coordinates[1],
  };
}

/** Parse Supabase/PostGIS location values into lat/lng. */
export function parseGeoLocation(
  location: unknown,
): { latitude: number; longitude: number } | null {
  if (!location) return null;

  if (typeof location === "string") {
    const trimmed = location.trim();

    if (/^[0-9a-fA-F]+$/.test(trimmed)) {
      return parseHexEwkbPoint(trimmed);
    }

    try {
      const parsed = JSON.parse(trimmed) as { coordinates?: number[] };
      const geoJson = parseGeoJsonLocation(parsed);
      if (geoJson) return geoJson;
    } catch {
      const match = trimmed.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
      if (match) {
        return {
          longitude: parseFloat(match[1]),
          latitude: parseFloat(match[2]),
        };
      }
    }

    return null;
  }

  return parseGeoJsonLocation(location);
}
