-- Add address fields to viewport query for list display
-- Must drop first: PostgreSQL cannot change RETURNS TABLE shape via CREATE OR REPLACE.
drop function if exists public.places_in_viewport(
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
    and extensions.st_within(
      p.location::extensions.geometry,
      extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    )
    and (p_category is null or p.category = p_category)
    and (p_multiplier is null or s.current_multiplier = p_multiplier)
  order by s.recent_report_count desc nulls last
  limit p_limit;
$$;
