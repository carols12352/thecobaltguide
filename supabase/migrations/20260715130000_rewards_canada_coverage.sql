-- Keep non-point Rewards Canada evidence out of the map.
-- A province/country coverage rule has no truthful latitude/longitude.

create type public.merchant_coverage_scope as enum (
  'city_wide',
  'province_wide',
  'nationwide'
);

create table public.merchant_multiplier_coverages (
  id uuid primary key default extensions.uuid_generate_v4(),
  merchant_name text not null,
  normalized_name text not null,
  scope public.merchant_coverage_scope not null,
  city text,
  province text,
  country_code char(2) not null default 'CA',
  card_product_id uuid not null references public.card_products (id),
  multiplier public.multiplier_value not null,
  category text not null,
  external_source_id text not null unique,
  source_url text not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_coverages_scope_location_check check (
    (scope = 'city_wide' and city is not null and province is not null)
    or (scope = 'province_wide' and city is null and province is not null)
    or (scope = 'nationwide' and city is null and province is null)
  )
);

create index merchant_coverages_name_idx
  on public.merchant_multiplier_coverages (normalized_name);
create index merchant_coverages_scope_idx
  on public.merchant_multiplier_coverages (scope, province, city);

alter table public.merchant_multiplier_coverages enable row level security;

create policy "Coverages are viewable by everyone"
  on public.merchant_multiplier_coverages for select
  to anon, authenticated
  using (true);

revoke all privileges on table public.merchant_multiplier_coverages
  from anon, authenticated, service_role;
grant select on table public.merchant_multiplier_coverages
  to anon, authenticated;
grant select, insert, update, delete on table public.merchant_multiplier_coverages
  to service_role;

create trigger set_merchant_multiplier_coverages_updated_at
  before update on public.merchant_multiplier_coverages
  for each row execute function public.set_updated_at();

-- Online-only merchants have multiplier evidence but no physical coverage or
-- map location. Keep them separate so they cannot leak into place searches.
create table public.online_merchant_multipliers (
  id uuid primary key default extensions.uuid_generate_v4(),
  merchant_name text not null,
  normalized_name text not null,
  city text,
  province text,
  country_code char(2) not null default 'CA',
  card_product_id uuid not null references public.card_products (id),
  multiplier public.multiplier_value not null,
  category text not null,
  external_source_id text not null unique,
  source_url text not null,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index online_merchant_multipliers_name_idx
  on public.online_merchant_multipliers (normalized_name);
create index online_merchant_multipliers_province_idx
  on public.online_merchant_multipliers (province, city);

alter table public.online_merchant_multipliers enable row level security;

create policy "Online multipliers are viewable by everyone"
  on public.online_merchant_multipliers for select
  to anon, authenticated
  using (true);

revoke all privileges on table public.online_merchant_multipliers
  from anon, authenticated, service_role;
grant select on table public.online_merchant_multipliers
  to anon, authenticated;
grant select, insert, update, delete on table public.online_merchant_multipliers
  to service_role;

create trigger set_online_merchant_multipliers_updated_at
  before update on public.online_merchant_multipliers
  for each row execute function public.set_updated_at();
