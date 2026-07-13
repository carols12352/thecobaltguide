-- Track moderator approval without removing reports from the public map.

alter table public.multiplier_reports
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null;

create index multiplier_reports_moderation_queue_idx
  on public.multiplier_reports (created_at desc)
  where reviewed_at is null or status = 'flagged';
