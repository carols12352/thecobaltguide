create type public.report_kind as enum (
  'new_location',
  'error',
  'update',
  'confirm'
);

alter table public.multiplier_reports
  add column report_kind public.report_kind not null default 'update';

-- Existing submissions were routine updates/confirms; auto-mark as reviewed.
update public.multiplier_reports
set
  reviewed_at = coalesce(reviewed_at, created_at),
  report_kind = 'update'
where status <> 'flagged';

drop index if exists multiplier_reports_moderation_queue_idx;

create index multiplier_reports_moderation_queue_idx
  on public.multiplier_reports (created_at desc)
  where
    status = 'flagged'
    or (
      status = 'active'
      and reviewed_at is null
      and report_kind in ('new_location', 'error')
    );
