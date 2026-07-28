# Location audit experiment

> Recorded 2026-07-28. The experimental Google Places audit code was not
> retained.

## Problem

Some imported merchant points appeared on roads, parking areas, or otherwise
away from the expected storefront. Other imported locations could not be
confidently confirmed as active businesses.

The existing Google Places integration resolves stable Place IDs for external
Google Maps links. An experiment tested whether Text Search (New) could also
audit the imported catalogue at scale.

## What was tried

The experiment searched by merchant name, street address, city, province, and
postal code without trusting the existing coordinates. Results were grouped as
verified, likely coordinate drift, permanently closed, manual review, or no
match.

The samples showed that sequential import order was not representative:

| Sample | Verified | Drift signal | Closed | Manual review | No match | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| First 20 | 2 | 1 | 10 | 7 | 0 | Dominated by older Yogen Früz records |
| Offset 100, 20 rows | 0 | 4 | 6 | 9 | 1 | Still dominated by Yogen Früz, with some Zumiez |
| Offset 500, 20 rows | 16 | 2 | 0 | 2 | 0 | Winners locations; substantially healthier |

An earlier run of the existing coordinate-biased matcher scanned 100 rows and
returned 24 high-confidence matches, 73 manual-review matches, and 3 no-match
results. That matcher was designed to resolve Place IDs near an already trusted
point, so those numbers should not be interpreted as a catalogue-quality
estimate.

## One independently verified correction

The Winners at `1580 Regent Avenue West, Unit A1, Winnipeg, MB`
(`e40cfb38-e26c-4ce0-ac8c-6d1a6c31c8f1`) was flagged as displaced. A separate
OpenStreetMap Nominatim lookup returned a matching Winners department-store POI.
The database point was moved 59 metres:

- Previous: `49.8967938, -97.0662478`
- Corrected: `49.896467, -97.065593`

The write completed successfully, map and search caches were invalidated, and a
database read-back confirmed the corrected coordinates.

## Why the bulk approach was stopped

- The requested fields (`displayName`, `formattedAddress`, `location`, and
  `businessStatus`) trigger the Places API Text Search Pro SKU. As of
  2026-07-28, the monthly free usage cap is 5,000 billable events; the next tier
  is USD 32 per 1,000 events.
- Google Places content has storage and map-display restrictions. Google
  coordinates should not be copied into this project's MapLibre catalogue.
  Place IDs are the relevant long-term storage exception.
- Ordered samples can be badly skewed by brand and import age. A useful quality
  study would need stratified sampling by brand, province, source age, and
  confidence.
- The expected benefit did not justify a paid catalogue-wide audit or the
  operational and licensing complexity.

References:

- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Places Text Search field-mask billing](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Places API policies and storage exceptions](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)

## Decision

Do not ship or schedule the experimental Google audit. Keep the existing
server-only Place ID resolution for precise external Google Maps links. For
future coordinate-quality work, prefer current Overture releases or another
map-compatible source, use representative stratified samples, and require
independent evidence before changing a point.
