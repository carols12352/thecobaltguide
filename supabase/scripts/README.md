# Supabase scripts

Historical one-off scripts kept for traceability. These are **not** part of normal app development.

| Script | Purpose |
|--------|---------|
| `import-rewards-canada.ts` | Initial Rewards Canada Cobalt merchant import into Supabase |

Run from repo root:

```bash
npx tsx supabase/scripts/import-rewards-canada.ts --dry-run --limit 10
```

Requires `.env.local` with Supabase credentials. Schema lives in `supabase/migrations/`.
