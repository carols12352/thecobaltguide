# Cobalt Merchant Map

A community-maintained map of Canadian merchants and their reported American Express Cobalt earning multipliers.

Users can browse and filter merchants, search by name, submit new locations, report multiplier results, and flag inaccurate data. Moderators and administrators have dedicated review tools for reports, flags, merchants, and users.

> Merchant multiplier data is community-sourced reference data. Card issuers may classify individual transactions differently.

## Features

### Map and discovery

- Interactive Canada-wide map built with MapLibre GL.
- Merchant clustering at wider zoom levels and an in-view list at neighbourhood zoom.
- Filters for multiplier and merchant category.
- Merchant name search and distance-sorted visible results.
- Responsive split map/list layout with mobile list controls.
- Configurable OpenFreeMap, MapTiler, or compatible style URL.
- Address geocoding and reverse geocoding for merchant submissions and moderation.

### Community data

- Submit 1x, 2x, 3x, or 5x transaction reports.
- Add missing merchants with duplicate detection.
- Confirm existing results or report incorrect data.
- Flag wrong addresses, duplicates, closures, category errors, and Amex acceptance issues.
- Place detail pages show **grouped recent reports** (same multiplier and purchase context combined; unique reporter count shown separately from total submissions).
- Recency-weighted aggregation using reports from the last 180 days.
- Confidence states: insufficient, disputed, medium, high, and recently confirmed.

### Accounts and security

- Email/password, magic-link, and Google authentication through Supabase Auth.
- Email confirmation, password recovery, password changes, and linked sign-in method display.
- Personal report and flag history for the last 30 days, with active/archive views and short-lived Redis caching.
- Self-service removal of pending reports only (staff-reviewed or removed reports cannot be withdrawn).
- Role-based access for users, moderators, and administrators.
- Suspended-account enforcement and write rate limits.

### Moderation

- Review queues for new-location and error reports.
- **Place flags grouped by merchant** in the admin queue: open flags on the same place appear as one card with reporter counts, reason summary, and per-flag detail. Resolving or dismissing applies to **all open flags on that place**; reputation is adjusted **once per unique reporter**, even when they submitted multiple flags.
- Flag resolution and report moderation with automatic reputation updates.
- Merchant editing, status changes, and duplicate merging.
- **Places tab lookup** by merchant name, postal code, street address, or place UUID (at least one required; combined fields narrow results with AND logic).
- Moderator place view: **tiered geocode lookup** — postal code first, then street address, then merchant name + city. Mapbox Geocoding and Nominatim are used together; Mapbox Search Box supplements POI coverage when classic geocoding misses a location. Multiple ranked matches are offered when available; results are filtered to the requested city (neighbouring cities such as Kitchener are excluded when searching Waterloo). Empty or incorrect address fields are backfilled from results.
- Administrator-only user role, suspension, and reputation controls.
- Moderation audit records.

## Technology

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Map | MapLibre GL 5 |
| Database and auth | Supabase, PostgreSQL, PostGIS, Row Level Security |
| Validation | Zod |
| Cache and rate limiting | Upstash Redis, with local in-memory rate-limit fallback |
| Tests | Vitest |
| Deployment target | Vercel or any Node.js 22+ host |

## Architecture

The application uses a route → service → repository structure:

```text
app/api/* route handlers
        │
        ▼
server/services/*       business rules, aggregation, caching
        │
        ▼
server/repositories/*   Supabase queries and PostGIS RPC calls
        │
        ▼
Supabase PostgreSQL
```

Browser-facing helpers live in `lib/`, reusable UI in `components/`, and database schema changes in `supabase/migrations/`.

### Map loading and caching

Map loading is split into two requests so exact counts do not block cached map points:

1. `GET /api/places/map` loads an outward-aligned, padded grid of map points.
2. `GET /api/places/viewport` optionally supplements it with an exact viewport count and a bounded distance-sorted list.

The client filters already-loaded grid points while the map is moving and only fetches a new grid after crossing the cached bounds. At neighbourhood zoom the grid is capped at 200 places; wider clustered views are capped at 500 places.

| Data | CDN TTL | Redis TTL |
| --- | ---: | ---: |
| Grid map region | 120 seconds | 24 hours |
| Viewport details | 60 seconds | 5 minutes |
| Place detail | 120 seconds | 24 hours |
| Search | 120 seconds | 5 minutes |

Cache keys include a global map version. Creating places or changing reports bumps the version so stale map, viewport, place, and search data is bypassed without scanning Redis keys.

Viewport RPCs use the PostGIS geography GiST index. Public map responses expose a `Server-Timing` header with Redis and database timings for performance diagnosis.

Redis is optional during development. Without Redis, the application remains functional but map/search reads go directly to Supabase and rate limiting falls back to the current Node.js process.

## Requirements

- Node.js 22 or newer.
- npm.
- A Supabase project with PostGIS support.
- A map style provider, or the default keyless OpenFreeMap style.
- Optional but recommended for production: an Upstash Redis database.
- Optional: a Mapbox token for merchant geocoding.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env.local
```

At minimum, configure:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The secret Supabase key is server-only. Never expose it through a `NEXT_PUBLIC_` variable or commit `.env.local`.

Map display defaults to OpenFreeMap and does not require a key. To use MapTiler:

```dotenv
NEXT_PUBLIC_MAP_STYLE_URL=https://api.maptiler.com/maps/streets-v2/style.json
NEXT_PUBLIC_MAP_TILES_API_KEY=your-maptiler-key
```

For merchant address geocoding (submission and admin place editing):

```dotenv
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

The token powers Mapbox Geocoding, proximity-biased POI search, and the Mapbox Search Box forward API for merchant-name lookups.

For Redis caching and distributed rate limiting:

```dotenv
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-write-token
UPSTASH_REDIS_REST_READONLY_TOKEN=your-read-only-token
```

See [`.env.example`](.env.example) for all supported settings and legacy Supabase key fallbacks.

### 3. Apply the database schema

Using a hosted Supabase project:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

The migrations create the database tables, least-privilege RLS policies and grants, restricted function ACLs, bounded PostGIS functions and indexes, the default Amex Cobalt card product, report aggregation support, moderation fields, and optimized viewport queries. The Stage A security chain is `20260714120000`–`20260714170000`. See [`supabase/migrations/README.md`](supabase/migrations/README.md) for migration ownership, local/hosted workflows, deployment, and drift-repair rules.

For a fully local Supabase stack, install the Supabase CLI and Docker, then run:

```bash
npx supabase start
npx supabase db reset
```

Copy the local API URL and keys printed by the CLI into `.env.local`.

Verify the database security boundary locally:

```bash
npm run test:rls
```

The dedicated GitHub Actions `rls-tests` job starts a fresh local Supabase stack,
applies every migration, and runs the same suite. The suite creates and deletes
test users and rows, so do not point it at production.

### 4. Configure authentication

In the Supabase dashboard:

- Set the site URL to `http://localhost:3000` for local development.
- Add `http://localhost:3000/auth/callback` to allowed redirect URLs.
- Enable Google if Google OAuth is required and provide its client ID and secret.
- Configure a production site URL and callback URL before deployment.

Email templates are stored in `supabase/templates/`. For hosted Supabase, copy them into Authentication → Email Templates. A custom SMTP sender is recommended for production deliverability.

### 5. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Configure Vercel deployments

The deployment workflow in [`.github/workflows/vercel-deploy.yml`](.github/workflows/vercel-deploy.yml) deploys only the development branch:

| Git branch | Vercel environment | Purpose |
| --- | --- | --- |
| `main` | Preview | Full development and preview application |

The `release` branch is intentionally outside this workflow. Production remains
manual or can be added later as a separately protected deployment workflow; its
current content is the static Under Production shell.

Configure these GitHub Actions secrets before enabling the workflow:

- `VERCEL_TOKEN`: a Vercel access token with permission to deploy the project
- `VERCEL_ORG_ID`: the project team or account ID
- `VERCEL_PROJECT_ID`: the Vercel project ID

The IDs are available in `.vercel/project.json` after running `vercel link`; the
`.vercel` directory remains gitignored. The workflow uploads the source through
Vercel CLI, then Vercel builds it inside the Preview environment so encrypted
and sensitive project variables are available during build and at runtime.
Opening a pull request targeting `main` creates one Preview deployment; later
commits on that pull request do not redeploy it. Every direct push to `main`
also creates one Preview deployment. Neither trigger updates Production. Pull
requests from forks are skipped because GitHub does not expose deployment
secrets to untrusted fork workflows.

Create a GitHub Environment named `preview` if environment-level secrets or
deployment protection are desired. [`vercel.json`](vercel.json) disables
Vercel's native Git deployments, leaving this GitHub Actions workflow as the
only automatic Preview deployment path. The local `.vercel` project-linking
directory remains ignored separately and must not be committed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on all interfaces |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run import:rewards-canada:dry` | Preview 20 Rewards Canada import records |
| `npm run import:rewards-canada` | Run the historical Rewards Canada import |
| `./scripts/commit-segmented.sh --dry-run` | Preview segmented commits for the current working tree |
| `./scripts/commit-segmented.sh` | Create GPG-signed segmented commits (prompts for confirmation) |

Run the standard verification set before submitting changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Historical Rewards Canada import

The initial community dataset can be imported with the traceability script in `supabase/scripts/`. This is not part of the normal application workflow.

Always start with a dry run:

```bash
npm run import:rewards-canada:dry
```

Examples:

```bash
npm run import:rewards-canada -- --dry-run --limit 100
npm run import:rewards-canada -- --geocode city
npm run import:rewards-canada -- --geocode precise
npm run import:rewards-canada -- --local --geocode city
```

- `city` geocoding reuses city coordinates and applies a deterministic spread to prevent stacked points.
- `precise` geocoding attempts merchant-level locations.
- `--local` reads `data/rewards-canada/cobaltcanada.json` instead of downloading the source.
- Existing records are skipped using their external place ID.

The script requires Supabase credentials for a live import. See [`supabase/scripts/README.md`](supabase/scripts/README.md) for its status and purpose.

## API overview

| Route | Purpose |
| --- | --- |
| `GET /api/places/map` | Cached aligned-grid map points |
| `GET /api/places/viewport` | Exact viewport count/list supplement |
| `GET /api/places/search` | Merchant search |
| `GET /api/places/:id` | Merchant details and current summary |
| `POST /api/places` | Authenticated merchant creation |
| `GET /api/places/:id/reports` | Grouped recent reports for a place |
| `POST /api/places/:id/reports` | Authenticated multiplier report |
| `POST /api/places/:id/flags` | Authenticated content flag |
| `GET /api/me/reports` | Current user's reports (last 30 days, active/archive, paginated) |
| `DELETE /api/me/reports/:id` | Withdraw a pending user report |
| `GET /api/me/flags` | Current user's flags (last 30 days, active/archive, paginated) |
| `GET /api/admin/flags` | Open flags grouped by place (`{ flagGroups }`) |
| `PATCH /api/admin/flags/:id` | Resolve or dismiss all open flags on that flag's place |
| `GET /api/admin/places` | Merchant lookup (name, postal, address, or place UUID) |
| `/api/admin/*` | Other moderator/admin operations |

All request input is validated with Zod. Public reads use short CDN caching; authenticated and administrative responses are private and not cached publicly.

## Roles and rate limits

| Capability | Guest | User | Moderator | Admin |
| --- | :---: | :---: | :---: | :---: |
| Browse map and place details | ✓ | ✓ | ✓ | ✓ |
| Submit merchants, reports, and flags |  | ✓ | ✓ | ✓ |
| Review reports and flags |  |  | ✓ | ✓ |
| Manage users and roles |  |  |  | ✓ |

Default write limits are configured in `config/constants.ts`:

- 20 reports per user per day.
- 60 seconds minimum between any two report submissions from the same account.
- 5 merchant submissions per user per day.
- 50 write requests per IP per hour.
- One active report per user, merchant, and UTC day.

Place detail pages show recent reports grouped by multiplier and purchase context (for example, “3 users reported this (5x, In-store)”). Each underlying report is still stored separately; reputation and aggregation operate on individual rows.

**Admin flag review** merges open flags by place. One resolve/dismiss action clears the whole group; reputation credit or penalty applies once per reporter per review, not once per flag row.

With Upstash configured, limits are shared across application instances using atomic Redis operations. Otherwise, limits are process-local and reset when the server restarts.

Report totals (`report_count`) increment on every submission and decrement when you delete your own active report.

### Account activity

The `/account` page lists your **reports** and **flags** from the **last 30 days** only. Each list has **Active** and **Archive** tabs:

- **Reports — Active:** still live on the map and not yet staff-reviewed. **Archive:** reviewed, flagged, or removed.
- **Flags — Active:** still open in the moderation queue. **Archive:** resolved or dismissed.

You can remove only pending error/new-location reports that staff have not reviewed. Lists are cached per user for about two minutes and refresh after you submit or delete a report or submit a flag.

## Database model

The main tables are:

- `profiles`: usernames, roles, status, reputation, and contribution counts.

Reputation (`reputation_score`) is updated automatically:

- **+1** when you submit an auto-approved **confirm** or **update** report.
- **+2** when staff approve your **error** report; **−2** when they remove it as invalid.
- **+5** when staff accept your **new location** report; **−3** when they remove it as invalid.
- **+2** when staff **resolve** your place flag; **−2** when they **dismiss** it as invalid (once per review, even if you submitted multiple flags on the same place).
- **−2** when staff remove your active confirm or update report.
- **−1** when you delete your own confirm or update report.

You cannot submit reports or flags when reputation is **below −10**. Admins can override reputation from the admin Users tab. Moderators cannot edit reputation directly.

- `card_products`: supported card definitions; migrations seed Amex Cobalt.
- `places`: merchant identity, category, address, status, and PostGIS location.
- `multiplier_reports`: community transaction reports and moderation state.
- `place_multiplier_summaries`: materialized aggregate for each place/card pair.
- `place_flags`: community data-quality flags.
- `moderation_logs`: staff audit history.

Database access is protected with Row Level Security. Privileged server operations use the secret Supabase client and must never be moved into browser code.

## Project structure

```text
app/                  pages and API route handlers
components/           map, auth, account, admin, place, and UI components
config/               application constants and category definitions
lib/                  auth, cache, geocoding, map, reputation, validation, and utilities
server/repositories/  database access
server/services/      business logic and aggregation
server/validation/    server request schemas
supabase/migrations/  ordered database schema changes
supabase/scripts/     historical data import tools
supabase/templates/   hosted Supabase email templates
__tests__/            Vitest unit and integration-style tests
```

## Production checklist

1. Apply all Supabase migrations and confirm migration history through `20260714170000`.
2. Set production Supabase, application URL, and map environment variables.
3. Configure production auth callback URLs and email delivery.
4. Configure both Upstash read and write tokens.
5. Keep `SUPABASE_SECRET_KEY` server-only.
6. Run lint, typecheck, tests, and the production build.
7. Verify map API `Server-Timing` values and Redis hit behaviour.
8. Replace the monitoring stub in `lib/monitoring/sentry.ts` with a real provider if production error reporting is required.

## Data attribution

The initial merchant dataset was derived from the Rewards Canada community Cobalt list. The original source is linked in the application footer. Subsequent data is maintained through community submissions and moderation.
