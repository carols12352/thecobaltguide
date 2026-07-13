Cobalt 5x Merchant Map — System Architecture

1. Project Overview

Cobalt 5x Merchant Map is a community-driven merchant multiplier discovery platform.

Users can:

* View nearby merchants on a map
* Check the recently reported multiplier for a specific merchant location
* Submit the multiplier they actually received
* View report volume, recency, and confidence level
* Report incorrect locations or suspicious data

The platform determines the most likely current multiplier for each merchant location based on the frequency and recency of community reports.

The platform provides community-sourced reference data and does not guarantee how a card issuer will ultimately classify a transaction.

⸻

2. Product Goals

Core Goals

1. Help users quickly find nearby merchants that may earn 5x points
2. Collect community reports through a low-friction submission flow
3. Prioritize recent reports instead of lifetime totals
4. Track data at the individual merchant-location level, not only by brand
5. Keep the initial system simple while allowing future support for multiple credit cards

Non-Goals

The initial version does not include:

* Statement screenshot uploads
* OCR processing
* Bank account connections
* Automatic transaction imports
* Complex redemption calculations
* Gift card inventory tracking
* Native mobile applications
* Microservices

⸻

3. Recommended Technology Stack

Layer	Technology
Web framework	Next.js with TypeScript
UI	Tailwind CSS and shadcn/ui
Map rendering	MapLibre GL JS
Map tiles	MapTiler, Mapbox, or another compatible provider
Address search	Mapbox Geocoding, Google Places, or another geocoding provider
Database	PostgreSQL
Geospatial support	PostGIS
Database hosting	Supabase
Authentication	Supabase Auth
Backend APIs	Next.js Route Handlers
Server-side logic	Next.js Server Actions and server services
Deployment	Vercel
DNS and CDN	Cloudflare
Error monitoring	Sentry
Product analytics	PostHog or Vercel Analytics
Rate limiting	Upstash Redis when needed
Email	Resend when needed
CI/CD	GitHub Actions and Vercel

⸻

4. High-Level Architecture

┌───────────────────────────────────────────────┐
│                 User Browser                  │
│                                               │
│  Map, search, place details, reports, account │
└──────────────────────┬────────────────────────┘
                       │ HTTPS
                       ▼
┌───────────────────────────────────────────────┐
│             Cloudflare / Vercel CDN           │
│                                               │
│  Static assets, caching, TLS, basic protection│
└──────────────────────┬────────────────────────┘
                       ▼
┌───────────────────────────────────────────────┐
│                    Next.js                    │
│                                               │
│  Server Components                            │
│  Client Components                            │
│  Route Handlers                               │
│  Server Actions                               │
│  Admin dashboard                              │
│  Authorization                               │
│  Business services                            │
└───────────────┬───────────────────┬───────────┘
                │                   │
                ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────┐
│ Supabase                 │  │ Third-Party Map APIs │
│                          │  │                      │
│ PostgreSQL               │  │ Map tiles            │
│ PostGIS                  │  │ Address search        │
│ Auth                     │  │ Geocoding             │
│ Row Level Security       │  └──────────────────────┘
└───────────────┬──────────┘
                │
                ▼
┌──────────────────────────┐
│ Optional Infrastructure  │
│                          │
│ Redis cache              │
│ Rate limiting            │
│ Background jobs          │
│ Sentry                   │
│ PostHog                   │
└──────────────────────────┘

⸻

5. System Modules

5.1 Map Module

Responsibilities:

* Request the user’s approximate location
* Display merchants inside the visible map area
* Filter by multiplier, category, recency, and confidence
* Load new data when the map moves
* Display clusters at low zoom levels
* Display individual merchant locations at high zoom levels

The map API must only return locations inside the current viewport. It must not return every merchant in the database.

Example request:

GET /api/places/map
  ?north=43.80
  &south=43.60
  &east=-79.20
  &west=-79.60
  &zoom=13
  &multiplier=5
  &category=grocery

Example response:

{
  "places": [
    {
      "id": "place-id",
      "name": "Example Market",
      "latitude": 43.65,
      "longitude": -79.38,
      "multiplier": 5,
      "confidenceLevel": "high",
      "recentReportCount": 12,
      "lastReportedAt": "2026-07-10"
    }
  ],
  "truncated": false
}

The response should remain small and contain only the fields required by the map.

⸻

5.2 Place Module

A place represents a specific physical merchant location, not an entire brand.

Example:

Brand: Metro
Place: Metro — 123 Example Street, Toronto

A place page should display:

* Merchant name
* Address
* Merchant category
* Whether American Express is accepted
* Most likely current multiplier
* Number of recent reports
* Date of the latest report
* Recent multiplier distribution
* Historical changes
* Report submission entry point
* Incorrect-place reporting entry point

⸻

5.3 Multiplier Report Module

The report form should remain simple.

Required fields:

Merchant location
Actual multiplier: 1x / 2x / 3x / 5x
Transaction date
Purchase context: in-store / online / gas pump / delivery / other

Optional fields:

* Short note
* Confirmation that the merchant accepts American Express

The platform does not need:

* Statement screenshots
* Transaction amounts
* Full statement descriptors
* Credit card digits

Submission flow:

User submits a report
        ↓
Validate authentication and input
        ↓
Check duplicate submissions and rate limits
        ↓
Insert multiplier report
        ↓
Recalculate the location summary
        ↓
Update place multiplier summary
        ↓
Invalidate place and map-region caches

⸻

5.4 Community Aggregation Module

The system should not use lifetime report totals.

Merchant classification can change over time, so recent reports should have more influence than older reports.

Recommended initial weighting:

Report age	Weight
0–30 days	1.00
31–90 days	0.50
91–180 days	0.20
More than 180 days	Excluded from the current result

Weighted multiplier score:

Weighted score for a multiplier
=
sum of the recency weights of all valid reports for that multiplier

Current multiplier:

current_multiplier
=
multiplier with the highest weighted score

Basic confidence:

confidence
=
winning multiplier score
/
total score across all multipliers

Example:

5x weighted score: 8.5
1x weighted score: 1.5
Total score: 10
Current multiplier: 5x
Agreement: 85%

The user interface does not have to expose an exact percentage. It can use confidence labels.

Condition	Display
Fewer than 2 reports	Insufficient data
Agreement below 60%	Disputed
Agreement between 60% and 80%	Medium confidence
Agreement above 80% with at least 3 unique reporters	High confidence
Multiple matching reports within 30 days	Recently confirmed

⸻

5.5 Administration Module

The admin dashboard handles exceptions rather than manually reviewing every normal submission.

Responsibilities:

* View recent submissions
* Remove or restore reports
* Merge duplicate places
* Edit place information
* Mark locations as permanently closed
* Review user-submitted flags **grouped by place** (resolve/dismiss all open flags on a place in one action; reputation once per reporter)
* Suspend abusive accounts
* Review unusually high submission activity
* Review places with conflicting reports
* Look up merchants by name, postal code, address, or place UUID from the Places tab
* Edit a merchant in moderator view (`/admin/places/:id`): tiered geocode lookup (postal → address → name + city) with Mapbox Geocoding, Nominatim, and Mapbox Search Box; strict city filtering; multiple ranked matches; field backfill

Report removal uses soft deletion (`status = removed`).

⸻

5.6 User and Permission Module

Recommended login methods:

* Google authentication
* Email magic link
* Anonymous browsing
* Authentication required for submissions

Roles:

user
moderator
admin

Permissions:

Action	Guest	User	Moderator	Admin
Browse map	Yes	Yes	Yes	Yes
View places	Yes	Yes	Yes	Yes
Submit multiplier	No	Yes	Yes	Yes
Create place	No	Yes	Yes	Yes
Flag content	No	Yes	Yes	Yes
Remove suspicious reports	No	No	Yes	Yes
Manage users	No	No	No	Yes
Change system configuration	No	No	No	Yes

⸻

5.7 Account Module

The account page shows a signed-in user’s recent contribution history and security settings.

Responsibilities:

* Display reputation score and contribution counts
* List the user’s reports and flags from the last 30 days
* Split reports into Active (live, unreviewed) and Archive (reviewed, flagged, or removed)
* Split flags into Active (open) and Archive (resolved or dismissed)
* Allow self-service removal of pending error/new-location reports only
* Cache list responses per user in Redis (short TTL) and invalidate on report/flag mutations

⸻

6. Data Model

6.1 profiles

Stores application-level user information.

profiles
├── id
├── username
├── role
├── reputation_score
├── report_count
├── status
├── created_at
└── updated_at

Authentication credentials remain managed by Supabase Auth.

Reputation rules (v1):

* +1 when a user submits an auto-approved confirm or update report
* +2 when staff approve an error report; −2 when staff remove it as invalid
* +5 when staff accept a new location report; −3 when staff remove it as invalid
* +2 when staff resolve a place flag; −2 when staff dismiss it as invalid (once per reporter per place review, even if they submitted multiple flags)
* −2 when staff remove an active confirm or update report
* −1 when the reporter deletes their own confirm or update report
* Users with reputation below −10 cannot submit reports or flags
* Admins may set `reputation_score` manually; moderators may not
* `report_count` tracks submitted reports and decreases when users delete their own active reports

Future phases may add tiers, badges, and privilege gates based on reputation. Complex reputation levels remain out of scope for the MVP.

⸻

6.2 merchant_brands

Stores reusable brand information.

merchant_brands
├── id
├── name
├── normalized_name
├── category
├── website
├── logo_url
├── created_at
└── updated_at

A place does not need to belong to a brand. Independent merchants may have no brand_id.

⸻

6.3 places

Stores individual physical merchant locations.

places
├── id
├── brand_id
├── name
├── normalized_name
├── address_line1
├── city
├── province
├── postal_code
├── country_code
├── location
├── category
├── accepts_amex
├── external_place_id
├── status
├── created_by
├── created_at
└── updated_at

The location field should use:

geography(Point, 4326)

A PostGIS GiST index must be created for this field.

⸻

6.4 multiplier_reports

Stores raw community reports.

multiplier_reports
├── id
├── place_id
├── user_id
├── card_product_id
├── multiplier
├── transaction_date
├── payment_context
├── notes
├── status
├── moderation_reason
├── created_at
└── updated_at

Possible statuses:

active
removed
flagged

⸻

6.5 card_products

Allows future support for multiple credit cards.

card_products
├── id
├── issuer
├── product_name
├── slug
├── country_code
├── active
├── created_at
└── updated_at

Initial record:

issuer: American Express
product_name: Cobalt Card
slug: amex-cobalt-ca
country_code: CA

Even if the first version supports only Cobalt, reports and summaries should include a card_product_id.

⸻

6.6 place_multiplier_summaries

Stores precomputed multiplier results for each place and card product.

place_multiplier_summaries
├── place_id
├── card_product_id
├── current_multiplier
├── confidence_score
├── confidence_level
├── recent_report_count
├── unique_reporter_count
├── last_reported_at
├── score_1x
├── score_2x
├── score_3x
├── score_5x
└── updated_at

Map requests should read this table rather than aggregating raw reports on every request.

⸻

6.7 place_flags

Stores community reports about incorrect place data.

place_flags
├── id
├── place_id
├── user_id
├── reason
├── details
├── status
├── resolved_by
├── created_at
└── resolved_at

Possible reasons:

duplicate
wrong_address
permanently_closed
does_not_accept_amex
incorrect_category
other

⸻

6.8 moderation_logs

Stores administrator and moderator actions.

moderation_logs
├── id
├── moderator_id
├── entity_type
├── entity_id
├── action
├── reason
├── metadata
└── created_at

⸻

7. Data Relationships

profiles
   │
   ├──── creates ──── places
   │
   ├──── submits ─── multiplier_reports
   │
   └──── creates ─── place_flags
merchant_brands
   │
   └──── has many ── places
places
   │
   ├──── has many ── multiplier_reports
   ├──── has many ── place_flags
   └──── has many ── place_multiplier_summaries
card_products
   │
   ├──── has many ── multiplier_reports
   └──── has many ── place_multiplier_summaries

⸻

8. API Design

8.1 Public Endpoints

GET /api/places/map
GET /api/places/search
GET /api/places/:id
GET /api/places/:id/reports
GET /api/cards

`GET /api/places/:id/reports` returns grouped recent reports: `{ groups, totalReports }`. Groups combine active reports with the same multiplier and payment context; `reporterCount` is unique users, while `reportCount` is total submissions. Reputation and aggregation still operate on individual report rows.

⸻

8.2 Authenticated User Endpoints

POST   /api/places
POST   /api/places/:id/reports
POST   /api/places/:id/flags
GET    /api/me/reports
DELETE /api/me/reports/:id
GET    /api/me/flags

Account list endpoints return only items from the last 30 days, support `view=active|archive` and pagination, and are cached per user in Redis with invalidation on submit/delete.

Deleting a user’s own report should use soft deletion.

⸻

8.3 Administration Endpoints

GET   /api/admin/reports
PATCH /api/admin/reports/:id
GET   /api/admin/flags          → `{ flagGroups }` (open flags merged by place)
PATCH /api/admin/flags/:id      → resolves/dismisses all open flags for that flag's place
PATCH /api/admin/places/:id/flags → bulk resolve/dismiss for a place
GET   /api/admin/places
PATCH /api/admin/places/:id
POST  /api/admin/places/merge
PATCH /api/admin/users/:id

`GET /api/admin/places` requires at least one of `name`, `postalCode`, `addressLine1`, or `placeId` for search; multiple fields narrow results with AND logic.

⸻

9. Frontend Page Structure

/
├── Map
├── Search
├── Multiplier filters
├── Category filters
└── Nearby place list
/place/[id]
├── Place details
├── Current multiplier
├── Confidence level
├── Recent multiplier distribution
├── Report history
└── Submit report
/submit
├── Search existing places
├── Create new place
└── Submit multiplier
/account
├── My reports (30-day window, active/archive)
├── My flags (30-day window, active/archive)
└── Account settings
/admin
├── Data overview
├── Suspicious reports
├── Place flags
├── Places lookup (name/postal/address)
├── Moderator place view (geocode + edit current place)
├── Duplicate places
└── User management

⸻

10. Recommended Code Structure

src/
├── app/
│   ├── api/
│   │   ├── places/
│   │   ├── reports/
│   │   ├── cards/
│   │   └── admin/
│   ├── place/
│   ├── submit/
│   ├── account/
│   ├── admin/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── map/
│   ├── places/
│   ├── reports/
│   ├── filters/
│   ├── admin/
│   └── ui/
│
├── server/
│   ├── services/
│   │   ├── place-service.ts
│   │   ├── report-service.ts
│   │   ├── summary-service.ts
│   │   ├── moderation-service.ts
│   │   └── geocoding-service.ts
│   │
│   ├── repositories/
│   │   ├── place-repository.ts
│   │   ├── report-repository.ts
│   │   └── user-repository.ts
│   │
│   ├── policies/
│   ├── validation/
│   └── jobs/
│
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── map/
│   ├── rate-limit/
│   └── monitoring/
│
├── types/
└── config/

Business logic should not be placed directly inside page components or Route Handlers.

Recommended request flow:

Route Handler
      ↓
Service
      ↓
Repository
      ↓
PostgreSQL

This structure makes it easier to move the backend into a separate service later without rewriting the core business rules.

⸻

11. Place Creation and Duplicate Detection

Place creation flow:

User enters merchant name or address
        ↓
Search internal database first
        ↓
Call external address search if no result is found
        ↓
User confirms the exact location
        ↓
Backend performs duplicate detection
        ↓
Create the place
        ↓
User submits the first multiplier report

Duplicate detection may use:

* External provider place ID
* Geographic distance
* Normalized address
* Normalized merchant name
* Postal code
* Brand ID

Recommended rules:

Same external_place_id
→ treat as duplicate
or
Distance below 30 metres
and normalized names are similar
→ mark as a possible duplicate

Do not detect duplicates based only on merchant name.

⸻

12. Abuse Prevention and Data Quality

Baseline controls:

1. Authentication is required for submissions
2. A user may submit only once per place per day
3. Each user has a daily submission limit
4. New accounts have stricter submission limits
5. Multiple accounts from the same IP may trigger rate limits
6. Frequently flagged reports enter the moderation queue
7. Removed reports do not affect aggregation
8. Aggregation should count unique users, not raw request volume

Recommended initial limits:

Maximum 20 reports per user per day
Minimum 60 seconds between report submissions from the same account
Maximum 5 new places per user per day
One report per user, place, and 24-hour period
Maximum 50 write requests per IP per hour

Database constraints must enforce important rules. Frontend validation alone is not sufficient.

⸻

13. Geospatial Queries

The application has two main geospatial query patterns.

Viewport Query

Return places within the north, south, east, and west map bounds

Used when the user moves or zooms the map.

Nearby Query

Return places within a specified radius of a coordinate

Used for features such as “5x near me.”

Requirements:

* Use PostGIS
* Add a GiST index to places.location
* Limit the number of records returned
* Use clustering at low zoom levels
* Never return every merchant in the country in one request

⸻

14. Caching Strategy

Phase One

Use:

* Vercel CDN
* Next.js data caching
* Browser caching
* Debounced map requests

Recommended cache durations:

Content	Suggested cache duration
Place details	5–15 minutes
Map region data	1–5 minutes
Brand and category lists	1 hour
Personal user data	No shared cache
Admin pages	No cache or very short cache

Phase Two

Add Redis for:

* Map-region query caching
* Popular place caching
* API rate limiting
* Duplicate request prevention
* Background job locking

Example cache keys:

map:{zoom}:{tileX}:{tileY}:{card}:{multiplier}:{category}
place:{placeId}:{cardProductId}

When a report is submitted, invalidate only the affected place and nearby map-region caches.

⸻

15. Background Jobs

The initial version may update place summaries synchronously.

As report volume grows, summary calculation can move into a background job.

User submits report
        ↓
Database write succeeds
        ↓
Create summary refresh job
        ↓
Worker recalculates the place summary
        ↓
Update summary table
        ↓
Invalidate cache

Suitable background tasks include:

* Recalculating place multipliers
* Detecting duplicate places
* Detecting suspicious user activity
* Reapplying time decay to old reports
* Sending moderator notifications
* Refreshing external place metadata

Possible tools:

* Supabase Cron
* Inngest
* Trigger.dev
* A separate Node.js worker

⸻

16. Security Design

Server-Side Secrets

The following values must remain server-side:

* Supabase Service Role Key
* Private map-provider credentials
* Redis administrative credentials
* Server-side Sentry credentials
* Administrator authorization logic

Database Security

Enable Supabase Row Level Security.

Core rules:

* Public users may read public places and summaries
* Authenticated users may create their own reports
* Users may only edit or remove their own reports
* Regular users may not directly update summary tables
* Regular users may not modify other users’ profiles
* Administrative actions must pass server-side authorization checks

Input Validation

All write endpoints should use a shared validation schema, such as Zod.

Validate:

* UUIDs
* Allowed multiplier values
* Date ranges
* Coordinate ranges
* Text lengths
* Enum values
* User permissions

Frontend validation improves user experience, but server-side validation is mandatory.

⸻

17. Privacy Design

The platform should not collect:

* Credit card numbers
* Card suffixes
* Statement screenshots
* Bank login credentials
* Exact transaction amounts
* Full statement descriptors

The platform needs only:

* User account identifier
* Merchant location
* Multiplier
* Transaction date
* Optional payment context

Logs should not retain full IP addresses longer than necessary.

Public pages should not reveal a reporter’s real name or email address.

⸻

18. Observability

Monitor at least:

* API error rate
* Map query response time
* Database query duration
* Requests per minute
* Report submission success rate
* Summary refresh failures
* Third-party map API failures
* Daily new users
* Daily submitted reports
* Suspicious account activity

Recommended tools:

Sentry: errors and performance
PostHog: product analytics
Vercel Analytics: traffic and web performance
Supabase Dashboard: database performance

⸻

19. Deployment Environments

Recommended environments:

Development
Preview
Production

Development

Local Next.js application
Development Supabase project or local Supabase
Test map API credentials

Preview

Each pull request should receive an isolated preview deployment.

Vercel Preview
Shared staging database
Test OAuth callback URLs

Production

Vercel Production
Supabase Production
Cloudflare DNS
Production map API credentials
Sentry Production

Development and preview environments should not use the production database.

⸻

20. CI/CD

Recommended workflow:

Pull Request
      ↓
Lint
      ↓
Type Check
      ↓
Unit Tests
      ↓
Build
      ↓
Vercel Preview Deployment
      ↓
Review and Merge
      ↓
Production Deployment

Database migrations should live under:

supabase/migrations/

All database changes should be committed as migration files. Production database changes should not depend on undocumented manual edits.

⸻

21. Testing Strategy

Unit Tests

Test:

* Time-decay calculations
* Current multiplier selection
* Confidence calculations
* Rate-limit rules
* Merchant-name normalization
* Authorization policies

Integration Tests

Test:

* Place creation
* Report submission
* Summary recalculation
* Recalculation after report removal
* Map-boundary queries
* Row Level Security rules

End-to-End Tests

Test the main user journey:

Sign in
→ Search for a merchant
→ View the place
→ Submit a 5x report
→ Confirm the new report appears

⸻

22. Scaling Roadmap

Phase One: Single-City Validation

Scope:

* Toronto or the Greater Toronto Area
* One card product: Amex Cobalt
* Map browsing
* Place search
* Multiplier submission
* Recency-weighted aggregation
* Basic administration dashboard

Architecture:

Next.js + Supabase + PostGIS + Vercel

⸻

Phase Two: Major Canadian Cities

Add:

* Vancouver
* Montreal
* Calgary
* Ottawa
* Map clustering
* Duplicate-place detection
* Email notifications

⸻

Phase Three: Multiple Card Products

Potential support:

* American Express Cobalt
* Scotiabank Gold American Express
* Other points or cashback cards

The database should not require a major redesign because reports and summaries already reference card_product_id.

⸻

Phase Four: High-Traffic Optimization

Add when required:

* PostgreSQL read replicas
* Dedicated Redis
* Background workers
* Map vector tiles
* CDN-cached map data
* Database connection pooling
* Dedicated search service
* Separate backend API service

Possible future architecture:

Next.js Web
    │
    ▼
API Service
    ├── PostgreSQL Primary
    ├── PostgreSQL Read Replicas
    ├── Redis
    ├── Worker Queue
    └── Search Service

Services should only be separated when real traffic, operational constraints, or costs justify the added complexity.

⸻

23. Performance Principles

1. Load only the current map viewport
2. Return minimal fields from map endpoints
3. Precompute multiplier summaries
4. Do not aggregate raw reports during every map request
5. Use spatial indexes for all geospatial queries
6. Paginate every list and enforce maximum result limits
7. Debounce map movement requests by approximately 300–500 milliseconds
8. Cache public and frequently accessed data at the CDN
9. Never rely on client-side authorization for write operations
10. Optimize database queries before introducing microservices

⸻

24. Key Architecture Decisions

Why Use Next.js as a Full-Stack Framework

* Frontend and backend can share TypeScript types
* Fast initial development and deployment
* Pages, APIs, and administration tools can live in one repository
* Supports server rendering and search-engine optimization
* The service layer can later move to a separate backend

Why Use PostgreSQL

* Users, places, brands, reports, and cards are relational
* The platform requires transactions and constraints
* The platform requires aggregation and reporting
* PostGIS provides strong geospatial capabilities
* PostgreSQL has a clear long-term scaling and migration path

Why Not Use Firebase as the Primary Database

* Complex geospatial queries are less flexible than PostGIS
* Relational aggregation becomes more difficult
* The data model has clear relationships between users, places, reports, cards, and summaries
* Long-term query costs and access patterns may be harder to control

Why Not Start with Microservices

* Early traffic and team size do not justify the operational complexity
* Microservices increase deployment, testing, monitoring, and debugging overhead
* A well-structured monolith can support substantial usage
* Clear service boundaries allow later extraction when necessary

Why Not Require Screenshots

* Lower submission friction
* Lower privacy risk
* Lower storage and moderation costs
* Data quality can be maintained through recency weighting, unique-user counting, moderation, and rate limits

⸻

25. Recommended Initial Product Scope

The first version should include:

User authentication
Merchant map
Address and place search
Place details
Multiplier submission
Recency-weighted aggregation
New-place creation
Incorrect-place reporting
User report history
Administrator report removal
Place editing and merging
Basic rate limiting
Error monitoring

The first version should not include:

Screenshot uploads
OCR
Complex reputation levels
Badges
Comments
Messaging
Social networking
Native mobile applications
AI merchant recognition
Gift card inventory
Payments
Microservices
Kubernetes

⸻

26. Final Recommended Architecture

Frontend
Next.js + TypeScript + Tailwind CSS + MapLibre
Backend
Next.js Route Handlers
Server Actions
Service and repository layers
Database
Supabase PostgreSQL + PostGIS
Authentication
Supabase Auth
Deployment
Vercel + Cloudflare
Monitoring
Sentry + PostHog
Scaling
PostGIS indexes
Precomputed summaries
Map-region caching
Redis
Background workers
Read replicas
Vector tiles

The architecture is designed to support both early product validation and significant future growth.

The main principles are:

Keep the initial system as a modular monolith
Design the data model correctly from the beginning
Read precomputed summaries instead of aggregating on every request
Load data by map region
Scale through caching and database improvements first
Extract services only when real operational needs appear

⸻

27. Recent Delivery Summary (2026 Q2)

Shipped since the initial MVP — condensed:

| Area | What changed |
| --- | --- |
| **Reputation** | Automatic score updates on report submit/delete, staff approval/removal, and flag resolve/dismiss. Floor at −10 blocks new reports and flags. Admins can override score on the Users tab. |
| **Rate limits** | 60-second minimum between report submissions per account (in addition to daily and per-place limits). |
| **Account** | `/account` lists reports and flags from the last 30 days with Active/Archive tabs; short-lived Redis cache per user; pending error/new-location reports can be withdrawn. |
| **Place detail** | Recent reports returned and displayed as groups (multiplier + payment context); unique reporter count vs total submissions. |
| **Admin flags** | `GET /api/admin/flags` returns `{ flagGroups }`. One resolve/dismiss clears all open flags on a place; reputation adjusted once per reporter per review. |
| **Admin places** | Search by name, postal, address, or UUID; AND narrowing when multiple fields are set. |
| **Geocoding** | Tiered lookup (postal → address → name + city); Mapbox + Nominatim + Search Box POI; city-name street noise filtered; strict municipality match (no cross-city metro bleed). |
| **Caching** | User account list keys; admin flag cache; map version bump unchanged. |

Implementation pattern throughout: pure helpers in `lib/`, orchestration in `server/services/`, thin route handlers, Vitest coverage on scoring/grouping/parsing rules.

⸻

28. Near-Term Roadmap

**Next (quality and ops)**

* Deduplicate geocode results that share coordinates (e.g. Search Box + Nominatim for the same storefront).
* Email or in-app notifications when staff action a user's report or flag.
* Expand E2E coverage for submit → moderate → reputation flows.
* Wire Sentry (replace `lib/monitoring/sentry.ts` stub) and basic PostHog funnels.

**Medium term (product)**

* Duplicate-place suggestions surfaced to moderators (PostGIS distance + normalized name).
* Background summary refresh when report volume grows.
* Optional second card product (schema already supports `card_product_id`).
* Broader city rollout beyond initial seed data.

**Later (scale — only when traffic warrants)**

* Read replicas and connection pooling.
* Dedicated search index if Postgres text search becomes a bottleneck.
* Extract geocoding or moderation into a worker only if API latency or provider rate limits require it.

**Explicit non-goals for the next phase**

* Screenshots/OCR, microservices, native apps, gift-card inventory, payments.

The architecture remains a **modular monolith**: add capabilities behind services and cache boundaries first; split processes only when measured cost or reliability demands it.