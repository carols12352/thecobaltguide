# Cobalt Merchant Map

A community-maintained map of Canadian merchants and their reported American Express Cobalt earning multipliers.

Users can browse and filter merchants, submit locations and multiplier reports, flag inaccurate data, and review their recent activity. Moderators and administrators have dedicated tools for reports, flags, places, and users.

> Multiplier data is community-sourced reference data. Card issuers may classify individual transactions differently.

## Current status

- Runtime: Next.js 16 App Router, React 19, and Node.js 22+.
- Data: Supabase PostgreSQL/PostGIS with Row Level Security.
- Optional infrastructure: Upstash Redis and Sentry.
- Quality baseline: 49 Vitest files / 240 tests, plus live Supabase and Playwright suites.
- Architecture: modular monolith using route → service → repository boundaries.
- Current milestone: Stage A and Stage B are preserved legacy milestones; new work starts at Stage C.

See [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries, operational readiness, legacy milestones, and the next-step plan.

## Product capabilities

### Map and community data

- Canada-wide MapLibre map with clustering, aligned viewport grids, filters, merchant search, and distance-sorted neighbourhood results.
- Community reports for 1x, 2x, 3x, and 5x multipliers.
- Recency-weighted summaries based on the last 180 days.
- Grouped recent reports with separate submission and unique-reporter counts.
- Missing-place submissions, duplicate checks, and data-quality flags.
- Mapbox and Nominatim geocoding with authentication, quotas, caching, timeout, retry, and fallback policies.

### Accounts and moderation

- Email/password, magic-link, and Google sign-in through Supabase Auth; the login page remembers only the last method used on that device.
- Thirty-day report and flag history with active/archive views.
- Self-service JSON data export and permanent account deletion with anonymous retention of structured community contributions.
- Role-based moderator and administrator access.
- Atomic report submission/deletion, moderation, grouped flag resolution, and place merging.
- Reputation updates, suspended-account enforcement, and write rate limits.
- Structured operational logs and optional Sentry server error/tracing integration.

## Architecture at a glance

```text
Browser
  ├─ Next.js pages and client components
  ├─ Supabase Auth client
  └─ /api/*
       │
       ▼
Route Handlers       authentication, validation, HTTP contracts
       │
       ▼
Services             business rules, orchestration, caching
       │
       ▼
Repositories         Supabase queries and transactional RPCs
       │
       ├────────────► Upstash Redis (optional)
       ▼
Supabase             Auth, PostgreSQL, PostGIS, RLS
```

The application remains one deployable unit. Provider transport is isolated in `server/geocoding/`; schema and database security are defined by ordered migrations in `supabase/migrations/`.

## Requirements

- Node.js 22 or newer.
- npm.
- A Supabase project with PostGIS.
- A compatible map style; the default OpenFreeMap style is keyless.
- Optional for production: Upstash Redis, Sentry, and a Mapbox access token.

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Minimum configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SECRET_KEY` is server-only. Never expose it through a `NEXT_PUBLIC_` variable or commit `.env.local`.

Optional Mapbox geocoding:

```dotenv
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

Optional distributed caching and rate limiting:

```dotenv
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-write-token
UPSTASH_REDIS_REST_READONLY_TOKEN=your-read-only-token
```

See [`.env.example`](.env.example) for map-style, Sentry, E2E, and backward-compatible Supabase key settings.

### 3. Apply the database schema

For a hosted project:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

For a fully local stack, install the Supabase CLI and Docker, then run:

```bash
npx supabase start
npx supabase db reset
```

Migration ownership and deployment rules are documented in [supabase/migrations/README.md](supabase/migrations/README.md).

### 4. Configure authentication

- Set the local site URL to `http://localhost:3000`.
- Allow `http://localhost:3000/auth/callback` as a redirect URL.
- Enable Google and configure its client credentials if OAuth is required.
- Copy templates from `supabase/templates/` into hosted Supabase Auth when deploying.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on all interfaces |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest unit suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:rls` | Run the live Supabase RLS/grant suite |
| `npm run test:integration` | Run transactional workflow tests against local/disposable Supabase |
| `npm run test:e2e` | Check deployed security headers and run the fixture-backed Playwright critical path |
| `npm run baseline:api` | Record API latency, cache headers, and `Server-Timing` |
| `npm run replace:rewards-canada` | Validate and preview the reviewed seed replacement |
| `npm run replace:rewards-canada -- --apply --replace` | Atomically replace the reviewed seed |

Standard verification before submitting changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The live RLS/integration suites require a migrated local or disposable Supabase environment. The E2E suite skips locally unless all documented `E2E_*` fixture variables are present. CI provisions isolated fixtures; see [supabase/tests/README.md](supabase/tests/README.md).

## Project structure

```text
app/                  pages, layouts, and Route Handler APIs
components/           feature and reusable UI components
config/               application constants and categories
lib/                  browser-safe and shared domain helpers
server/geocoding/     third-party geocoding transport
server/repositories/  database reads, writes, and transactional RPC access
server/services/      business rules, orchestration, and cache coordination
server/validation/    server request schemas
supabase/migrations/  authoritative ordered schema and security changes
supabase/scripts/     reviewed seed replacement tooling
supabase/templates/   hosted Supabase email templates
__tests__/            Vitest tests
e2e/                  Playwright critical-path tests
docs/                 focused operational documentation
```

Within large feature areas, keep API-facing models and reusable presentation components next to their owning component. Do not import server-only modules into client components.

## Deployment

The repository targets Vercel or another Node.js 22+ host.

- `.github/workflows/vercel-deploy.yml` creates Vercel Preview deployments for `main` according to the workflow triggers.
- `vercel.json` disables Vercel native Git deployments so GitHub Actions is the automatic preview path.
- `release` is excluded from that workflow and remains separately managed.
- Production needs migrated Supabase schema, production Auth URLs/email delivery, Redis write/read credentials, and Sentry alert configuration.

Before production deployment, apply every migration through `20260717130000`, run the live database suites in a disposable environment, and verify the map/geocoding critical path. The primary hosted verification recorded on 2026-07-14 predates the transactional and privacy migrations and is not sufficient evidence for a new environment.

## Data and operational notes

- Public map reads use bounded PostGIS RPCs, short CDN caching, and optional longer Redis caching.
- Mutations bump cache versions after committed database work.
- Without Redis, reads fall back to Supabase and rate limits are process-local.
- The reviewed Rewards Canada seed is installed only through the explicit replacement script. See [supabase/scripts/README.md](supabase/scripts/README.md).
- Repeatable performance measurements are documented in [docs/performance-baseline.md](docs/performance-baseline.md).

## Stage C privacy and security

- Anonymous email/provider lookup has been removed. Sign-in guidance uses only a browser-local `lastUsed` method marker; no email address or account-existence state is sent to the application.
- A report-only Content Security Policy and `nosniff`, referrer, frame, permissions, and production transport headers are configured in `next.config.ts`. Review CSP reports against deployed Supabase, map, OAuth, and Sentry traffic before enforcing it.
- The in-memory rate-limit fallback prunes expired keys and caps itself at 10,000 entries. HTTP 429 responses include `Retry-After` and `RateLimit-Reset`.
- Account exports are private, no-store JSON downloads. Account deletion requires the literal confirmation `DELETE`; it removes Auth/profile data and free-form contribution text, while retaining anonymized structured contribution and audit records to preserve map results.

## Legacy milestones and next work

Stage A and Stage B are retained as immutable project-history milestones:

| Milestone | Scope | Merge commit |
| --- | --- | --- |
| Stage A | Release safety: RLS/grants, transactional writes, observability, geocoding protection | `0ffe352` |
| Stage B | Maintainability: service/repository splits, stable mutation errors, integration/E2E coverage, performance baseline | `ac122ab` |

Do not amend, squash, or relabel these legacy commits. The next planned work is Stage C: close the production-readiness gap, finish the remaining high-value module boundaries, then select one bounded product feature. The ordered plan and acceptance criteria live in [ARCHITECTURE.md](ARCHITECTURE.md#10-next-step-plan-stage-c).

## Data attribution

The initial merchant dataset was derived from the Rewards Canada community Cobalt list linked in the application footer. Subsequent data is maintained through community submissions and moderation.
