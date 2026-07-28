# Database migrations

This directory is the version-controlled source of truth for the PostgreSQL
schema, RLS policies, grants, function ACLs, PostGIS RPCs, indexes, and database
seed records required by the application.

The application does not read these SQL files at runtime. Supabase CLI reads
them during local rebuilds and compares their timestamps with the remote
`supabase_migrations.schema_migrations` history during deployment.

## Why these files must remain in Git

Keep the complete ordered history because it provides:

- reproducible local, CI, staging, and replacement databases;
- incremental remote deployment through `supabase db push`;
- reviewable history for schema and authorization changes;
- recovery documentation independent of the current hosted project;
- regression testing from an empty database with `supabase db reset`.

A hosted database is runtime state, not a replacement for migration source.
Deleting old files can make clean rebuilds and new environments incomplete even
when the current remote project continues to work.

## Local workflow

Start Docker and the local Supabase stack, then rebuild from the complete
migration chain:

```bash
supabase start
supabase db reset
npm run test:rls
```

`supabase db reset` deletes and recreates only the local database. The RLS suite
creates and removes test users and rows, so never point it at production.

## Hosted workflow

Linking is local CLI configuration and is intentionally ignored by Git under
`supabase/.temp/`:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase migration list
supabase db push
supabase migration list
```

`supabase db push` is the direct deployment path to the linked hosted database.
It applies only migrations that are absent from the remote migration history.
Git push by itself does not deploy the database: the current GitHub Actions RLS
job starts an isolated local Supabase stack and validates migrations without
connecting to production.

For read-only remote auditing:

```bash
supabase migration list
supabase db dump --linked --schema public --file /tmp/remote-public.sql
```

Do not commit dump files, database passwords, access tokens, linked-project
state, or generated local keys.

## Adding a schema change

Create a new timestamped migration instead of editing a migration that has
already been applied to any shared environment:

```bash
supabase migration new <short_description>
```

Then:

1. Write the smallest forward-only SQL change.
2. Explicitly define RLS, table grants, and function EXECUTE privileges for any
   new exposed object.
3. Run `supabase db reset` to prove the entire history works from empty state.
4. Run `npm run test:rls`, `npm test`, lint, typecheck, and the production build
   as appropriate.
5. Commit the migration before applying it to a shared remote database.
6. Deploy with `supabase db push` and confirm with `supabase migration list`.

Avoid `CASCADE` in destructive migrations unless every dependent object is
known and intentionally included. Prefer safe failure and a follow-up migration.

## Drift and repair

Avoid editing schema, policies, grants, or functions directly in the Supabase
Dashboard. If emergency manual SQL changes are unavoidable, immediately capture
the intended final state in a new forward migration and verify it from a clean
local reset.

Never rewrite an applied migration merely to make local files resemble remote
state. Migration timestamps are deployment history; corrections belong in a new
migration so existing and fresh databases converge on the same result.

The Stage A RLS/privilege hardening, transactional write boundary, Rewards
Canada coverage schema, atomic seed replacement, and cascade consistency fix
are recorded in migrations `20260714120000` through `20260715150000`. The
replacement staging tables and RPC are service-role-only and are not an
application-runtime import path. Place provenance is recorded explicitly by
`20260727120000_place_source_kind.sql`; it marks the existing catalogue as
Rewards Canada data while keeping future community submissions distinct.
