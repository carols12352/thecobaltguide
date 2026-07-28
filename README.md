# Cobalt Merchant Map

A community-maintained map of Canadian merchants and their reported American Express Cobalt earning multipliers.

Users can browse and filter merchants, submit locations and multiplier reports, flag inaccurate data, and review their recent activity. Moderators and administrators have dedicated tools for reports, flags, places, and users.

> Multiplier data is community-sourced reference data. Card issuers may classify individual transactions differently.

## Current status

- Runtime: Next.js 16 App Router, React 19, and Node.js 22+.
- Data: Supabase PostgreSQL/PostGIS with Row Level Security.
- Optional infrastructure: Upstash Redis and Sentry.
- Quality baseline: 56 Vitest files / 266 tests, plus live Supabase, Playwright, architecture, and Lighthouse suites.
- Architecture: modular monolith using route → service → repository boundaries.
- Current milestone: Stage A and Stage B are preserved legacy milestones; Stage C (C1-C4) is complete; Stage D implementation and documentation are in review, with final release verification still open.

See [ARCHITECTURE.md](ARCHITECTURE.md) for system boundaries, operational readiness, completed milestones, release gates, and deferred opportunities.

## Product capabilities

### Map and community data

- Canada-wide MapLibre map with clustering, aligned viewport grids, filters, merchant search, and distance-sorted neighbourhood results.
- Community reports for 1x, 2x, 3x, and 5x multipliers.
- Recency-weighted summaries based on the last 180 days.
- Grouped recent reports with separate submission and unique-reporter counts.
- Missing-place submissions, duplicate checks, and data-quality flags.
- Mapbox and Nominatim geocoding with authentication, quotas, caching, timeout, retry, and fallback policies.
- Optional Google Maps and Apple Maps links for a selected merchant. Google links prefer a stored Place ID for precise targeting; both providers fall back safely when optional provider data is unavailable.

### Accounts and moderation

- Email/password, magic-link, and Google sign-in through Supabase Auth; the login page remembers only the last method used on that device.
- Thirty-day report and flag history with active/archive views.
- Self-service JSON data export and permanent account deletion with anonymous retention of structured community contributions.
- Role-based moderator and administrator access.
- Atomic report submission/deletion, moderation, grouped flag resolution, and place merging.
- Reputation updates, suspended-account enforcement, and write rate limits.
- Structured operational logs and optional privacy-filtered Sentry server/browser error and tracing integration.

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
- Optional for production: Upstash Redis, Sentry, a Mapbox access token, and a server-only Google Places API key for precise Google Maps links.

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

Optional Google Place ID resolution:

```dotenv
GOOGLE_PLACES_API_KEY=your-google-places-key
```

Restrict this server-only key to Places API (New). The application still generates valid Google Maps links without it, but those links use the encoded merchant name/address and coordinates instead of a Place ID.

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
| `npm run test:e2e` | Run public mobile/a11y/discovery/security checks and the fixture-backed critical path |
| `npm run test:architecture` | Assert built public routes are prerendered and private routes remain dynamic |
| `npm run test:lighthouse` | Run three samples per route, enforce median Lighthouse budgets, and retain reports outside the repository |
| `npm run baseline:api` | Record API latency, cache headers, and `Server-Timing` |
| `npm run replace:rewards-canada` | Validate and preview the reviewed seed replacement |
| `npm run replace:rewards-canada -- --apply --replace` | Atomically replace the reviewed seed |
| `npm run backfill:google-place-ids -- --limit=100` | Preview high-confidence, manual-review, and unmatched Google Place ID counts |
| `npm run backfill:google-place-ids -- --limit=100 --write` | Save only high-confidence Google Place ID matches; leave all others on the URL fallback |

Standard verification before submitting changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:architecture
npm run test:lighthouse
```

The live RLS/integration suites require a migrated local or disposable Supabase environment. Public E2E cases run without fixtures; only the authenticated mutation workflow skips unless all documented `E2E_*` variables are present. Lighthouse requires a local Chrome/Chromium installation and a completed production build. CI provisions isolated fixtures; see [supabase/tests/README.md](supabase/tests/README.md).

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
scripts/              architecture, Lighthouse, baseline, and data-operation tooling
```

Within large feature areas, keep API-facing models and reusable presentation components next to their owning component. Do not import server-only modules into client components.

## Deployment

The repository targets Vercel or another Node.js 22+ host.

- Comment `/deploy` on an open same-repository PR to create a new Vercel Preview for its current head SHA. Only owners, members, and collaborators may trigger it.
- Deployments are comment-only: pushes and PR creation do not deploy automatically, and `/deploy` currently accepts no parameters.
- The workflow posts a start notice and updates it with the Preview URL or failure link when the run finishes.
- `vercel.json` disables Vercel native Git deployments so GitHub Actions remains the only Preview path.
- `release` is excluded from that workflow and remains separately managed.
- Production needs migrated Supabase schema, production Auth URLs/email delivery, Redis write/read credentials, and Sentry alert configuration.

See [Preview deployment operations](docs/preview-deployment.md) for command parameters, permissions, required secrets, performance measurement, and troubleshooting.

Before production deployment, apply every migration through `20260727120000_place_source_kind.sql`, run the live database suites in a disposable environment, and verify the map/geocoding/external-navigation critical path. The primary hosted verification recorded on 2026-07-14 predates the transactional, privacy, Google Place ID, and place-provenance migrations and is not sufficient evidence for a new environment.

## Data and operational notes

- Public map reads use bounded PostGIS RPCs, short CDN caching, and optional longer Redis caching.
- Mutations bump cache versions after committed database work.
- Without Redis, reads fall back to Supabase and rate limits are process-local.
- The reviewed Rewards Canada seed is installed only through the explicit replacement script. See [supabase/scripts/README.md](supabase/scripts/README.md).
- Repeatable performance measurements and the separate CDN/origin interpretation are documented in [docs/performance-baseline.md](docs/performance-baseline.md).

## Stage D pre-release milestone

Stage D is the current pre-release milestone. Its implementation is under review in [PR #10](https://github.com/carols12352/thecobaltguide/pull/10), while [issue #9](https://github.com/carols12352/thecobaltguide/issues/9) remains the task tracker.

### Delivered in D1-D3

- External navigation opens Google Maps or Apple Maps in a new tab without requesting the user's device location or choosing a route on the user's behalf.
- A shared browser-safe URL builder validates WGS84 coordinates, fixes them to six decimal places, encodes merchant data, and omits actions for malformed coordinates.
- Google Maps prefers `places.google_place_id`. A server-only Google Places text search can resolve IDs for newly moderated places, and the backfill command previews existing-place matches unless `--write` is explicitly supplied.
- The repository now includes the AGPL-3.0-only license, contribution and conduct guidance, a private security policy, issue forms, a pull-request template, and focused maintenance labels.
- README and architecture documentation describe the Stage D boundaries and release status.

### Boundaries and remaining release work

- MapLibre remains the in-app map. External providers receive only the destination data needed to open their site; starting point, routing, transport mode, account state, and navigation remain under the provider and user's control.
- Google Places lookup is optional and server-only. Failure or a missing key does not block place creation or external links.
- The schema migration and reviewed Place ID backfill must be applied separately in each target environment.
- D4 is not complete. Preview deployment, live database suites, credential-backed E2E, Lighthouse, smoke testing, CSP review, migration evidence, and the release/rollback record remain governed by the canonical [pre-production release checklist](ARCHITECTURE.md#pre-production-release-checklist).

## Contributing, security, and license

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use the in-product Report action for an individual merchant correction whenever possible.
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) in project spaces.
- Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/carols12352/thecobaltguide/security/advisories/new) or the fallback process in [SECURITY.md](SECURITY.md). Do not put credentials, receipts, account information, or personal data in public issues.
- The original application code is licensed under [GNU AGPL v3.0 only](LICENSE). Commercial use is allowed, but the license's attribution, notice, source-availability, and corresponding-source obligations apply. Third-party merchant data, map tiles, provider content, names, logos, and trademarks retain their own terms.

## Stage C completion

- Anonymous email/provider lookup has been removed. Sign-in guidance uses only a browser-local `lastUsed` method marker; no email address or account-existence state is sent to the application.
- A report-only Content Security Policy and `nosniff`, referrer, frame, permissions, and production transport headers are configured in `next.config.ts`. Review CSP reports against deployed Supabase, map, OAuth, and Sentry traffic before enforcing it.
- The in-memory rate-limit fallback prunes expired keys and caps itself at 10,000 entries. HTTP 429 responses include `Retry-After` and `RateLimit-Reset`.
- Account exports are private, no-store JSON downloads. Account deletion requires the literal confirmation `DELETE`; it removes Auth/profile data and free-form contribution text, while retaining anonymized structured contribution and audit records to preserve map results.
- Public pages use a static shared shell; Account and Admin perform authorization and initial reads on the server. `npm run test:architecture` protects this rendering boundary.
- Production-only browser Sentry initialization disables default PII and strips cookies, authorization values, user data, query strings, and sensitive breadcrumb/span fields before sending events.
- Robots/sitemap routes, a social preview image, private-route `noindex`, dynamic place metadata, safe error/404 UI, focus trapping/restoration, reduced-motion behavior, and narrow-viewport checks are included.
- The home page is organized into three viewport-height sections: a full-height Hero with a server-rendered static map on desktop, the real interactive map, then product context and contribution actions. MapLibre loads automatically once at least 25% of the second section enters the viewport. The latest local Lighthouse run scored both Home and About 94/100/100/100 for performance/accessibility/best-practices/SEO.

## Completed milestones and deferred work

Stage A and Stage B are retained as immutable project-history milestones:

| Milestone | Scope | Merge commit |
| --- | --- | --- |
| Stage A | Release safety: RLS/grants, transactional writes, observability, geocoding protection | `0ffe352` |
| Stage B | Maintainability: service/repository splits, stable mutation errors, integration/E2E coverage, performance baseline | `ac122ab` |

Do not amend, squash, or relabel these legacy commits. Stage C (C1-C4) is complete. Its implementation record is in [Completed milestone: Stage C](ARCHITECTURE.md#10-completed-milestone-stage-c), while deployment sign-off is tracked separately in the [pre-production release checklist](ARCHITECTURE.md#pre-production-release-checklist).

The database already contains non-point merchant coverage and online-merchant tables, but exposing them is not currently planned and is not part of Stage C. The opportunity is retained as deferred product context in [ARCHITECTURE.md](ARCHITECTURE.md#11-deferred-product-opportunity-non-point-merchant-data).

## Data attribution

The initial merchant dataset was derived from the Rewards Canada community Cobalt list linked in the application footer. Subsequent data is maintained through community submissions and moderation.
