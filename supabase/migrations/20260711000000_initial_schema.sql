-- Cobalt 5x Merchant Map — initial schema
-- Requires Supabase PostgreSQL with PostGIS enabled

create extension if not exists postgis with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.user_status as enum ('active', 'suspended');
create type public.place_status as enum ('active', 'permanently_closed', 'merged');
create type public.report_status as enum ('active', 'removed', 'flagged');
create type public.flag_reason as enum (
  'duplicate',
  'wrong_address',
  'permanently_closed',
  'does_not_accept_amex',
  'incorrect_category',
  'other'
);
create type public.flag_status as enum ('open', 'resolved', 'dismissed');
create type public.payment_context as enum (
  'in_store',
  'online',
  'gas_pump',
  'delivery',
  'other'
);
create type public.confidence_level as enum (
  'insufficient',
  'disputed',
  'medium',
  'high',
  'recently_confirmed'
);
create type public.multiplier_value as enum ('1', '2', '3', '5');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  role public.user_role not null default 'user',
  reputation_score integer not null default 0,
  report_count integer not null default 0,
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- merchant_brands
-- ---------------------------------------------------------------------------

create table public.merchant_brands (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  normalized_name text not null,
  category text,
  website text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index merchant_brands_normalized_name_idx
  on public.merchant_brands (normalized_name);

-- ---------------------------------------------------------------------------
-- card_products
-- ---------------------------------------------------------------------------

create table public.card_products (
  id uuid primary key default extensions.uuid_generate_v4(),
  issuer text not null,
  product_name text not null,
  slug text not null unique,
  country_code char(2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.card_products (issuer, product_name, slug, country_code)
values ('American Express', 'Cobalt Card', 'amex-cobalt-ca', 'CA');

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------

create table public.places (
  id uuid primary key default extensions.uuid_generate_v4(),
  brand_id uuid references public.merchant_brands (id) on delete set null,
  name text not null,
  normalized_name text not null,
  address_line1 text not null,
  city text not null,
  province text not null,
  postal_code text not null,
  country_code char(2) not null default 'CA',
  location extensions.geography(point, 4326) not null,
  category text not null,
  accepts_amex boolean,
  external_place_id text,
  status public.place_status not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_location_gist_idx on public.places using gist (location);
create index places_status_idx on public.places (status);
create index places_category_idx on public.places (category);
create unique index places_external_place_id_idx
  on public.places (external_place_id)
  where external_place_id is not null;
create index places_normalized_name_idx on public.places (normalized_name);

-- ---------------------------------------------------------------------------
-- multiplier_reports
-- ---------------------------------------------------------------------------

create table public.multiplier_reports (
  id uuid primary key default extensions.uuid_generate_v4(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_product_id uuid not null references public.card_products (id),
  multiplier public.multiplier_value not null,
  transaction_date date not null,
  payment_context public.payment_context not null,
  notes text,
  status public.report_status not null default 'active',
  moderation_reason text,
  created_at timestamptz not null default now(),
  created_on_utc date generated always as ((created_at at time zone 'UTC')::date) stored,
  updated_at timestamptz not null default now(),
  constraint multiplier_reports_notes_length check (
    notes is null or char_length(notes) <= 500
  ),
  constraint multiplier_reports_transaction_date_not_future check (
    transaction_date <= current_date
  )
);

create index multiplier_reports_place_id_idx on public.multiplier_reports (place_id);
create index multiplier_reports_user_id_idx on public.multiplier_reports (user_id);
create index multiplier_reports_status_idx on public.multiplier_reports (status);
create index multiplier_reports_transaction_date_idx
  on public.multiplier_reports (transaction_date desc);

-- One report per user, place, and calendar day (UTC)
create unique index multiplier_reports_one_per_day_idx
  on public.multiplier_reports (user_id, place_id, created_on_utc)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- place_multiplier_summaries
-- ---------------------------------------------------------------------------

create table public.place_multiplier_summaries (
  place_id uuid not null references public.places (id) on delete cascade,
  card_product_id uuid not null references public.card_products (id),
  current_multiplier public.multiplier_value,
  confidence_score numeric(5, 4),
  confidence_level public.confidence_level not null default 'insufficient',
  recent_report_count integer not null default 0,
  unique_reporter_count integer not null default 0,
  last_reported_at timestamptz,
  score_1x numeric(10, 4) not null default 0,
  score_2x numeric(10, 4) not null default 0,
  score_3x numeric(10, 4) not null default 0,
  score_5x numeric(10, 4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (place_id, card_product_id)
);

create index place_multiplier_summaries_multiplier_idx
  on public.place_multiplier_summaries (current_multiplier);

-- ---------------------------------------------------------------------------
-- place_flags
-- ---------------------------------------------------------------------------

create table public.place_flags (
  id uuid primary key default extensions.uuid_generate_v4(),
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason public.flag_reason not null,
  details text,
  status public.flag_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint place_flags_details_length check (
    details is null or char_length(details) <= 1000
  )
);

create index place_flags_place_id_idx on public.place_flags (place_id);
create index place_flags_status_idx on public.place_flags (status);

-- ---------------------------------------------------------------------------
-- moderation_logs
-- ---------------------------------------------------------------------------

create table public.moderation_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  moderator_id uuid not null references public.profiles (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  reason text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index moderation_logs_entity_idx
  on public.moderation_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Helper: auto-create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger merchant_brands_updated_at before update on public.merchant_brands
  for each row execute function public.set_updated_at();
create trigger card_products_updated_at before update on public.card_products
  for each row execute function public.set_updated_at();
create trigger places_updated_at before update on public.places
  for each row execute function public.set_updated_at();
create trigger multiplier_reports_updated_at before update on public.multiplier_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.merchant_brands enable row level security;
alter table public.card_products enable row level security;
alter table public.places enable row level security;
alter table public.multiplier_reports enable row level security;
alter table public.place_multiplier_summaries enable row level security;
alter table public.place_flags enable row level security;
alter table public.moderation_logs enable row level security;

-- profiles
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- merchant_brands
create policy "Brands are viewable by everyone"
  on public.merchant_brands for select using (true);

-- card_products
create policy "Active card products are viewable by everyone"
  on public.card_products for select using (active = true);

-- places
create policy "Active places are viewable by everyone"
  on public.places for select using (status = 'active');

create policy "Authenticated users can create places"
  on public.places for insert
  with check (auth.uid() = created_by);

-- multiplier_reports
create policy "Active reports are viewable by everyone"
  on public.multiplier_reports for select using (status = 'active');

create policy "Users can view own reports regardless of status"
  on public.multiplier_reports for select using (auth.uid() = user_id);

create policy "Authenticated users can create reports"
  on public.multiplier_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can soft-delete own active reports"
  on public.multiplier_reports for update
  using (auth.uid() = user_id and status = 'active')
  with check (auth.uid() = user_id);

-- place_multiplier_summaries (read-only for clients)
create policy "Summaries are viewable by everyone"
  on public.place_multiplier_summaries for select using (true);

-- place_flags
create policy "Authenticated users can create flags"
  on public.place_flags for insert
  with check (auth.uid() = user_id);

create policy "Users can view own flags"
  on public.place_flags for select using (auth.uid() = user_id);

-- moderation_logs (admin/moderator via service role only)
create policy "No direct client access to moderation logs"
  on public.moderation_logs for select using (false);

-- ---------------------------------------------------------------------------
-- Map viewport query function
-- ---------------------------------------------------------------------------

create or replace function public.places_in_viewport(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_card_product_id uuid default null,
  p_multiplier public.multiplier_value default null,
  p_category text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  category text,
  multiplier public.multiplier_value,
  confidence_level public.confidence_level,
  recent_report_count integer,
  last_reported_at timestamptz
)
language sql
stable
as $$
  select
    p.id,
    p.name,
    extensions.st_y(p.location::extensions.geometry) as latitude,
    extensions.st_x(p.location::extensions.geometry) as longitude,
    p.category,
    s.current_multiplier as multiplier,
    s.confidence_level,
    s.recent_report_count,
    s.last_reported_at
  from public.places p
  left join public.place_multiplier_summaries s
    on s.place_id = p.id
    and s.card_product_id = coalesce(
      p_card_product_id,
      (select cp.id from public.card_products cp where cp.slug = 'amex-cobalt-ca' limit 1)
    )
  where p.status = 'active'
    and p.location && extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::extensions.geography
    and (p_category is null or p.category = p_category)
    and (p_multiplier is null or s.current_multiplier = p_multiplier)
  order by s.recent_report_count desc nulls last
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Nearby places query function
-- ---------------------------------------------------------------------------

create or replace function public.places_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_metres double precision default 5000,
  p_card_product_id uuid default null,
  p_multiplier public.multiplier_value default null,
  p_category text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  category text,
  distance_metres double precision,
  multiplier public.multiplier_value,
  confidence_level public.confidence_level,
  recent_report_count integer,
  last_reported_at timestamptz
)
language sql
stable
as $$
  select
    p.id,
    p.name,
    extensions.st_y(p.location::extensions.geometry) as latitude,
    extensions.st_x(p.location::extensions.geometry) as longitude,
    p.category,
    extensions.st_distance(
      p.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
    ) as distance_metres,
    s.current_multiplier as multiplier,
    s.confidence_level,
    s.recent_report_count,
    s.last_reported_at
  from public.places p
  left join public.place_multiplier_summaries s
    on s.place_id = p.id
    and s.card_product_id = coalesce(
      p_card_product_id,
      (select cp.id from public.card_products cp where cp.slug = 'amex-cobalt-ca' limit 1)
    )
  where p.status = 'active'
    and extensions.st_dwithin(
      p.location,
      extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
      p_radius_metres
    )
    and (p_category is null or p.category = p_category)
    and (p_multiplier is null or s.current_multiplier = p_multiplier)
  order by distance_metres asc
  limit p_limit;
$$;
