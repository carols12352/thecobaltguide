# Database / RLS tests

These tests verify Row Level Security, table grants, and function ACLs after the
Stage A corrective migration chain (`20260714120000`–`20260714170000`).

They require a running local Supabase with migrations applied. They are separate
from the default `npm test` suite and run in the CI `rls-tests` job.

> [!WARNING]
> The suite creates and deletes Auth users and business-table fixtures. Run it
> only against local Supabase or a disposable staging project, never production.

## Run

```bash
# From repo root, with Docker available:
supabase start
supabase db reset   # applies all migrations cleanly

npm run test:rls
```

GitHub Actions starts a fresh local Supabase stack, applies every migration, and
runs the same command for pushes and pull requests targeting `main`.

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

## What is covered

| Role | Expectations |
| --- | --- |
| anon | Read active places / summaries / card products; cannot read others' profiles; cannot insert places/reports/flags; cannot update profiles |
| authenticated user | Read own profile / reports / flags; cannot escalate role/status/reputation; cannot insert places/reports/flags; cannot write moderation_logs |
| moderator/admin JWT | No extra table policies; still cannot write moderation_logs without service role |

The 14-test suite also verifies inactive-row filtering, bounded public map RPC
behavior, catalogue/summary write denial, and service-only auth lookup isolation.
