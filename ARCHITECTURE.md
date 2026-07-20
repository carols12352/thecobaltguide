# Cobalt Merchant Map — Architecture

> Last reviewed: 2026-07-20 for Stage D documentation and pre-release tracking.
>
> Source of truth: application code and `supabase/migrations/`. This document explains current boundaries, release gates, and deferred product opportunities.

## 1. Architecture decision

The application is a **modular monolith**:

- Next.js App Router serves pages and Route Handler APIs.
- Services own business rules, orchestration, aggregation, and cache coordination.
- Repositories own Supabase queries and transactional PostgreSQL RPC calls.
- Supabase provides Auth, PostgreSQL, PostGIS, and Row Level Security (RLS).
- Upstash Redis is configured in the deployed environment for distributed cache and rate limiting; local development still supports the documented in-memory/direct-database fallback.
- Mapbox and Nominatim provide synchronous geocoding behind one provider boundary.
- Google Places optionally resolves stable merchant identifiers server-side; Google Maps and Apple Maps receive destination-only HTTPS links from a browser-safe URL builder.

One deployable application is the right topology for the current product, team, and transaction model. There is no measured need for microservices, Kubernetes, a read replica, a dedicated search service, or vector tiles.

## 2. Current snapshot

| Measure | Current state |
| --- | --- |
| TypeScript/TSX | About 18.2k lines |
| Route Handlers | 25 |
| Database | One Supabase PostgreSQL database with PostGIS |
| Unit baseline | 56 files / 266 Vitest tests |
| Live database coverage | 16 RLS/grant tests and 3 transactional integration tests passed on `main@0b11f58` in GitHub Actions |
| Browser coverage | Six fixture-free Playwright cases pass locally; the environment-backed critical path passed on `main@0b11f58` and now includes dialog focus verification when fixtures are present |
| CI | Lint, typecheck, unit tests, build, live database suites, E2E, architecture assertions, Lighthouse budgets, and on-demand API performance baselines |
| Cache/limits | Upstash Redis is active in deployment; dashboard traffic and Sentry child spans verify runtime cache use, while invalidation and fallback evidence remains open |
| Monitoring | Sentry server tracing/error ingestion is active in deployment; privacy-filtered browser instrumentation is implemented and awaits deployed ingestion verification |

These numbers are a point-in-time orientation aid, not architecture targets.

## 3. Runtime context

```text
Browser
  ├─ Server-rendered pages and client components
  ├─ Supabase Auth client
  ├─ Destination-only Google Maps / Apple Maps links
  └─ /api/* requests
          │
          ▼
Next.js modular monolith
  ├─ Route Handlers: auth, input validation, HTTP response contracts
  ├─ Services: domain orchestration, aggregation, caching
  ├─ Repositories: Supabase reads/writes and Postgres RPCs
  └─ Provider clients: Mapbox/Nominatim geocoding and optional Google Place ID resolution
          │
          ├──────────────► Upstash Redis (configured in deployment)
          │                 cache and distributed limits
          ▼
Supabase
  ├─ Auth
  ├─ PostgreSQL + PostGIS
  └─ RLS, grants, and function ACLs
```

The normal server dependency direction is:

```text
app/api/*/route.ts → server/services/* → server/repositories/* → Supabase
```

Routes authenticate, validate with Zod, and translate errors to stable HTTP responses. Services must not depend on route modules. Repositories must not contain UI or HTTP response logic.

## 4. Code ownership

| Area | Responsibility |
| --- | --- |
| `app/` | App Router pages, layouts, loading UI, and Route Handlers |
| `components/` | Feature UI and reusable controls |
| `config/` | Product constants and merchant categories |
| `lib/` | Shared/browser-safe domain, cache, auth, map, and validation helpers |
| `server/services/` | Business rules and use-case orchestration |
| `server/repositories/` | Database projections, writes, and transactional boundaries |
| `server/geocoding/` | Third-party provider transport and mapping |
| `server/validation/` | Server request schemas |
| `supabase/migrations/` | Authoritative schema, functions, grants, RLS, and indexes |
| `supabase/scripts/` | Explicit operational data tooling, not application runtime |
| `__tests__/`, `supabase/tests/`, `e2e/` | Unit, live database, and browser verification |

Large interactive components may keep local API models and presentation-only pieces beside the owning component. Shared product types belong in `types/domain.ts`; server-only database row shapes stay in repositories.

## 5. Product modules

| Module | Implemented behavior | Main owners |
| --- | --- | --- |
| Map discovery | Aligned viewport grids, clustering data, exact count/list supplement, filters and distance sorting | `merchant-map.tsx`, `place-service.ts`, PostGIS RPCs |
| Places | Search, detail, duplicate detection, authenticated creation | place service/repositories |
| Reports | Submission, classification, aggregation, grouped history, limited self-removal | report/summary services and transaction repository |
| Flags/moderation | Grouped flags, report review, place editing/merging, user administration, audit rows | moderation service and repositories |
| Reputation | Submission and moderation score changes, low-score write block | reputation service and scoring helpers |
| Accounts/auth | Supabase sign-in methods, roles, suspension, recent activity | auth helpers, account routes/components |
| Geocoding | Structured/reverse lookup, provider ranking, city filtering, fallback | geocoding service/provider client |
| External navigation | Validated Google Maps/Apple Maps links and optional Google Place ID resolution | map URL helper, place services/repositories, Google Places client |
| Cache/limits | CDN headers, Redis cache, version invalidation, Redis/in-memory quotas | cache and rate-limit helpers |

The schema carries `card_product_id`, but the current product experience and fixtures prove only one active product: Amex Cobalt.

## 6. Data, consistency, and security

### Core data

- `profiles`: role, status, reputation, and contribution counts.
- `merchant_brands`: optional shared merchant identity.
- `card_products`: card definitions; seeded with Amex Cobalt.
- `places`: physical locations with PostGIS geography and an optional Google Place ID used only for precise Google Maps links.
- `multiplier_reports`: raw community evidence and moderation state.
- `place_multiplier_summaries`: precomputed place/card result.
- `merchant_multiplier_coverages`: non-point geographic coverage.
- `online_merchant_multipliers`: online-only merchants.
- `place_flags`: community corrections.
- `moderation_logs`: staff audit trail.
- Rewards Canada staging tables: service-role-only input to atomic replacement.

Migrations are append-only and authoritative. Application projections must be updated with schema changes.

### Authorization boundary

- Public reads expose bounded API projections, not raw tables.
- User writes require `requireAuth`; staff operations require `requireModerator` or `requireAdmin`.
- Zod validates request input before service calls.
- Corrective migrations `20260714120000`–`20260714170000` enforce least privilege through RLS, grants, function ACLs, bounded public RPCs, and removal of unused legacy functions.
- Secret/service-role credentials remain server-only.

### Atomic workflows

Migration `20260715120000_transactional_write_workflows.sql` defines service-role-only transactional functions for:

- report submission/deletion with profile and summary changes;
- report moderation with reputation, review metadata, and audit rows;
- grouped place-flag resolution with per-reporter reputation changes;
- place merging with report/flag reassignment, source status, summaries, and audit rows.

Expected mutation failures use stable codes such as `VALIDATION_ERROR`, `CONFLICT`, `FORBIDDEN`, and `NOT_FOUND`. Repeated state transitions are idempotent where required; a duplicate same-user/place/day report returns HTTP 409 without a second write.

Cache invalidation is best-effort after the authoritative transaction commits. Any future asynchronous authoritative work must use a durable outbox/job record, not an untracked background promise.

## 7. Read and cache paths

### Map reads

1. `GET /api/places/map` aligns and pads the viewport into a reusable grid.
2. Redis is checked when configured.
3. A bounded PostGIS RPC returns up to 200 neighbourhood points or 500 wider-view cluster points.
4. `GET /api/places/viewport` optionally adds an exact count and bounded distance-sorted list.
5. The client filters loaded points while moving and requests a new grid only after crossing cached bounds.

### Cache policy

| Data | CDN TTL | Redis TTL |
| --- | ---: | ---: |
| Grid map region | 120 seconds | 24 hours |
| Viewport details | 60 seconds | 5 minutes |
| Place detail | 120 seconds | 24 hours |
| Search | 120 seconds | 5 minutes |

Global cache versions allow mutations to bypass stale map/search data without scanning Redis keys. Without Redis, the application remains functional; reads go to Supabase and rate limiting becomes process-local.

Public map responses expose `Server-Timing` for Redis and database diagnosis. Repeatable sampling is documented in `docs/performance-baseline.md`.

Deployment evidence on 2026-07-17 shows sustained Upstash command traffic/storage and Sentry child spans from map/viewport requests to the Upstash pipeline. This verifies that the deployed application is exercising the Redis path and provides observed cache-hit evidence. Full cache acceptance still requires version-bump invalidation after report and moderation mutations, distributed rate-limit verification, and graceful fallback when Redis is unavailable. Both the write token and read-only token are required for the intended production behavior.

## 8. External systems and deployment

### External map navigation

External navigation is an optional exit from the in-app MapLibre experience, not a routing or device-location feature.

```text
Place API projection
  name + address + WGS84 latitude/longitude + optional google_place_id
          │
          ▼
lib/map/external-map-links.ts
  validate ranges → fix to 6 decimals → URL/URLSearchParams encode
          │
          ├────────► Google Maps search URL
          │           query_place_id + coordinates when an ID exists
          │           encoded name/address query otherwise
          └────────► Apple Maps URL
                      coordinates + merchant label
```

- Google Maps and Apple Maps are the only external providers exposed. OpenStreetMap is not part of the Stage D external-navigation UI.
- Invalid, missing, non-finite, or out-of-range coordinates produce no actionable link.
- The application does not request the user's location, select an origin, construct a route, inspect a provider account, or add navigation analytics.
- Links use ordinary HTTPS endpoints, accessible provider labels, `target="_blank"`, and `rel="noopener noreferrer"`.
- Provider icons are fetched by the browser from Simple Icons' CDN. They are presentation-only; link generation and navigation remain usable independently of icon loading.

Migration `20260720190000_google_place_ids.sql` adds nullable `places.google_place_id` plus a partial index for populated values. New or moderated places can resolve a Place ID through `server/geocoding/google-places.ts`: the server sends a text query and a 100-metre coordinate bias to Places API (New), requests the candidate ID plus the minimum identity/location fields needed for confidence checks, and applies a five-second timeout. A missing key, provider error, timeout, empty result, or ambiguous candidate returns `null` and does not block the authoritative place write.

Existing records use the explicit `supabase/scripts/backfill-google-place-ids.ts` operation. It scans at most 100 records by default, caps a run at 1,000, and classifies candidates by merchant-name similarity, coordinate distance, postal code, and street number. Even with `--write`, only high-confidence candidates within 150 metres are stored; ambiguous and unmatched records remain null and continue using the external-link URL fallback until corrected through community reports or later maintenance. Writes target still-null IDs and invalidate place/admin caches.

### Geocoding

- Geocode routes require authentication and enforce per-IP and per-user quotas.
- Forward/reverse queries are hashed and cached for one hour.
- Provider calls use four-second timeouts.
- Mapbox receives one bounded retry for network/server failures; Nominatim is not retried.
- Provider failures, duration, timeout, and fallback behavior emit operational metrics.

### Monitoring

The Sentry deployment credentials, Next.js server SDK, and request-error instrumentation are configured. Production traces observed on 2026-07-17 include Next.js page/API transactions and child spans for Upstash and Supabase calls, verifying server ingestion and tracing. Structured JSON logs continue as a fallback. `instrumentation-client.ts` now initializes the browser SDK only in production, disables default PII, samples navigation traces, and sanitizes user/request/cookie/auth/query and sensitive breadcrumb/span data. Deployed client-event ingestion still requires an operator spot-check.

The production project also shows a real captured error and an Error Monitor with an active alert rule, completing the C1 ingestion/alert evidence. Readable TypeScript source maps and release-to-commit correlation should still be spot-checked when investigating an error, but they no longer block C1 acceptance. Session Replay is not required; if introduced later, sensitive account, address, and report fields must be masked by default.

### Open-source maintenance boundary

Stage D adds the minimum public-maintenance surface:

- `LICENSE` applies AGPL-3.0-only to the repository's original application code;
- `CONTRIBUTING.md` defines setup, verification, PR expectations, merchant corrections, and third-party material boundaries;
- `CODE_OF_CONDUCT.md` uses the Contributor Covenant with `support@sicheng.dev` as the enforcement contact;
- `SECURITY.md` directs vulnerabilities to GitHub private vulnerability reporting, with `support@sicheng.dev` as the fallback contact;
- issue forms prevent public disclosure of receipts, account information, credentials, and other personal data;
- the PR template records scope, verification, migration, security/privacy, screenshots, and issue linkage.

The application license does not relicense third-party merchant data, map data/tiles, provider content, names, logos, or trademarks. Provider calls and linked services remain subject to their own terms. GitHub private vulnerability reporting was verified enabled during Stage D.

### Stage D release status

| Phase | Status | Acceptance evidence |
| --- | --- | --- |
| D1 — external navigation | Implemented in PR #10 | URL/Place ID unit tests, popup/detail coverage, migration and preview-first backfill tooling |
| D2 — open-source maintenance | Implemented in PR #10 | License, policies, templates, labels, and private vulnerability reporting |
| D3 — documentation | Complete on `stage-D` | README and this architecture record |
| D4 — final verification | Open | The canonical checklist below; environment and deployment evidence still required |

D1-D3 completion does not authorize production release. D4 owns release acceptance and must record evidence or an explicit owner-approved disposition for every checklist item.

### Pre-production release checklist

Stage C is complete in code and D1-D3 are implemented on `stage-D`. The following are the canonical D4 operational release gates, not unfinished Stage C feature work:

- [ ] Confirm the release commit passes lint, typecheck, unit tests, production build, architecture assertions, Lighthouse budgets, live RLS/integration suites, and the fixture-backed E2E workflow. Treat an isolated Lighthouse failure as a signal to rerun and investigate, not as permission to lower the budget.
- [ ] Apply every migration through `20260720190000_google_place_ids.sql` to the intended Supabase project and record the migration status. Preview and review Google Place ID matches before any `--write` backfill. The 2026-07-14 hosted verification predates the transactional, privacy, and Place ID migrations.
- [ ] Create a Vercel Preview with `/deploy`, run `/performance <preview_url> 30`, and retain the workflow links. Check CDN warm latency separately from the origin probe and inspect `Server-Timing` for Redis/database regressions.
- [ ] Smoke-test sign-in, map/search, Google Maps/Apple Maps destinations, Place ID fallback behavior, geocoding, report submission/removal, moderation, account export/deletion, and mutation-driven cache invalidation against disposable fixtures or the intended environment.
- [ ] Verify Redis-backed cache and distributed rate limiting, then exercise the documented direct-database and in-memory fallback behavior without exposing credentials.
- [ ] Verify a sanitized browser error and navigation trace in deployed Sentry, confirm the alert owner, and spot-check source-map readability and release-to-commit correlation.
- [ ] Review report-only CSP findings for Supabase, OpenFreeMap/Mapbox, Google OAuth, Nominatim, and Sentry before deciding whether to enforce the policy.
- [ ] Record the production commit SHA, migration state, CI/deployment evidence, smoke result, operator, and rollback target in the release record.

The dependency audit currently reports two moderate advisories through Next.js' nested PostCSS version. A force fix would introduce an invalid major downgrade; upgrade only through a verified Next.js release containing the corrected dependency.

### Deployment topology

- Vercel or another Node.js 22+ host runs the monolith.
- GitHub Actions is the only Vercel Preview path; native Vercel Git deployments are disabled and pushes do not deploy automatically.
- An authorized `/deploy` PR comment runs the workflow definition from `main` and deploys that PR's verified same-repository head SHA.
- `release` is excluded and separately managed.

The primary hosted database was inspected on 2026-07-14 for the RLS/grant hardening chain. That verification predates `20260715120000` and the Stage D Place ID migration; every target environment must apply the complete chain and run live tests before deployment.

## 9. Legacy milestones (preserved)

Stage A and Stage B are completed historical milestones. Their merge commits are retained and must not be amended, squashed, or relabeled.

### Stage A — release safety (legacy)

Merge commit: `0ffe352` (`Merge pull request #3 ... stage-a-release-safety`)

- Least-privilege RLS, grants, and function ACLs.
- Live RLS/security tests.
- Transactional report and moderation writes.
- Sentry/structured operational instrumentation.
- Geocoding authentication, quotas, cache, timeout, retry, and fallback.

The documentation marker `b9792f8` remains part of the same legacy history.

### Stage B — maintainability (legacy)

Merge commit: `ac122ab` (`Merge pull request #6 ... stage-B-enhancement`)

- Transactional integration tests and a critical-path E2E suite.
- Geocoding provider transport split from orchestration.
- Focused place and moderation write repositories.
- Stable mutation errors and conflict/idempotency behavior.
- Repeatable API/cache performance baselines.

The documentation commit `75133ef` remains part of the same legacy history.

These labels describe completed history only. New work must use a new milestone name.

## 10. Completed milestone: Stage C

Stage C was completed on 2026-07-20 through C1-C4. Redis and Sentry configuration is recorded as current infrastructure state, not as a rewrite of the completed Stage A or Stage B history. Remaining deployment checks are tracked by the pre-production release checklist rather than by extending the milestone.

### C1 — close release evidence

Status: **complete as of 2026-07-17**, based on GitHub Actions results, hosted database synchronization, Upstash/Sentry operator evidence, and production use of the critical paths.

1. Apply every migration through `20260715150000` to a disposable environment and the intended hosted environment. The disposable GitHub Actions environment is verified, and `supabase db push` reported the linked hosted database up to date on 2026-07-17.
2. Run `test:rls`, `test:integration`, and the Playwright critical path against disposable fixtures. These suites are verified on GitHub Actions.
3. Verify Redis use, mutation-driven version invalidation, distributed rate limits, and direct-database/in-memory fallback behavior. Runtime Redis use and cache hits are verified; invalidation, distributed-limit, and fallback drills remain open.
4. Verify deployed Sentry ingestion and owned alerts. Server tracing, real error ingestion, and an Error Monitor alert rule are verified; source-map readability remains an operational spot-check.
5. Perform post-deploy smoke checks for auth, map grid/viewport, geocoding quotas/fallback, report submission, moderation, and cache invalidation. Normal production use plus the critical-path E2E provides the accepted C1 smoke evidence.

Exit criteria: migration history is recorded, all live suites pass, Redis behavior is evidenced, Sentry events are actionable, alert ownership exists, and smoke evidence is linked from the release record.

Recorded C1 evidence:

- [Database security tests run 29532934270](https://github.com/carols12352/thecobaltguide/actions/runs/29532934270) passed on 2026-07-16 for `main@0b11f58`; the migration startup, RLS policy suite, and transactional workflow suite all completed successfully.
- [End-to-end run 29532934307](https://github.com/carols12352/thecobaltguide/actions/runs/29532934307) passed on the same commit; Supabase startup/migrations, fixture creation, Chromium installation, and the sign-in → submit → moderate → account-history path all completed successfully.
- [Performance baseline run 29533990057](https://github.com/carols12352/thecobaltguide/actions/runs/29533990057) completed 20 hosted samples per path. The map warm p50/p95 was 33/80 ms and search was 31/44 ms; both paths moved from `x-vercel-cache: MISS` to `HIT`. The sampled `Server-Timing` values were `null`, so this run proves CDN warming but is not standalone evidence of an Upstash Redis hit.
- Operator dashboard evidence recorded on 2026-07-17 shows active Upstash command traffic and stored cache data. Sentry traces for `/api/places/map` and `/api/places/viewport` include Upstash pipeline child spans; the observed map trace uses the Redis path without a corresponding Supabase query span, providing runtime cache-hit evidence.
- Sentry Explore recorded live Next.js page and API traces with Upstash and Supabase child spans on 2026-07-17, verifying production server ingestion and distributed tracing.
- Sentry Error Monitors showed a captured production TypeError and an Error Monitor with one active alert on 2026-07-17, verifying real error ingestion and configured alerting.

### C2 — close security and privacy gaps

Status: **complete in code.** Live database/browser verification remains a pre-production release gate.

1. Anonymous account-existence/provider disclosure is removed. The sign-in form uses a device-local `lastUsed` marker that stores only `google`, `password`, or `magic_link`.
2. `next.config.ts` applies report-only CSP plus `nosniff`, referrer, permissions, frame, and production HSTS headers. The CSP permits configured Supabase, map, Mapbox, Nominatim, Google OAuth, and Sentry transport; deploy it in report-only mode before enforcement.
3. The in-memory fallback opportunistically prunes expired entries and retains at most 10,000 keys. 429 responses are private/no-store and include `Retry-After` plus `RateLimit-Reset`.
4. `GET /api/me/data` exports private no-store JSON. `DELETE /api/me/data` requires the literal `DELETE`, then deletes Auth/profile data and free-form user text in one database transaction. Reports and flags retain their structured evidence with `user_id` set to null; moderation logs retain audit context with `moderator_id` set to null. This retention rule preserves community summaries without retaining the deleted account identity.

Exit criteria: **met in code.** The test suite covers local last-used state, header generation and actual Next response headers, bounded fallback behavior, retry metadata, destructive confirmation, and service-only database RPC access. Before release, run the migrated live database suites and browser flow against disposable fixtures.

### C3 — improve rendering, browser observability, and discovery

Status: **complete in code as of 2026-07-18.** Deployed browser-Sentry ingestion and the updated fixture-backed E2E remain pre-production release gates.

1. `instrumentation-client.ts` captures browser errors and navigation spans in production with sampled tracing, no default PII, and explicit event sanitization.
2. The shared header no longer performs an auth/profile read. Anonymous proxy requests without a Supabase auth cookie also avoid session verification, and the production build prerenders eight intended public routes.
3. Account/Admin authorization and first-load data now execute at server page boundaries; every protected API mutation retains its own authorization.
4. Safe error/not-found UI, bounded sitemap, robots policy, generated social image, private-route `noindex`, and dynamic place metadata are implemented. Place metadata and page rendering share a request-cached read.
5. Dialog focus trap/restore and scroll locking, keyboard-operable Admin tabs, mobile overflow, reduced motion, 404/discovery/security headers, and Lighthouse budgets are automated. The home page uses three viewport-height sections; its desktop Hero map is static server-rendered UI, while the second-section MapLibre preview loads automatically at 25% visibility.

Exit criteria: **met in code.** The latest local production run scored both Home and About 94/100/100/100 for performance/accessibility/best-practices/SEO. Six fixture-free Playwright cases pass; the authenticated critical path is fixture-gated. Verify a sanitized client event and navigation trace in deployed Sentry before release sign-off.

### C4 — reduce measured code hotspots

Status: **complete in code as of 2026-07-20.**

1. `components/admin/admin-dashboard.tsx` now owns shared state and API orchestration while overview, reports, flags, places, and users render through tab-specific components in `components/admin/tabs/`.
2. The former 700+ line `place-repository.ts` is a compatibility facade. Public map reads, public detail/search reads, admin queries, card lookup, and shared projections have distinct repository owners without duplicated projection logic.
3. `summary-service.ts` now contains only aggregation orchestration; source reads and summary upserts are owned by `summary-repository.ts`.
4. Projection contract tests cover viewport/map, detail, admin relation, and aggregation input shapes while compatibility exports remain available to existing services.

Exit criteria: **met in code.** Typecheck, lint, the production build, and all 54 unit-test files (254 tests) pass locally.

Stage C exit criteria are met. New product scope must be selected independently rather than appended to this completed milestone.

## 11. Deferred product opportunity: non-point merchant data

The schema already contains `merchant_multiplier_coverages` and `online_merchant_multipliers`. They could support a future public read surface that distinguishes physical places, city/province/nationwide coverage, and online-only merchants without inventing map coordinates.

This is not Stage C, is not currently planned, and carries no delivery commitment. If it is selected later, define a fresh milestone and document:

- owner and authorization rules;
- data/migration and rollback behavior;
- transaction/idempotency needs;
- public/private response fields;
- query limits, indexes, cache keys, and expected volume;
- unit, integration, and E2E coverage;
- observable failures and ongoing provider/moderation cost.

Likely acceptance criteria would include bounded indexed queries, cache keys and invalidation rules, explicit source attribution, search/filter integration, responsive and accessible presentation, and unit/API/E2E coverage for each merchant scope.

After this feature is measured, candidates such as shareable map-filter URLs, device-location sorting, saved merchants, or change notifications may be selected independently. Do not pre-build generic queues, microservices, search clusters, notification workers, or multi-card UI without an approved use case.

## 12. Extraction and scaling triggers

Continue scaling through bounded queries, indexes, cache, and horizontal Next.js instances. Consider a worker or separate service only when production evidence shows at least one of these:

- work exceeds request limits or needs durable retries;
- one workload requires materially different compute/scaling;
- provider quotas require centralized scheduling;
- independent teams require separate ownership/release cadence;
- security/compliance requires isolated credentials or data;
- a measured PostgreSQL/search bottleneck cannot be solved reasonably in the existing database.

The first likely extraction, if a selected feature needs it, is an asynchronous import/notification worker—not separate place, report, user, and moderation services that currently share transactions.

## 13. Architecture principles

1. Code and migrations outrank this document.
2. Keep one deployable while the domain and team remain cohesive.
3. Enforce authorization and invariants at the database boundary.
4. Keep authoritative writes atomic; make asynchronous work durable and idempotent.
5. Return bounded, intentional API projections.
6. Optimize measured database/cache behavior before changing topology.
7. Add infrastructure for an approved feature, not a hypothetical future.
8. Treat privacy, abuse handling, observability, and operational ownership as feature requirements.

## 14. Verification baseline

Verified locally on 2026-07-20 for the Stage D implementation branch:

```text
npm run lint       passed
npm run typecheck  passed
npm test           56 files, 266 tests passed
npm run build      passed (8 public routes prerendered; Account/Admin dynamic)
```

The prior Stage C architecture and fixture-free E2E suites passed before Stage D. They, the credential-backed critical path, and a fresh Lighthouse run remain D4 gates rather than being represented as current Stage D evidence. The latest Lighthouse baseline remains the 2026-07-18 C3 run: Home/About scored 94/100/100/100.

The RLS and transactional suites could not run locally because Docker/Supabase was not active; both stopped before executing tests. GitHub Actions supplied the authoritative disposable-environment evidence for `main@0b11f58`, as linked in C1 above. The updated authenticated E2E focus step remains to be exercised with disposable fixtures.

`npm audit --omit=dev` reported two moderate advisories in Next.js' nested PostCSS dependency. No force fix was applied because the proposed resolution would downgrade Next.js across incompatible major versions.
