-- Remove direct function grants that may remain on older hosted projects.
-- Revoking from PUBLIC alone does not remove grants made directly to the API
-- roles by historical Supabase default privileges.

revoke all on function public.lookup_auth_account_hints(text)
  from public, anon, authenticated, service_role;
grant execute on function public.lookup_auth_account_hints(text)
  to service_role;

revoke all on function public.handle_new_user()
  from public, anon, authenticated, service_role;
revoke all on function public.set_updated_at()
  from public, anon, authenticated, service_role;

-- These legacy functions exist on some deployed databases but are no longer
-- part of the repository schema or application call graph. Keep the migration
-- portable across fresh databases while removing their Data API exposure.
do $$
begin
  if to_regprocedure('public.get_user_security_status(uuid)') is not null then
    execute 'revoke all on function public.get_user_security_status(uuid)
      from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure(
    'public.count_places_in_city(text,text,uuid,public.multiplier_value,text)'
  ) is not null then
    execute 'revoke all on function public.count_places_in_city(
      text, text, uuid, public.multiplier_value, text
    ) from public, anon, authenticated, service_role';
  end if;
end;
$$;
