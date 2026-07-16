-- Atomically replace the one-time Rewards Canada seed after chunked staging.
-- Staging tables are service-role-only and never exposed to application users.

create table public.rewards_canada_place_import_stage (
  run_id uuid not null,
  external_place_id text not null,
  name text not null,
  normalized_name text not null,
  address_line1 text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  country_code char(2) not null default 'CA',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  category text not null,
  accepts_amex boolean not null default true,
  multiplier public.multiplier_value not null,
  primary key (run_id, external_place_id)
);

create table public.rewards_canada_online_import_stage (
  run_id uuid not null,
  external_source_id text not null,
  merchant_name text not null,
  normalized_name text not null,
  city text,
  province text,
  country_code char(2) not null default 'CA',
  multiplier public.multiplier_value not null,
  category text not null,
  source_url text not null,
  source_updated_at timestamptz,
  primary key (run_id, external_source_id)
);

alter table public.rewards_canada_place_import_stage enable row level security;
alter table public.rewards_canada_online_import_stage enable row level security;

revoke all privileges on table public.rewards_canada_place_import_stage
  from public, anon, authenticated, service_role;
revoke all privileges on table public.rewards_canada_online_import_stage
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.rewards_canada_place_import_stage
  to service_role;
grant select, insert, update, delete on table public.rewards_canada_online_import_stage
  to service_role;

create or replace function public.replace_rewards_canada_seed(
  p_run_id uuid,
  p_card_product_id uuid,
  p_expected_place_count integer,
  p_expected_online_count integer,
  p_replace_all_places boolean default false,
  p_allow_cascade boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '10min'
as $$
declare
  v_place_count integer;
  v_online_count integer;
  v_deleted_places integer;
  v_deleted_coverages integer;
  v_deleted_online integer;
begin
  perform pg_advisory_xact_lock(hashtext('replace_rewards_canada_seed'));

  select count(*)::integer into v_place_count
  from public.rewards_canada_place_import_stage
  where run_id = p_run_id;

  select count(*)::integer into v_online_count
  from public.rewards_canada_online_import_stage
  where run_id = p_run_id;

  if v_place_count = 0
     or v_place_count <> p_expected_place_count
     or v_online_count <> p_expected_online_count then
    raise exception 'INCOMPLETE_REWARDS_CANADA_STAGE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.card_products
    where id = p_card_product_id and slug = 'amex-cobalt-ca'
  ) then
    raise exception 'INVALID_COBALT_CARD_PRODUCT' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.rewards_canada_place_import_stage
    where run_id = p_run_id
      and external_place_id not like 'rewards-canada:%'
  ) then
    raise exception 'INVALID_REWARDS_CANADA_EXTERNAL_ID' using errcode = 'P0001';
  end if;

  -- Map reads can continue on their existing snapshot, while concurrent place,
  -- report, and flag writes wait for the atomic replacement to finish.
  lock table public.places in share row exclusive mode;
  lock table public.multiplier_reports in share row exclusive mode;
  lock table public.place_flags in share row exclusive mode;

  if not p_allow_cascade and exists (
    select 1
    from public.places p
    where (p_replace_all_places or coalesce(p.external_place_id, '') like 'rewards-canada:%')
      and (
        exists (select 1 from public.multiplier_reports r where r.place_id = p.id)
        or exists (select 1 from public.place_flags f where f.place_id = p.id)
        or exists (
          select 1 from public.moderation_logs ml
          where ml.entity_type = 'place' and ml.entity_id = p.id
        )
      )
  ) then
    raise exception 'SEED_PLACES_HAVE_COMMUNITY_DATA' using errcode = 'P0001';
  end if;

  delete from public.merchant_multiplier_coverages
  where external_source_id like 'rewards-canada:%';
  get diagnostics v_deleted_coverages = row_count;

  delete from public.online_merchant_multipliers
  where external_source_id like 'rewards-canada:%';
  get diagnostics v_deleted_online = row_count;

  delete from public.places
  where p_replace_all_places
     or coalesce(external_place_id, '') like 'rewards-canada:%';
  get diagnostics v_deleted_places = row_count;

  insert into public.places (
    name, normalized_name, address_line1, city, province, postal_code,
    country_code, location, category, accepts_amex, external_place_id, status
  )
  select
    s.name, s.normalized_name, s.address_line1, s.city, s.province,
    s.postal_code, s.country_code,
    extensions.st_setsrid(
      extensions.st_makepoint(s.longitude, s.latitude), 4326
    )::extensions.geography,
    s.category, s.accepts_amex, s.external_place_id, 'active'
  from public.rewards_canada_place_import_stage s
  where s.run_id = p_run_id;

  insert into public.place_multiplier_summaries (
    place_id, card_product_id, current_multiplier, confidence_score,
    confidence_level, recent_report_count, unique_reporter_count,
    last_reported_at, score_1x, score_2x, score_3x, score_5x, updated_at
  )
  select
    p.id, p_card_product_id, s.multiplier, 1, 'high', 0, 0,
    null, 0, 0, 0, 0, now()
  from public.rewards_canada_place_import_stage s
  join public.places p on p.external_place_id = s.external_place_id
  where s.run_id = p_run_id;

  insert into public.online_merchant_multipliers (
    merchant_name, normalized_name, city, province, country_code,
    card_product_id, multiplier, category, external_source_id,
    source_url, source_updated_at
  )
  select
    merchant_name, normalized_name, city, province, country_code,
    p_card_product_id, multiplier, category, external_source_id,
    source_url, source_updated_at
  from public.rewards_canada_online_import_stage
  where run_id = p_run_id;

  delete from public.rewards_canada_place_import_stage where run_id = p_run_id;
  delete from public.rewards_canada_online_import_stage where run_id = p_run_id;

  return jsonb_build_object(
    'insertedPlaces', v_place_count,
    'insertedOnlineMerchants', v_online_count,
    'deletedPlaces', v_deleted_places,
    'deletedCoverages', v_deleted_coverages,
    'deletedOnlineMerchants', v_deleted_online
  );
end;
$$;

revoke all on function public.replace_rewards_canada_seed(
  uuid, uuid, integer, integer, boolean, boolean
)
  from public, anon, authenticated, service_role;
grant execute on function public.replace_rewards_canada_seed(
  uuid, uuid, integer, integer, boolean, boolean
)
  to service_role;
