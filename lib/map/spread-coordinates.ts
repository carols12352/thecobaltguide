/** Deterministic offset so city-level geocodes don't stack on one point. */
export function spreadCoordinates(
  latitude: number,
  longitude: number,
  seed: string,
  maxOffsetMetres = 1500,
): { latitude: number; longitude: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
    hash |= 0;
  }

  const h1 = Math.abs(hash);
  const h2 = Math.abs(Math.imul(hash, 2_654_435_761));
  const angle = (h1 % 360) * (Math.PI / 180);
  const radiusMetres = 50 + (h2 % 1000) * (maxOffsetMetres / 1000);

  const metresPerDegreeLat = 111_320;
  const metresPerDegreeLng =
    metresPerDegreeLat * Math.cos((latitude * Math.PI) / 180);

  return {
    latitude: latitude + (radiusMetres / metresPerDegreeLat) * Math.sin(angle),
    longitude:
      longitude +
      (radiusMetres / metresPerDegreeLng) * Math.cos(angle),
  };
}
