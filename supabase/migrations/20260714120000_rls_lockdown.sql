-- Stage A P0: least-privilege RLS lockdown.
-- Mutations go through Next.js APIs with the service role; authenticated clients
-- must not bypass rate limits, reputation gates, or role/status protection.

-- ---------------------------------------------------------------------------
-- profiles: own-row SELECT only; no client UPDATE (role/status/reputation risk)
-- ---------------------------------------------------------------------------

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- places: keep public active SELECT for map/RPC; remove direct client INSERT
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can create places" on public.places;

-- ---------------------------------------------------------------------------
-- multiplier_reports: no public raw SELECT / INSERT / soft-delete via client JWT.
-- Own-row SELECT remains for account history APIs using the user-scoped client.
-- ---------------------------------------------------------------------------

drop policy if exists "Active reports are viewable by everyone" on public.multiplier_reports;
drop policy if exists "Authenticated users can create reports" on public.multiplier_reports;
drop policy if exists "Users can soft-delete own active reports" on public.multiplier_reports;

-- ---------------------------------------------------------------------------
-- place_flags: keep own-row SELECT; remove direct client INSERT
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can create flags" on public.place_flags;
