-- Microsoft Graph calendar tokens for the owner (mirrors google_* columns).
-- Foundation for the Microsoft Calendar connect/sync. Dormant until the UI wires it.
alter table public.profiles
  add column if not exists ms_refresh_token text,
  add column if not exists ms_access_token text,
  add column if not exists ms_token_expires_at bigint;
