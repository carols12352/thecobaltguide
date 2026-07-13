-- Index for city-level merchant counts at zoomed-out map views.

create index if not exists places_active_province_city_idx
  on public.places (province, city)
  where status = 'active';
