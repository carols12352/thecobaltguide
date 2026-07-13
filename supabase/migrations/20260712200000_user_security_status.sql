-- One-time backfill: persist password status in user metadata for client-side checks.
UPDATE auth.users
SET raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('has_password', true)
WHERE encrypted_password IS NOT NULL
  AND length(encrypted_password) > 0
  AND coalesce(raw_user_meta_data->>'has_password', 'false') <> 'true';
