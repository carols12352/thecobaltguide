-- Account-provider hints are device-local. Remove the server-side email lookup
-- so anonymous callers cannot test whether an account exists.
drop function if exists public.lookup_auth_account_hints(text);
