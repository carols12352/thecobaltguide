-- Stage A: make authoritative report and moderation workflows atomic.
-- All functions are service-role-only RPCs. Cache invalidation remains an
-- application concern and runs only after these transactions commit.

create or replace function public.refresh_place_summary_transactional(
  p_place_id uuid,
  p_card_product_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_imported boolean;
  v_count integer;
  v_unique integer;
  v_last date;
  v_score_1 numeric := 0;
  v_score_2 numeric := 0;
  v_score_3 numeric := 0;
  v_score_5 numeric := 0;
  v_total numeric;
  v_winner public.multiplier_value;
  v_winning_score numeric;
  v_confidence numeric;
  v_recent_matching integer;
  v_level public.confidence_level;
begin
  select coalesce(external_place_id like 'rewards-canada:%', false)
    into v_imported
    from public.places
    where id = p_place_id;

  with weighted as (
    select
      multiplier,
      user_id,
      transaction_date,
      case
        when transaction_date >= current_date - 30 then 1.0
        when transaction_date >= current_date - 90 then 0.5
        when transaction_date >= current_date - 180 then 0.2
        else 0
      end::numeric as weight
    from public.multiplier_reports
    where place_id = p_place_id
      and card_product_id = p_card_product_id
      and status = 'active'
      and transaction_date between current_date - 180 and current_date
  )
  select
    count(*)::integer,
    count(distinct user_id)::integer,
    max(transaction_date),
    coalesce(sum(weight) filter (where multiplier = '1'), 0),
    coalesce(sum(weight) filter (where multiplier = '2'), 0),
    coalesce(sum(weight) filter (where multiplier = '3'), 0),
    coalesce(sum(weight) filter (where multiplier = '5'), 0)
  into v_count, v_unique, v_last, v_score_1, v_score_2, v_score_3, v_score_5
  from weighted
  where weight > 0;

  v_total := v_score_1 + v_score_2 + v_score_3 + v_score_5;

  -- Preserve imported seed summaries until community evidence exists.
  if v_total = 0 and v_imported then
    return;
  end if;

  if v_total = 0 then
    v_winner := null;
    v_winning_score := 0;
    v_confidence := 0;
    v_recent_matching := 0;
    v_level := 'insufficient';
  else
    select candidate.multiplier, candidate.score
      into v_winner, v_winning_score
      from (values
        ('1'::public.multiplier_value, v_score_1, 1),
        ('2'::public.multiplier_value, v_score_2, 2),
        ('3'::public.multiplier_value, v_score_3, 3),
        ('5'::public.multiplier_value, v_score_5, 4)
      ) as candidate(multiplier, score, tie_order)
      order by candidate.score desc, candidate.tie_order
      limit 1;

    v_confidence := v_winning_score / v_total;
    select count(*)::integer
      into v_recent_matching
      from public.multiplier_reports
      where place_id = p_place_id
        and card_product_id = p_card_product_id
        and status = 'active'
        and multiplier = v_winner
        and transaction_date between current_date - 30 and current_date;

    v_level := (case
      when v_imported and v_count >= 2 and v_confidence < 0.6 then 'disputed'
      when v_imported then 'high'
      when v_count < 2 then 'insufficient'
      when v_confidence < 0.6 then 'disputed'
      when v_recent_matching >= 2 then 'recently_confirmed'
      when v_confidence > 0.8 and v_unique >= 3 then 'high'
      else 'medium'
    end)::public.confidence_level;
  end if;

  insert into public.place_multiplier_summaries (
    place_id, card_product_id, current_multiplier, confidence_score,
    confidence_level, recent_report_count, unique_reporter_count,
    last_reported_at, score_1x, score_2x, score_3x, score_5x, updated_at
  ) values (
    p_place_id, p_card_product_id, v_winner, v_confidence, v_level,
    coalesce(v_count, 0), coalesce(v_unique, 0), v_last::timestamptz,
    v_score_1, v_score_2, v_score_3, v_score_5, now()
  )
  on conflict (place_id, card_product_id) do update set
    current_multiplier = excluded.current_multiplier,
    confidence_score = excluded.confidence_score,
    confidence_level = excluded.confidence_level,
    recent_report_count = excluded.recent_report_count,
    unique_reporter_count = excluded.unique_reporter_count,
    last_reported_at = excluded.last_reported_at,
    score_1x = excluded.score_1x,
    score_2x = excluded.score_2x,
    score_3x = excluded.score_3x,
    score_5x = excluded.score_5x,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.submit_report_transactional(
  p_place_id uuid,
  p_user_id uuid,
  p_card_product_id uuid,
  p_multiplier public.multiplier_value,
  p_transaction_date date,
  p_payment_context public.payment_context,
  p_notes text,
  p_report_kind public.report_kind
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_report public.multiplier_reports;
  v_reputation_delta integer;
begin
  perform 1 from public.profiles
    where id = p_user_id and status = 'active' and reputation_score >= -10
    for update;
  if not found then
    raise exception 'REPUTATION_BLOCKED' using errcode = 'P0001';
  end if;

  insert into public.multiplier_reports (
    place_id, user_id, card_product_id, multiplier, transaction_date,
    payment_context, notes, report_kind, reviewed_at
  ) values (
    p_place_id, p_user_id, p_card_product_id, p_multiplier,
    p_transaction_date, p_payment_context, p_notes, p_report_kind,
    case when p_report_kind in ('new_location', 'error') then null else now() end
  ) returning * into v_report;

  v_reputation_delta := case
    when p_report_kind in ('confirm', 'update') then 1
    else 0
  end;
  update public.profiles set
    report_count = report_count + 1,
    reputation_score = reputation_score + v_reputation_delta,
    updated_at = now()
  where id = p_user_id;

  perform public.refresh_place_summary_transactional(p_place_id, p_card_product_id);
  return to_jsonb(v_report);
end;
$$;

create or replace function public.delete_own_report_transactional(
  p_report_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_report public.multiplier_reports;
  v_reputation_delta integer;
begin
  select * into v_report from public.multiplier_reports
    where id = p_report_id and user_id = p_user_id
    for update;
  if not found or v_report.status <> 'active'
    or v_report.reviewed_by is not null or v_report.reviewed_at is not null
    or v_report.report_kind not in ('new_location', 'error') then
    raise exception 'REPORT_NOT_REMOVABLE' using errcode = 'P0001';
  end if;

  update public.multiplier_reports set status = 'removed', updated_at = now()
    where id = p_report_id returning * into v_report;
  v_reputation_delta := case
    when v_report.report_kind in ('confirm', 'update') then -1 else 0
  end;
  update public.profiles set
    report_count = greatest(0, report_count - 1),
    reputation_score = reputation_score + v_reputation_delta,
    updated_at = now()
  where id = p_user_id;

  perform public.refresh_place_summary_transactional(
    v_report.place_id, v_report.card_product_id
  );
  return to_jsonb(v_report);
end;
$$;

create or replace function public.moderate_report_transactional(
  p_report_id uuid,
  p_moderator_id uuid,
  p_action text,
  p_status public.report_status default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_before public.multiplier_reports;
  v_report public.multiplier_reports;
  v_delta integer := 0;
  v_flag_id uuid;
  v_dismissed_ids uuid[] := '{}';
  v_already_approved boolean;
begin
  select * into v_before from public.multiplier_reports
    where id = p_report_id for update;
  if not found then
    raise exception 'REPORT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A report that was approved once must not earn approval reputation again,
  -- even if a later moderation action changed its status.
  v_already_approved := v_before.reviewed_by is not null;

  if p_action = 'approve' then
    update public.multiplier_reports set
      status = 'active', moderation_reason = null, reviewed_at = now(),
      reviewed_by = p_moderator_id, updated_at = now()
    where id = p_report_id returning * into v_report;

    if not v_already_approved then
      v_delta := case v_before.report_kind
        when 'error' then 2 when 'new_location' then 5 else 0 end;
    end if;
  elsif p_action = 'status' and p_status is not null then
    update public.multiplier_reports set
      status = p_status,
      moderation_reason = p_reason,
      reviewed_at = case when p_status = 'flagged' then null else reviewed_at end,
      reviewed_by = case when p_status = 'flagged' then null else reviewed_by end,
      updated_at = now()
    where id = p_report_id returning * into v_report;

    if v_before.status = 'active' and p_status = 'removed' then
      v_delta := case v_before.report_kind
        when 'confirm' then -2 when 'update' then -2
        when 'error' then -2 when 'new_location' then -3 else 0 end;
    end if;
  else
    raise exception 'INVALID_MODERATION_ACTION' using errcode = 'P0001';
  end if;

  if v_delta <> 0 then
    update public.profiles set
      reputation_score = reputation_score + v_delta, updated_at = now()
    where id = v_before.user_id;
  end if;

  if v_report.status = 'flagged' then
    select id into v_flag_id from public.place_flags
      where place_id = v_report.place_id and status = 'open' limit 1;
    if v_flag_id is null then
      insert into public.place_flags (place_id, user_id, reason, details)
        values (v_report.place_id, p_moderator_id, 'other', coalesce(p_reason, 'Needs review'))
        returning id into v_flag_id;
    end if;
  elsif p_action = 'approve' or v_report.status = 'active' then
    with dismissed as (
      update public.place_flags set
        status = 'dismissed', resolved_by = p_moderator_id, resolved_at = now()
      where place_id = v_report.place_id and status = 'open'
      returning id
    ) select coalesce(array_agg(id), '{}') into v_dismissed_ids from dismissed;
  end if;

  perform public.refresh_place_summary_transactional(
    v_report.place_id, v_report.card_product_id
  );
  insert into public.moderation_logs (
    moderator_id, entity_type, entity_id, action, reason
  ) values (
    p_moderator_id, 'multiplier_report', p_report_id,
    case when p_action = 'approve' then 'approve' else v_report.status::text end,
    p_reason
  );

  return jsonb_build_object(
    'report', to_jsonb(v_report),
    'flagId', v_flag_id,
    'dismissedFlagIds', to_jsonb(v_dismissed_ids)
  );
end;
$$;

create or replace function public.resolve_place_flags_transactional(
  p_place_id uuid,
  p_moderator_id uuid,
  p_status public.flag_status
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_flag_ids uuid[] := '{}';
  v_cleared boolean := false;
  v_delta integer;
  v_card_id uuid;
begin
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'INVALID_FLAG_STATUS' using errcode = 'P0001';
  end if;
  v_delta := case when p_status = 'resolved' then 2 else -2 end;

  -- Lock the open set, then award each distinct reporter exactly once.
  perform 1 from public.place_flags
    where place_id = p_place_id and status = 'open' for update;
  update public.profiles p set
    reputation_score = p.reputation_score + v_delta, updated_at = now()
  where p.id in (
    select distinct user_id from public.place_flags
    where place_id = p_place_id and status = 'open'
  );

  with resolved as (
    update public.place_flags set
      status = p_status, resolved_by = p_moderator_id, resolved_at = now()
    where place_id = p_place_id and status = 'open'
    returning id
  ) select coalesce(array_agg(id), '{}') into v_flag_ids from resolved;

  if cardinality(v_flag_ids) > 0 then
    update public.multiplier_reports set
      status = 'active', moderation_reason = null, updated_at = now()
    where place_id = p_place_id and status = 'flagged';
    v_cleared := found;

    for v_card_id in
      select distinct card_product_id from public.multiplier_reports
      where place_id = p_place_id
    loop
      perform public.refresh_place_summary_transactional(p_place_id, v_card_id);
    end loop;

    insert into public.moderation_logs (
      moderator_id, entity_type, entity_id, action, metadata
    ) values (
      p_moderator_id, 'place', p_place_id,
      'resolve_flags_' || p_status::text,
      jsonb_build_object('flagIds', to_jsonb(v_flag_ids))
    );
  end if;

  return jsonb_build_object(
    'resolvedFlagIds', to_jsonb(v_flag_ids), 'clearedReports', v_cleared
  );
end;
$$;

create or replace function public.merge_places_transactional(
  p_source_place_id uuid,
  p_target_place_id uuid,
  p_moderator_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_card_id uuid;
begin
  if p_source_place_id = p_target_place_id then
    raise exception 'SAME_PLACE' using errcode = 'P0001';
  end if;
  perform 1 from public.places
    where id in (p_source_place_id, p_target_place_id)
    order by id for update;
  if (select count(*) from public.places where id in (p_source_place_id, p_target_place_id)) <> 2 then
    raise exception 'PLACE_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.multiplier_reports set place_id = p_target_place_id, updated_at = now()
    where place_id = p_source_place_id;
  update public.place_flags set place_id = p_target_place_id
    where place_id = p_source_place_id;
  update public.places set status = 'merged', updated_at = now()
    where id = p_source_place_id;

  for v_card_id in
    select distinct card_product_id from public.multiplier_reports
    where place_id = p_target_place_id
  loop
    perform public.refresh_place_summary_transactional(p_target_place_id, v_card_id);
  end loop;
  delete from public.place_multiplier_summaries where place_id = p_source_place_id;

  insert into public.moderation_logs (
    moderator_id, entity_type, entity_id, action, reason, metadata
  ) values (
    p_moderator_id, 'place', p_source_place_id, 'merge', p_reason,
    jsonb_build_object('targetPlaceId', p_target_place_id)
  );
  return jsonb_build_object(
    'sourcePlaceId', p_source_place_id, 'targetPlaceId', p_target_place_id
  );
end;
$$;

revoke all on function public.refresh_place_summary_transactional(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.submit_report_transactional(
  uuid, uuid, uuid, public.multiplier_value, date,
  public.payment_context, text, public.report_kind
) from public, anon, authenticated, service_role;
revoke all on function public.delete_own_report_transactional(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.moderate_report_transactional(
  uuid, uuid, text, public.report_status, text
) from public, anon, authenticated, service_role;
revoke all on function public.resolve_place_flags_transactional(
  uuid, uuid, public.flag_status
) from public, anon, authenticated, service_role;
revoke all on function public.merge_places_transactional(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.submit_report_transactional(
  uuid, uuid, uuid, public.multiplier_value, date,
  public.payment_context, text, public.report_kind
) to service_role;
grant execute on function public.delete_own_report_transactional(uuid, uuid)
  to service_role;
grant execute on function public.moderate_report_transactional(
  uuid, uuid, text, public.report_status, text
) to service_role;
grant execute on function public.resolve_place_flags_transactional(
  uuid, uuid, public.flag_status
) to service_role;
grant execute on function public.merge_places_transactional(uuid, uuid, uuid, text)
  to service_role;
