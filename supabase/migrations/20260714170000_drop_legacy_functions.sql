-- Remove remote-only legacy RPCs that have no application or schema callers.
-- Intentionally omit CASCADE so deployment fails safely if a database-level
-- dependency is introduced before this migration is applied.

drop function if exists public.get_user_security_status(uuid);

drop function if exists public.count_places_in_city(
  text,
  text,
  uuid,
  public.multiplier_value,
  text
);
