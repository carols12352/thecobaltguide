-- Make policy roles explicit and make future public-schema objects default-deny.

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Brands are viewable by everyone" on public.merchant_brands;
create policy "Brands are viewable by everyone"
  on public.merchant_brands for select
  to anon, authenticated
  using (true);

drop policy if exists "Active card products are viewable by everyone" on public.card_products;
create policy "Active card products are viewable by everyone"
  on public.card_products for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Active places are viewable by everyone" on public.places;
create policy "Active places are viewable by everyone"
  on public.places for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "Users can view own reports regardless of status"
  on public.multiplier_reports;
create policy "Users can view own reports regardless of status"
  on public.multiplier_reports for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Summaries are viewable by everyone"
  on public.place_multiplier_summaries;
create policy "Summaries are viewable by everyone"
  on public.place_multiplier_summaries for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can view own flags" on public.place_flags;
create policy "Users can view own flags"
  on public.place_flags for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "No direct client access to moderation logs"
  on public.moderation_logs;
create policy "No direct client access to moderation logs"
  on public.moderation_logs for select
  to anon, authenticated
  using (false);

-- Migrations run as postgres, so secure future migration-created objects.
-- Supabase does not allow this role to change supabase_admin's defaults;
-- schema changes should therefore continue to go through migrations.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
