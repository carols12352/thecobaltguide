# Database integration and RLS tests

These tests verify Row Level Security, table grants, and function ACLs after the
Stage A corrective migration chain and subsequent Stage C privacy migrations.

They require a running local Supabase with migrations applied. They are separate
from the default `npm test` suite and run in the dedicated Database security
tests workflow. Stage B
transaction tests additionally exercise the service-role report RPC as one
business action.

> [!WARNING]
> The suite creates and deletes Auth users and business-table fixtures. Run it
> only against local Supabase or a disposable staging project, never production.

## Run

```bash
# From repo root, with Docker available:
supabase start
supabase db reset   # applies all migrations cleanly

npm run test:rls
npm run test:integration
```

`.github/workflows/rls-tests.yml` starts a fresh local Supabase stack, applies
every migration, and runs both commands for pushes and pull requests targeting
`main`; it can also be started manually with `workflow_dispatch`.

By default, the suite reads the active local URL and keys from
`supabase status -o json`; no credentials are hardcoded. Optional overrides:

```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
export SUPABASE_SERVICE_ROLE_KEY=<service_role>
npm run test:rls
```

If any override is set, provide the URL, anon/publishable key, and
service-role/secret key together. Partial overrides are rejected to prevent the
suite from combining credentials from different projects.

The transaction suite refuses non-local URLs unless
`ALLOW_REMOTE_DATABASE_TESTS=true` is also set. Use that override only for an
explicitly disposable staging project.

## What is covered

| Role | Expectations |
| --- | --- |
| anon | Read active places / summaries / card products; cannot read others' profiles; cannot insert places/reports/flags; cannot update profiles |
| authenticated user | Read own profile / reports / flags; cannot escalate role/status/reputation; cannot insert places/reports/flags; cannot write moderation_logs |
| moderator/admin JWT | No extra table policies; still cannot write moderation_logs without service role |

The 16-test suite also verifies inactive-row filtering, bounded public map RPC
behavior, catalogue/summary write denial, service-only auth lookup isolation,
and denial of direct access to transactional write/account-deletion RPCs.

The 4-test transactional suite verifies that report submission changes the
report, profile counter/reputation, and summary together; that a repeated daily
submission produces PostgreSQL conflict `23505` without another row; and that
deletion reverses the contribution atomically, and account deletion removes
identity/free-form content while retaining anonymous structured evidence.
