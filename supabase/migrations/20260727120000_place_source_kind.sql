-- Record place provenance explicitly. The existing catalogue was loaded from
-- the reviewed Rewards Canada dataset; future community submissions retain the
-- default community source.

create type public.place_source as enum ('community', 'rewards_canada');

alter table public.places
  add column source_kind public.place_source not null default 'community';

comment on column public.places.source_kind is
  'Provenance of the place record, independent of community multiplier reports.';

update public.places
set source_kind = 'rewards_canada';

-- The atomic Rewards Canada replacement RPC inserts rows with the established
-- rewards-canada external ID prefix. Keep future replacements correctly marked
-- without duplicating the full replacement function in this migration.
create function public.set_place_source_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.external_place_id like 'rewards-canada:%' then
    new.source_kind = 'rewards_canada';
  end if;
  return new;
end;
$$;

create trigger places_source_kind
  before insert or update of external_place_id on public.places
  for each row execute function public.set_place_source_kind();

revoke all on function public.set_place_source_kind()
  from public, anon, authenticated, service_role;

-- PostgreSQL cannot change a RETURNS TABLE shape with CREATE OR REPLACE.
drop function public.places_in_viewport(
  double precision,
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
);

create function public.places_in_viewport(
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
  address_line1 text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  category text,
  source_kind public.place_source,
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
    p.address_line1,
    p.city,
    p.province,
    extensions.st_y(p.location::extensions.geometry) as latitude,
    extensions.st_x(p.location::extensions.geometry) as longitude,
    p.category,
    p.source_kind,
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
    and p.location operator(extensions.&&) extensions.st_makeenvelope(
      p_west, p_south, p_east, p_north, 4326
    )::extensions.geography
    and (p_category is null or p.category = p_category)
    and (p_multiplier is null or s.current_multiplier = p_multiplier)
  order by s.recent_report_count desc nulls last
  limit least(greatest(coalesce(p_limit, 200), 1), 501);
$$;

drop function public.places_in_view_near(
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
);

create function public.places_in_view_near(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_latitude double precision,
  p_longitude double precision,
  p_card_product_id uuid default null,
  p_multiplier public.multiplier_value default null,
  p_category text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  name text,
  address_line1 text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  category text,
  source_kind public.place_source,
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
    p.address_line1,
    p.city,
    p.province,
    extensions.st_y(p.location::extensions.geometry) as latitude,
    extensions.st_x(p.location::extensions.geometry) as longitude,
    p.category,
    p.source_kind,
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
    and p.location operator(extensions.&&) extensions.st_makeenvelope(
      p_west, p_south, p_east, p_north, 4326
    )::extensions.geography
    and (p_category is null or p.category = p_category)
    and (p_multiplier is null or s.current_multiplier = p_multiplier)
  order by extensions.st_distance(
    p.location,
    extensions.st_setsrid(
      extensions.st_makepoint(p_longitude, p_latitude),
      4326
    )::extensions.geography
  )
  limit least(greatest(coalesce(p_limit, 200), 1), 501);
$$;

drop function public.places_nearby(
  double precision,
  double precision,
  double precision,
  uuid,
  public.multiplier_value,
  text,
  integer
);

create function public.places_nearby(
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
  source_kind public.place_source,
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
    p.source_kind,
    extensions.st_distance(
      p.location,
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography
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
      extensions.st_setsrid(
        extensions.st_makepoint(p_longitude, p_latitude),
        4326
      )::extensions.geography,
      least(greatest(coalesce(p_radius_metres, 5000), 1), 100000)
    )
    and (p_category is null or p.category = p_category)
    and (p_multiplier is null or s.current_multiplier = p_multiplier)
  order by distance_metres asc
  limit least(greatest(coalesce(p_limit, 50), 1), 501);
$$;

revoke all on function public.places_in_viewport(
  double precision, double precision, double precision, double precision,
  uuid, public.multiplier_value, text, integer
) from public;
grant execute on function public.places_in_viewport(
  double precision, double precision, double precision, double precision,
  uuid, public.multiplier_value, text, integer
) to anon, authenticated, service_role;

revoke all on function public.places_in_view_near(
  double precision, double precision, double precision, double precision,
  double precision, double precision, uuid, public.multiplier_value, text, integer
) from public;
grant execute on function public.places_in_view_near(
  double precision, double precision, double precision, double precision,
  double precision, double precision, uuid, public.multiplier_value, text, integer
) to anon, authenticated, service_role;

revoke all on function public.places_nearby(
  double precision, double precision, double precision, uuid,
  public.multiplier_value, text, integer
) from public;
grant execute on function public.places_nearby(
  double precision, double precision, double precision, uuid,
  public.multiplier_value, text, integer
) to anon, authenticated, service_role;
