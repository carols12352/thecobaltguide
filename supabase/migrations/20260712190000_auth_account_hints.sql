-- Server-only lookup for sign-up / sign-in hints (called with service role).
CREATE OR REPLACE FUNCTION public.lookup_auth_account_hints(target_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  uid uuid;
  providers jsonb;
  last_provider text;
BEGIN
  IF target_email IS NULL OR length(trim(target_email)) = 0 THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT id INTO uid
  FROM auth.users
  WHERE lower(email) = lower(trim(target_email))
  LIMIT 1;

  IF uid IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT coalesce(
    (
      SELECT jsonb_agg(provider ORDER BY provider)
      FROM (
        SELECT DISTINCT provider
        FROM auth.identities
        WHERE user_id = uid
      ) AS p
    ),
    '[]'::jsonb
  )
  INTO providers;

  SELECT provider INTO last_provider
  FROM auth.identities
  WHERE user_id = uid
  ORDER BY coalesce(updated_at, created_at) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'exists', true,
    'providers', providers,
    'lastProvider', last_provider
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_account_hints(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auth_account_hints(text) TO service_role;
