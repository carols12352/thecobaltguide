alter table public.places
  add column if not exists google_place_id text;

create index if not exists places_google_place_id_idx
  on public.places (google_place_id)
  where google_place_id is not null;

comment on column public.places.google_place_id is
  'Google Places identifier used only for precise Google Maps deep links.';
