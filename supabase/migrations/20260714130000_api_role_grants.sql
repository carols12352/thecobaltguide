-- Explicit Data API privileges for the RLS-protected public schema.
-- RLS controls which rows are visible; grants control which operations each
-- API role may attempt at all.

revoke all privileges on table
  public.profiles,
  public.merchant_brands,
  public.card_products,
  public.places,
  public.multiplier_reports,
  public.place_multiplier_summaries,
  public.place_flags,
  public.moderation_logs
from anon, authenticated, service_role;

-- Public catalogue/map data.
grant select on table
  public.merchant_brands,
  public.card_products,
  public.places,
  public.place_multiplier_summaries
to anon, authenticated;

-- Account history remains row-filtered by the ownership policies.
grant select on table
  public.profiles,
  public.multiplier_reports,
  public.place_flags
to authenticated;

-- Server-only application workflows use the secret/service-role client.
grant select, insert, update, delete on table
  public.profiles,
  public.merchant_brands,
  public.card_products,
  public.places,
  public.multiplier_reports,
  public.place_multiplier_summaries,
  public.place_flags,
  public.moderation_logs
to service_role;

-- Public map RPCs are SECURITY INVOKER and therefore still obey table RLS.
revoke all on function public.places_in_viewport(
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
) from public;
grant execute on function public.places_in_viewport(
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
) to anon, authenticated, service_role;

revoke all on function public.places_nearby(
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
) from public;
grant execute on function public.places_nearby(
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
) to anon, authenticated, service_role;

revoke all on function public.count_places_in_viewport(
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text
) from public;
grant execute on function public.count_places_in_viewport(
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text
) to anon, authenticated, service_role;

revoke all on function public.places_in_view_near(
  double precision,
  double precision,
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
) from public;
grant execute on function public.places_in_view_near(
  double precision,
  double precision,
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
) to anon, authenticated, service_role;

-- Trigger helpers are not RPC endpoints.
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;
