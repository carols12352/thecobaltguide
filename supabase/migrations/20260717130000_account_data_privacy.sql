-- Preserve useful structured community evidence after account deletion while
-- removing ownership and free-form personal data.
alter table public.multiplier_reports
  drop constraint if exists multiplier_reports_user_id_fkey;
alter table public.multiplier_reports alter column user_id drop not null;
alter table public.multiplier_reports
  add constraint multiplier_reports_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.place_flags
  drop constraint if exists place_flags_user_id_fkey;
alter table public.place_flags alter column user_id drop not null;
alter table public.place_flags
  add constraint place_flags_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.moderation_logs
  drop constraint if exists moderation_logs_moderator_id_fkey;
alter table public.moderation_logs alter column moderator_id drop not null;
alter table public.moderation_logs
  add constraint moderation_logs_moderator_id_fkey
  foreign key (moderator_id) references public.profiles (id) on delete set null;

create or replace function public.delete_own_account_transactional(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  v_reports integer := 0;
  v_flags integer := 0;
  v_place_ids jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = 'P0002', message = 'Account not found';
  end if;

  select coalesce(jsonb_agg(place_id), '[]'::jsonb)
  into v_place_ids
  from (
    select distinct place_id
    from public.multiplier_reports
    where user_id = p_user_id
    union
    select distinct place_id
    from public.place_flags
    where user_id = p_user_id
  ) affected;

  update public.multiplier_reports
  set notes = null
  where user_id = p_user_id;
  get diagnostics v_reports = row_count;

  update public.place_flags
  set details = null
  where user_id = p_user_id;
  get diagnostics v_flags = row_count;

  -- Deleting auth.users cascades to profiles. The SET NULL relationships above
  -- anonymize contribution owners and moderation actors in the same transaction.
  delete from auth.users where id = p_user_id;

  return jsonb_build_object(
    'deleted', true,
    'reportsAnonymized', v_reports,
    'flagsAnonymized', v_flags,
    'affectedPlaceIds', v_place_ids
  );
end;
$$;

revoke all on function public.delete_own_account_transactional(uuid) from public;
revoke all on function public.delete_own_account_transactional(uuid) from anon;
revoke all on function public.delete_own_account_transactional(uuid) from authenticated;
grant execute on function public.delete_own_account_transactional(uuid) to service_role;
