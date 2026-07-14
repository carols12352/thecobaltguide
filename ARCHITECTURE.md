# Cobalt Merchant Map — Architecture and Feature Readiness

> Status: code and primary hosted-database assessment, verified 2026-07-14.
>
> Source of truth: application code and `supabase/migrations/`; this document records the current implementation and the gates for adding product scope.

## 1. Executive decision

The application should remain a **modular monolith**:

- Next.js App Router serves pages and Route Handler APIs.
- Server services coordinate business rules, caching, and repositories.
- Supabase provides Auth, PostgreSQL, PostGIS, and Row Level Security (RLS).
- Upstash Redis is optional and provides distributed cache and rate limiting when configured.
- Geocoding is performed synchronously against Mapbox and Nominatim.

There is no current code or operational evidence that justifies microservices, read replicas, a dedicated search service, vector tiles, Kubernetes, or a separately deployed API. Those are not roadmap commitments.

The product is technically ready for small, isolated UI and read-only improvements. Before expanding write-heavy, privacy-sensitive, or operationally complex features, the P0 items in [Section 6](#6-feature-expansion-gates) should be completed.

### Current snapshot

| Measure | Current state |
| --- | --- |
| TypeScript/TSX size | About 17.5k lines |
| Server layer | About 3.9k lines |
| Route Handlers | 25 |
| Database | One Supabase PostgreSQL database with PostGIS |
| Automated tests | 222 unit tests across 39 Vitest files; 14 live RLS/grant tests via `npm run test:rls` |
| CI | lint, typecheck, unit tests, live local RLS tests, production build |
| Integration/E2E tests | Live RLS matrix present; broader workflow/E2E coverage not present |
| Production error monitoring | Not connected; the Sentry module is a stub |
| RLS lockdown | Corrective migrations `20260714120000`–`20260714170000` are applied and verified on the primary hosted project; they enforce explicit policies, grants, function ACLs, safe defaults, bounded public RPCs, and removal of unused legacy RPCs |

These numbers are a point-in-time aid, not architectural targets.

## 2. Current runtime architecture

```text
Browser
  ├─ Next.js pages and client components
  ├─ Supabase Auth client
  └─ /api/* requests
          │
          ▼
Next.js modular monolith
  ├─ Route Handlers: auth, validation, HTTP responses
  ├─ Services: orchestration, aggregation, moderation, caching
  ├─ Repositories: Supabase queries and PostGIS RPC calls
  └─ Geocoding adapters: Mapbox and Nominatim
          │
          ├──────────────► Upstash Redis (optional)
          │                 cache and distributed rate limits
          ▼
Supabase
  ├─ Auth
  ├─ PostgreSQL + PostGIS
  └─ RLS
```

The deployment target documented by the project is Vercel or another Node.js 22+ host. Native Vercel Git deployments are disabled in `vercel.json`; GitHub Actions is the only automatic deployment path and creates one Vercel Preview when a same-repository pull request is opened against `main`, and one for each direct push to `main`. Later commits on an already-open pull request do not redeploy it. The `release` branch is excluded from automated deployment and currently contains the static Under Production shell for a separately managed production release. Cloudflare, PostHog, Resend, background workers, and Sentry are either optional configuration or unimplemented; they are not part of the guaranteed current architecture.

### Request layering

The dominant path is:

```text
app/api/*/route.ts
        → server/services/*
        → server/repositories/*
        → Supabase
```

This boundary is useful but not yet strict. `summary-service.ts` and parts of `moderation-service.ts` use the admin Supabase client directly. That is manageable in a single service, but new database access should normally be placed in a repository or a transactional database RPC.

## 3. Implemented product modules

| Module | Implemented behavior | Primary code |
| --- | --- | --- |
| Map discovery | Viewport grid loading, wider-view clustering data, exact viewport count/list supplement, filters, distance sorting | `components/map/merchant-map.tsx`, `place-service.ts`, PostGIS RPC migrations |
| Places | Search, detail, duplicate detection, authenticated creation | `place-service.ts`, `place-repository.ts` |
| Reports | 1x/2x/3x/5x submissions, report classification, recency aggregation, grouped public history, limited self-removal | `report-service.ts`, `summary-service.ts`, `aggregation.ts` |
| Flags and moderation | Place flags, grouped review, report approval/removal, place editing/merging, user administration, audit rows | `moderation-service.ts`, `flag-repository.ts`, admin routes |
| Reputation | Score changes for submissions and moderation outcomes; low-score submission block | `reputation-service.ts`, `lib/reputation/scoring.ts` |
| Accounts and auth | Supabase email/password, magic link, Google, account history, roles and suspension | `lib/auth/*`, account routes and components |
| Geocoding | Structured and reverse lookup using Mapbox and Nominatim; result ranking and city filtering | `geocoding-service.ts`, `lib/geocoding/*` |
| Cache and limits | CDN headers, Redis read/write caches, version-based invalidation, Redis/in-memory rate limits | `lib/cache/*`, `lib/rate-limit/*` |

The system supports one active product experience, Amex Cobalt, although reports and summaries already carry `card_product_id`.

## 4. Data, API, and consistency model

### Core tables

The migration history currently defines:

- `profiles`: application role, status, reputation, and report count.
- `merchant_brands`: optional shared brand metadata.
- `card_products`: card identity; seeded with `amex-cobalt-ca`.
- `places`: one physical merchant location with a PostGIS geography point.
- `multiplier_reports`: raw community reports and moderation state.
- `place_multiplier_summaries`: precomputed result per place/card.
- `place_flags`: community corrections and review state.
- `moderation_logs`: staff action audit rows.
- `lookup_auth_account_hints(text)`: service-role-only database function used by sign-in flows.

`supabase/migrations/` is authoritative for schema and RLS. TypeScript domain types are application projections and must be updated with migrations.

### API groups

| Access | Routes |
| --- | --- |
| Public reads | cards, place detail/reports/search/map/viewport, geocode/reverse geocode |
| Authenticated user | create place, submit/delete own report, submit flag, account report/flag lists |
| Moderator | report and flag queues/actions, place lookup/edit/merge |
| Administrator | user lookup and role/status/reputation changes |

Authorization is checked in Route Handlers with `requireAuth`, `requireModerator`, or `requireAdmin`. Validation uses Zod schemas before service calls.

### Map read path

1. `/api/places/map` aligns and pads the viewport into a cache grid.
2. Redis is checked when configured.
3. A bounded PostGIS RPC returns at most 200 neighbourhood places or 500 wider-view cluster points.
4. `/api/places/viewport` optionally obtains an exact count and bounded distance-sorted list.
5. Public responses use short CDN caching; Redis data uses longer TTLs.
6. Mutations bump cache versions and invalidate affected detail/admin/account entries.

This is already an appropriate scale-first design. Query plans, cache hit rates, and production latency should be measured before changing the topology.

### Report write path

The current report flow is synchronous:

```text
authenticate and rate-limit
  → classify report
  → insert report
  → update report count/reputation
  → recompute summary
  → invalidate public, account, and admin caches
```

Deletion and moderation use similar multi-step flows. These operations are **not one database transaction**. A later step can fail after an earlier write has committed, leaving counters, summaries, review state, or audit data inconsistent. Place merging also performs multiple independent writes.

Cache invalidation may remain best-effort after commit, but authoritative database changes that form one business action should become atomic.

## 5. What is already strong

- The route/service/repository shape keeps most HTTP and business concerns separate.
- PostGIS indexes and bounded viewport RPCs match the map access pattern.
- Precomputed summaries prevent aggregation on every read.
- Redis is optional, so cache failure does not make the application unusable.
- Important domain rules are represented in shared TypeScript and Zod definitions.
- The database enforces one active report per user/place/UTC day and basic field constraints.
- CI runs lint, TypeScript, Vitest, and `next build` on pushes and pull requests.
- Pure aggregation, geocoding parsing, map behavior, cache coordination, reputation, and validation helpers have useful unit coverage.

This foundation is sufficient for continued development inside the monolith.

## 6. Feature expansion gates

### P0 — complete before expanding production write scope

#### 6.1 Lock down RLS and direct database access

Corrective migrations `20260714120000`–`20260714170000` remove permissive client INSERT/UPDATE paths and public raw profile/report SELECT, define least-privilege table and function grants, make future migration-created objects default-deny, bound public map RPC work, and remove unused legacy RPCs. Application mutations continue through the service-role client; public place report reads use the admin client in `report-repository.findByPlaceId` and return API projections only.

The primary hosted Supabase project was verified through migration history, a read-only schema dump, and anonymous Data API smoke checks on 2026-07-14. Any additional environment must apply the same full migration chain. Run `npm run test:rls` only against a migrated local or disposable staging database because the suite creates and removes fixtures. Remaining Stage A work is transactional writes, observability, and geocode protection.

Previously, the initial migration permitted a signed-in user to update their own `profiles` row without limiting writable columns, and authenticated clients could insert places, reports, and flags directly—bypassing Route Handler checks for rate limits, reputation, classification, and cache/summary refresh.

#### 6.2 Make authoritative multi-table actions atomic

Move these workflows into transactional PostgreSQL functions or otherwise guarantee atomicity and idempotency:

- submit/delete report plus profile counter/reputation changes;
- approve/remove/flag report plus reputation and review metadata;
- resolve a place's flags plus reporter reputation and report cleanup;
- merge places plus report/flag reassignment, source status, summary, and audit log.

Summary refresh can be included in the transaction at current volume. If it later becomes asynchronous, use a durable outbox/job record rather than an untracked fire-and-forget call.

#### 6.3 Connect real production observability

`lib/monitoring/sentry.ts` currently logs only in development and contains commented Sentry calls. Before increasing product scope, production must provide at least:

- captured server exceptions with route and operation context;
- API error rate and p95 latency;
- map/PostGIS query duration and Redis hit/miss rate;
- geocoding provider failures, timeouts, and usage;
- report/flag mutation success and summary-refresh failures.

No analytics vendor is mandatory. The requirement is actionable signals and alerts, not a specific tool.

### P1 — strengthen before medium-complexity features

#### 6.4 Extend integration and critical-path E2E coverage

The live local Supabase suite already reapplies the full migration chain and verifies RLS, table grants, function ACLs, inactive-row filtering, and bounded public RPC behavior. Broader integration coverage should still verify:

- report submission, classification, aggregation, deletion, and moderation;
- duplicate-place prevention and place merge rollback behavior;
- PostGIS viewport boundaries and pagination;
- cache invalidation after committed mutations.

Add a small Playwright suite for sign-in → submit → moderate → account-history. Broad browser coverage is unnecessary; protect the highest-risk journeys.

#### 6.5 Protect third-party provider paths

The geocode and reverse-geocode endpoints are public and currently have no route-level rate limit. Provider fetches do not have an explicit timeout/cancellation policy. Before adding more address-dependent features:

- require an appropriate session where possible;
- add IP/user quotas and short result caching;
- add timeouts, bounded retries, and provider-specific error metrics;
- define a graceful fallback when one or both providers fail.

This controls latency, abuse, and Mapbox cost exposure.

#### 6.6 Reduce internal hotspots without changing deployment topology

Refactor when touching these areas:

- split `geocoding-service.ts` by provider, orchestration, and ranking responsibility;
- split `place-repository.ts` into public-map reads, admin reads, and writes;
- move direct database access out of `moderation-service.ts` and `summary-service.ts`;
- introduce typed repository results instead of loose `Record<string, unknown>` updates;
- preserve one directional dependency: route → service → repository/database.

This is modular-monolith cleanup, not a reason to create network services.

### P2 — triggered by a specific feature or measured load

Implement these only when a selected feature requires them:

| Proposed capability | Required foundation |
| --- | --- |
| Notifications/email | Durable outbox, retry/idempotency, delivery preferences, unsubscribe/privacy rules |
| Bulk imports | Job table or worker, idempotent import keys, checkpoints, failure report, provider quotas |
| Second card product | Product-aware UI/API/cache keys, per-card test fixtures, migration and aggregation verification |
| Screenshot/OCR | Private object storage, malware/file validation, retention/deletion policy, async processing, moderation cost model |
| Comments/social features | Abuse tooling, deletion/export policy, notification controls, moderation capacity |
| Public API or mobile client | Versioned API contract, token scopes, quotas, CORS policy, deprecation policy |
| High-volume summary refresh | Durable queue/outbox and idempotent worker |
| Dedicated search | Measured evidence that indexed PostgreSQL search cannot meet the latency/quality target |

## 7. Feature readiness assessment

| Feature class | Readiness | Decision |
| --- | --- | --- |
| UI polish and local presentation changes | Ready | Can proceed with existing tests and visual verification |
| New bounded public read/filter | Mostly ready | Add query/index and response-contract tests; measure payload and latency |
| New authenticated mutation | Not ready | Complete transactional P0 write work next (RLS lockdown landed) |
| More moderation workflows | Not ready | First make existing moderation actions atomic and integration-tested |
| More geocoding-dependent behavior | Not ready | Add endpoint protection, timeouts, cache, and provider monitoring |
| Second card product | Partially ready | Schema supports it; product behavior, cache isolation, and fixtures do not yet prove it |
| Notifications or scheduled processing | Foundation missing | Add outbox/worker only for the selected feature |
| Uploads, OCR, social, payments | Out of current scope | Require separate product, privacy, abuse, and cost justification |
| Microservices | Not justified | Reassess only from measured scaling/team/reliability constraints |

### Definition of ready for a new feature

A feature may enter implementation when:

- its data owner and authorization rules are explicit;
- direct Supabase access cannot bypass its rules;
- multi-table writes have a transaction/idempotency design;
- migration, rollback/repair, and backfill behavior are defined;
- public/private response fields and retention are documented;
- expected query volume, indexes, limits, and cache behavior are known;
- unit plus required integration/E2E tests are identified;
- failures are observable and have a safe user-facing outcome;
- ongoing moderation or provider cost has an owner.

Small read-only work does not need heavyweight design. The checklist scales with risk.

## 8. Recommended near-term architecture work

### Stage A — release safety

1. ~~Audit the deployed Supabase grants/RLS and add corrective migrations.~~ **Done** (`20260714120000`–`20260714170000`); the primary hosted project is applied and verified. Apply the full chain to any additional database and verify locally or in disposable staging with `npm run test:rls` (`supabase/tests/README.md`).
2. ~~Add automated RLS tests before relying on application roles.~~ **Done** (local suite and dedicated CI job).
3. Convert report and moderation write workflows to transactional database operations.
4. Wire production exception reporting and basic latency/failure dashboards.
5. Rate-limit and time-bound geocoding calls.

### Stage B — maintainability

1. Add Supabase integration tests and a minimal critical-path E2E suite.
2. Split oversized geocoding and place persistence modules along existing responsibilities.
3. Standardize mutation errors, conflict responses, and idempotency behavior.
4. Record query and cache baselines so future scaling decisions use evidence.

### Stage C — product work

Choose one feature, apply the readiness checklist, and add only the infrastructure it requires. Do not pre-build a generic queue, service mesh, search cluster, or multi-card abstraction without a selected use case.

## 9. Scaling and service extraction criteria

Continue scaling the monolith through bounded queries, indexes, caching, and horizontal Next.js instances. Consider a worker or service boundary only when production evidence shows one of the following:

- a task exceeds request-duration limits or needs durable retries;
- one workload requires materially different compute or scaling;
- provider rate limits require centralized scheduling;
- separate teams need independent ownership and release cadence;
- a security/compliance boundary requires isolated credentials or data;
- a measured database/search bottleneck cannot be solved reasonably in PostgreSQL.

The first likely extraction, if ever needed, is an asynchronous import/notification worker—not separate place, report, user, and moderation microservices. Those domains share transactions and one relational model.

## 10. Explicitly removed assumptions

The previous document mixed implemented behavior with speculative recommendations. This revision removes or demotes the following because the code does not establish them as current architecture or committed plans:

- fixed city-by-city rollout phases;
- assumed Cloudflare, PostHog, Resend, Sentry, preview-environment, and staging-database deployments;
- generic background-job, read-replica, vector-tile, and dedicated-search roadmaps;
- a future separate backend presented as an expected destination;
- comparison with unused database products;
- repeated MVP and non-goal lists;
- a hypothetical `src/`, `policies/`, and `jobs/` tree that does not match the repository;
- suggested cache durations and debounce values that differ from `config/constants.ts`;
- completed feature descriptions written as future requirements.

Future architecture changes should be added only when supported by code, an accepted feature design, or measured production evidence.

## 11. Architecture principles

1. Code and migrations outrank this document.
2. Keep one deployable application while the domain and team remain cohesive.
3. Enforce authorization and invariants at the database boundary, not only in UI or routes.
4. Keep authoritative writes atomic; make asynchronous work durable and idempotent.
5. Return bounded, intentional projections instead of raw database rows.
6. Optimize measured database and cache behavior before changing topology.
7. Add infrastructure for an approved feature, not for a hypothetical future.
8. Treat privacy, abuse handling, observability, and operational ownership as feature requirements.

## 12. Verification baseline

At the time of this assessment:

```text
npm test          39 files, 222 tests passed
npm run typecheck passed
npm run lint      passed
npm run test:rls  1 file, 14 tests passed
npm run build     passed
```

These checks validate the current TypeScript, unit-test, build, and local RLS baseline. The primary hosted project additionally passed migration-history/schema verification and read-only anonymous API smoke checks. This does not validate every future environment, multi-step transaction behavior, external providers, browser journeys, or production operations; remaining Stage A items close transactional writes, observability, and geocode protection.
