# Query and cache baseline

Last contract review: 2026-07-16. Latency numbers are environment-specific and
must not be copied between local, Preview, and Production.

## Stable query bounds

| Read path | Database boundary | Result cap | CDN / Redis |
| --- | --- | ---: | --- |
| Neighbourhood map | `places_in_viewport` | 200 | 120s / 24h |
| Wide map | `places_in_viewport` | 500 | 120s / 24h |
| Viewport list | `places_in_view_near` | configured map max | 60s / 5m |
| Place search | indexed `places` lookup | 20 | 120s / 5m |
| Place detail | place plus one card summary | 1 | 120s / 24h |

The live RLS suite verifies public RPC caps. Unit tests in
`__tests__/place-service-cache.test.ts` verify cache-hit bypass, cache-miss
population, versioned invalidation, and the truncated viewport supplement.

## Recording latency

Run against the environment being evaluated:

```bash
BASELINE_BASE_URL=https://preview.example.com npm run baseline:api
```

The command prints JSON lines with request count, p50/p95 wall time,
`Cache-Control`, and the latest `Server-Timing` breakdown. Save the output with
the release evidence rather than committing environment-specific values. Use at
least 20 warm samples and compare the same paths, region, database size, and
cache state. A topology change requires evidence from this measurement plus the
Sentry `map.query.duration_ms` and Redis hit/miss metrics.

## GitHub Actions

Maintainers, organization members, and repository collaborators can run the
dedicated workflow in either of these ways:

- Comment on a pull request: `/performance https://preview.example.com`
- Optionally choose 5–100 samples: `/performance https://preview.example.com 30`
- Open Actions → Performance baseline → Run workflow and enter the target URL.

The longer `/performance-baseline` command remains available as an alias.

PR-triggered runs reply with a result table and workflow link. Every run also
writes the table to the job summary and retains the JSONL result as an artifact
for 14 days. The target may use any public HTTP(S) host; it is not restricted to
Vercel. For runner security, credentials, redirects, localhost, private IPs,
link-local addresses, and non-routable targets are rejected. Local measurements
can opt in explicitly with `BASELINE_ALLOW_PRIVATE_NETWORK=true`.
