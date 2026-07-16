# Cobalt Merchant Map — Architecture

> Last reviewed: 2026-07-16 against `main` at `836667b` before this documentation/code-organization change.
>
> Source of truth: application code and `supabase/migrations/`. This document explains current boundaries, known gaps, and the next planned milestone.

## 1. Architecture decision

The application is a **modular monolith**:

- Next.js App Router serves pages and Route Handler APIs.
- Services own business rules, orchestration, aggregation, and cache coordination.
- Repositories own Supabase queries and transactional PostgreSQL RPC calls.
- Supabase provides Auth, PostgreSQL, PostGIS, and Row Level Security (RLS).
- Upstash Redis is optional for distributed cache and rate limiting.
- Mapbox and Nominatim provide synchronous geocoding behind one provider boundary.

One deployable application is the right topology for the current product, team, and transaction model. There is no measured need for microservices, Kubernetes, a read replica, a dedicated search service, or vector tiles.

## 2. Current snapshot

| Measure | Current state |
| --- | --- |
| TypeScript/TSX | About 18.2k lines |
| Route Handlers | 25 |
| Database | One Supabase PostgreSQL database with PostGIS |
| Unit baseline | 44 files / 231 Vitest tests |
| Live database coverage | 16 RLS/grant tests and 3 transactional integration tests defined |
| Browser coverage | One environment-backed Playwright critical path |
| CI | Lint, typecheck, unit tests, build, live database suites, E2E, and on-demand performance baseline workflows |
| Monitoring | Sentry server integration plus structured operational logs; deployment alert configuration remains external |

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
          ├──────────────► Upstash Redis (optional)
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

## 8. External systems and deployment

### Geocoding

- Geocode routes require authentication and enforce per-IP and per-user quotas.
- Forward/reverse queries are hashed and cached for one hour.
- Provider calls use four-second timeouts.
- Mapbox receives one bounded retry for network/server failures; Nominatim is not retried.
- Provider failures, duration, timeout, and fallback behavior emit operational metrics.

### Monitoring

The Sentry Next.js server SDK and request-error instrumentation are implemented. Structured JSON logs continue without a DSN. Production readiness still requires deployment credentials, source-map configuration, and owned error-rate/p95 alert thresholds.

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

Stage C is intentionally ordered. Finish operational evidence and remaining high-value boundaries before broadening product scope.

### C1 — close release evidence

1. Apply every migration through `20260715150000` to a disposable environment and the intended hosted environment.
2. Run `test:rls`, `test:integration`, and the Playwright critical path against disposable fixtures.
3. Configure Sentry source maps and owned error-rate/p95 alerts.
4. Perform post-deploy smoke checks for auth, map grid/viewport, geocoding quotas/fallback, report submission, moderation, and cache invalidation.

Exit criteria: migration history is recorded, all live suites pass, alert ownership exists, and smoke evidence is linked from the release record.

### C2 — reduce measured code hotspots

1. Continue splitting `components/admin/admin-dashboard.tsx` by tab as each tab is changed; API models and reusable presentation pieces are already separated.
2. Split the 700+ line `place-repository.ts` read facade into public-map, public-detail/search, and admin query owners without duplicating query logic.
3. Move the remaining direct database access in `summary-service.ts` behind a repository boundary.
4. Add contract tests around each moved projection before removing compatibility exports.

Exit criteria: dependencies remain route → service → repository, moved behavior has tests, and no compatibility layer is removed without verified callers.

### C3 — select one bounded product feature

Choose one feature only after C1. Prefer a bounded public read/filter or focused moderation improvement. For the selected feature, document:

- owner and authorization rules;
- data/migration and rollback behavior;
- transaction/idempotency needs;
- public/private response fields;
- query limits, indexes, cache keys, and expected volume;
- unit, integration, and E2E coverage;
- observable failures and ongoing provider/moderation cost.

Do not pre-build generic queues, microservices, search clusters, or multi-card UI without a selected use case.

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

Verified locally on 2026-07-16 before this cleanup:

```text
npm run lint       passed
npm run typecheck  passed
npm test           44 files, 231 tests passed
```

The production build and the same static/unit checks must be rerun after this change. Live RLS, transactional, and browser suites require local/disposable Supabase and fixture infrastructure; their presence is not evidence that a target hosted environment has passed them.
