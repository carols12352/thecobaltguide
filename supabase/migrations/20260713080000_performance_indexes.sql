-- Performance indexes: fuzzy search (pg_trgm) and composite partial indexes.
-- Verify with EXPLAIN (ANALYZE, BUFFERS) after applying to production-sized data.

create extension if not exists pg_trgm;

-- Public merchant search: name ilike '%query%'
create index if not exists places_active_name_trgm_idx
  on public.places using gin (name gin_trgm_ops)
  where status = 'active';

create index if not exists places_active_normalized_name_trgm_idx
  on public.places using gin (normalized_name gin_trgm_ops)
  where status = 'active';

-- Summary refresh and place report history
create index if not exists multiplier_reports_place_card_active_date_idx
  on public.multiplier_reports (place_id, card_product_id, transaction_date desc)
  where status = 'active';

-- Profile report list
create index if not exists multiplier_reports_user_created_idx
  on public.multiplier_reports (user_id, created_at desc);

-- Flag moderation
create index if not exists place_flags_place_open_idx
  on public.place_flags (place_id)
  where status = 'open';

create index if not exists place_flags_open_created_idx
  on public.place_flags (created_at desc)
  where status = 'open';

-- Admin places list
create index if not exists places_status_created_idx
  on public.places (status, created_at desc);
