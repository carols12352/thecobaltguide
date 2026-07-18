# Cobalt Merchant Map — Architecture

> Last reviewed: 2026-07-18 on the Stage C branch after the C3 rendering/observability implementation.
>
> Source of truth: application code and `supabase/migrations/`. This document explains current boundaries, known gaps, and the next planned milestone.

## 1. Architecture decision

The application is a **modular monolith**:

- Next.js App Router serves pages and Route Handler APIs.
- Services own business rules, orchestration, aggregation, and cache coordination.
- Repositories own Supabase queries and transactional PostgreSQL RPC calls.
- Supabase provides Auth, PostgreSQL, PostGIS, and Row Level Security (RLS).
- Upstash Redis is configured in the deployed environment for distributed cache and rate limiting; local development still supports the documented in-memory/direct-database fallback.
- Mapbox and Nominatim provide synchronous geocoding behind one provider boundary.

One deployable application is the right topology for the current product, team, and transaction model. There is no measured need for microservices, Kubernetes, a read replica, a dedicated search service, or vector tiles.

## 2. Current snapshot

| Measure | Current state |
| --- | --- |
| TypeScript/TSX | About 18.2k lines |
| Route Handlers | 25 |
| Database | One Supabase PostgreSQL database with PostGIS |
| Unit baseline | 51 files / 245 Vitest tests |
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
  └─ /api/* requests
          │
          ▼
Next.js modular monolith
  ├─ Route Handlers: auth, input validation, HTTP response contracts
  ├─ Services: domain orchestration, aggregation, caching
  ├─ Repositories: Supabase reads/writes and Postgres RPCs
  └─ Geocoding provider client: Mapbox/Nominatim transport policy
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
| Cache/limits | CDN headers, Redis cache, version invalidation, Redis/in-memory quotas | cache and rate-limit helpers |

The schema carries `card_product_id`, but the current product experience and fixtures prove only one active product: Amex Cobalt.

## 6. Data, consistency, and security

### Core data

- `profiles`: role, status, reputation, and contribution counts.
- `merchant_brands`: optional shared merchant identity.
- `card_products`: card definitions; seeded with Amex Cobalt.
- `places`: physical locations with PostGIS geography.
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

### Geocoding

- Geocode routes require authentication and enforce per-IP and per-user quotas.
- Forward/reverse queries are hashed and cached for one hour.
- Provider calls use four-second timeouts.
- Mapbox receives one bounded retry for network/server failures; Nominatim is not retried.
- Provider failures, duration, timeout, and fallback behavior emit operational metrics.

### Monitoring

The Sentry deployment credentials, Next.js server SDK, and request-error instrumentation are configured. Production traces observed on 2026-07-17 include Next.js page/API transactions and child spans for Upstash and Supabase calls, verifying server ingestion and tracing. Structured JSON logs continue as a fallback. `instrumentation-client.ts` now initializes the browser SDK only in production, disables default PII, samples navigation traces, and sanitizes user/request/cookie/auth/query and sensitive breadcrumb/span data. Deployed client-event ingestion still requires an operator spot-check.

The production project also shows a real captured error and an Error Monitor with an active alert rule, completing the C1 ingestion/alert evidence. Readable TypeScript source maps and release-to-commit correlation should still be spot-checked when investigating an error, but they no longer block C1 acceptance. Session Replay is not required; if introduced later, sensitive account, address, and report fields must be masked by default.

### Known production-readiness gaps

- A report-only provider-compatible Content Security Policy, `nosniff`, strict referrer, frame, permissions, and production transport headers are configured. Enforce the CSP only after production report review confirms every Supabase, map, OAuth, and Sentry origin.
- Browser Sentry ingestion, readable client source maps, and navigation traces require a deployed operator spot-check.
- The fixture-backed sign-in/mutation/focus E2E step must run in CI or a disposable environment; fixture-free browser checks do not prove authenticated Supabase behavior.
- The dependency audit reports two moderate advisories through Next.js' nested PostCSS version. A force fix would introduce an invalid major downgrade; upgrade only through a verified Next.js release containing the corrected dependency.

### Deployment topology

- Vercel or another Node.js 22+ host runs the monolith.
- GitHub Actions is the only automatic Vercel Preview path; native Vercel Git deployments are disabled.
- `main` is the preview/development branch covered by the workflow.
- `release` is excluded and separately managed.

The primary hosted database was inspected on 2026-07-14 for the RLS/grant hardening chain. That verification predates `20260715120000`; every target environment must apply the complete chain and run live tests before deployment.

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

## 10. Next-step plan: Stage C

Stage C is intentionally ordered. Redis and Sentry configuration is recorded as current infrastructure state, not as a rewrite of the completed Stage A or Stage B history. Finish operational evidence, security boundaries, and measured runtime work before broadening product scope.

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

Status: **complete in code; live database/browser verification remains required before release.**

1. Anonymous account-existence/provider disclosure is removed. The sign-in form uses a device-local `lastUsed` marker that stores only `google`, `password`, or `magic_link`.
2. `next.config.ts` applies report-only CSP plus `nosniff`, referrer, permissions, frame, and production HSTS headers. The CSP permits configured Supabase, map, Mapbox, Nominatim, Google OAuth, and Sentry transport; deploy it in report-only mode before enforcement.
3. The in-memory fallback opportunistically prunes expired entries and retains at most 10,000 keys. 429 responses are private/no-store and include `Retry-After` plus `RateLimit-Reset`.
4. `GET /api/me/data` exports private no-store JSON. `DELETE /api/me/data` requires the literal `DELETE`, then deletes Auth/profile data and free-form user text in one database transaction. Reports and flags retain their structured evidence with `user_id` set to null; moderation logs retain audit context with `moderator_id` set to null. This retention rule preserves community summaries without retaining the deleted account identity.

Exit criteria: **met in code.** The test suite covers local last-used state, header generation and actual Next response headers, bounded fallback behavior, retry metadata, destructive confirmation, and service-only database RPC access. Before release, run the migrated live database suites and browser flow against disposable fixtures.

### C3 — improve rendering, browser observability, and discovery

Status: **complete in code as of 2026-07-18; deployed browser-Sentry ingestion and the updated fixture-backed E2E remain release checks.**

1. `instrumentation-client.ts` captures browser errors and navigation spans in production with sampled tracing, no default PII, and explicit event sanitization.
2. The shared header no longer performs an auth/profile read. Anonymous proxy requests without a Supabase auth cookie also avoid session verification, and the production build prerenders eight intended public routes.
3. Account/Admin authorization and first-load data now execute at server page boundaries; every protected API mutation retains its own authorization.
4. Safe error/not-found UI, bounded sitemap, robots policy, generated social image, private-route `noindex`, and dynamic place metadata are implemented. Place metadata and page rendering share a request-cached read.
5. Dialog focus trap/restore and scroll locking, keyboard-operable Admin tabs, mobile overflow, reduced motion, 404/discovery/security headers, and Lighthouse budgets are automated. The home page uses three viewport-height sections; its desktop Hero map is static server-rendered UI, while the second-section MapLibre preview loads automatically at 25% visibility.

Exit criteria: **met in code.** The latest local production run scored both Home and About 94/100/100/100 for performance/accessibility/best-practices/SEO. Six fixture-free Playwright cases pass; the authenticated critical path is fixture-gated. Verify a sanitized client event and navigation trace in deployed Sentry before release sign-off.

### C4 — reduce measured code hotspots

1. Continue splitting `components/admin/admin-dashboard.tsx` by tab as each tab is changed; API models and reusable presentation pieces are already separated.
2. Split the 700+ line `place-repository.ts` read facade into public-map, public-detail/search, and admin query owners without duplicating query logic.
3. Move the remaining direct database access in `summary-service.ts` behind a repository boundary.
4. Add contract tests around each moved projection before removing compatibility exports.

Exit criteria: dependencies remain route → service → repository, moved behavior has tests, and no compatibility layer is removed without verified callers.

### C5 — expose existing non-point merchant data

The preferred first bounded product feature is a public read surface for the existing `merchant_multiplier_coverages` and `online_merchant_multipliers` tables. The UI must distinguish physical places, city/province/nationwide coverage, and online-only merchants without inventing map coordinates.

Implement this feature only after C1 is closed and the relevant C2/C3 safeguards are in place. Before implementation, document:

- owner and authorization rules;
- data/migration and rollback behavior;
- transaction/idempotency needs;
- public/private response fields;
- query limits, indexes, cache keys, and expected volume;
- unit, integration, and E2E coverage;
- observable failures and ongoing provider/moderation cost.

Acceptance criteria: bounded indexed queries, cache keys and invalidation rules, explicit source attribution, search/filter integration, responsive and accessible presentation, and unit/API/E2E coverage for each merchant scope.

After this feature is measured, candidates such as shareable map-filter URLs, device-location sorting, saved merchants, or change notifications may be selected independently. Do not pre-build generic queues, microservices, search clusters, notification workers, or multi-card UI without an approved use case.

## 11. Extraction and scaling triggers

Continue scaling through bounded queries, indexes, cache, and horizontal Next.js instances. Consider a worker or separate service only when production evidence shows at least one of these:

- work exceeds request limits or needs durable retries;
- one workload requires materially different compute/scaling;
- provider quotas require centralized scheduling;
- independent teams require separate ownership/release cadence;
- security/compliance requires isolated credentials or data;
- a measured PostgreSQL/search bottleneck cannot be solved reasonably in the existing database.

The first likely extraction, if a selected feature needs it, is an asynchronous import/notification worker—not separate place, report, user, and moderation services that currently share transactions.

## 12. Architecture principles

1. Code and migrations outrank this document.
2. Keep one deployable while the domain and team remain cohesive.
3. Enforce authorization and invariants at the database boundary.
4. Keep authoritative writes atomic; make asynchronous work durable and idempotent.
5. Return bounded, intentional API projections.
6. Optimize measured database/cache behavior before changing topology.
7. Add infrastructure for an approved feature, not a hypothetical future.
8. Treat privacy, abuse handling, observability, and operational ownership as feature requirements.

## 13. Verification baseline

Verified locally on 2026-07-18 after C3 implementation:

```text
npm run lint       passed
npm run typecheck  passed
npm test           51 files, 245 tests passed
npm run build      passed (8 public routes prerendered; Account/Admin dynamic)
npm run test:architecture  passed
npm run test:e2e   6 passed, 1 fixture-backed test skipped
npm run test:lighthouse    passed (Home and About 94/100/100/100)
```

The RLS and transactional suites could not run locally because Docker/Supabase was not active; both stopped before executing tests. GitHub Actions supplied the authoritative disposable-environment evidence for `main@0b11f58`, as linked in C1 above. The updated authenticated E2E focus step remains to be exercised with disposable fixtures.

`npm audit --omit=dev` reported two moderate advisories in Next.js' nested PostCSS dependency. No force fix was applied because the proposed resolution would downgrade Next.js across incompatible major versions.
