# Supabase scripts

One-time database maintenance scripts. They are not part of normal application
runtime.

## Replace the Rewards Canada seed

The reviewed seed remains local at
`data/rewards-canada/cobaltcanada-canada-reviewed.json`. Preview and validate it
without credentials or database access:

```bash
npm run replace:rewards-canada
```

Apply migrations first, then replace only existing Rewards Canada seed rows:

```bash
npm run replace:rewards-canada -- --apply --replace
```

The apply path requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in
`.env.local`. It uploads data into service-role-only staging tables and invokes
one PostgreSQL transaction to replace the seed. Failed staging uploads or a
failed transaction do not delete the existing seed.

By default, replacement deletes only rows whose external identifiers start
with `rewards-canada:`. To intentionally replace every existing map place:

```bash
npm run replace:rewards-canada -- \
  --apply --replace --replace-all-places
```

The database refuses to delete places that have community reports, flags, or
moderation history. `--allow-cascade` overrides that protection and should only
be used on a pre-production database whose community data is disposable. The
corrective migration removes related moderation-log references and adjusts the
affected profiles' contribution counts before cascading those rows.

The local transformation removes reviewed brand/name conflicts and duplicate
display rows before staging. All review-only queues are excluded from import.
Legacy coverage rows are cleared; the replacement imports only reviewed
physical places and online merchants. Keep the ignored reviewed JSON only until
the database replacement has completed successfully.

After a successful transaction, the script bumps Redis map and search cache
versions when `UPSTASH_REDIS_REST_URL` and a write token are configured. It
prints `cache_versions_bumped: false` when no write token is available; in that
case clear the deployment cache or allow its normal TTL to expire.
