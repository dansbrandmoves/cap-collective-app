-- Guests can now connect Microsoft/Outlook alongside (or instead of) Google.
-- Mirror the google_* columns on the same (room_id, guest_name) row so a guest
-- can have BOTH connected; the sync merges busy from every connected provider.
-- Applied to the live DB via MCP; recorded here for version control.
alter table public.guest_calendar_tokens
  add column if not exists ms_refresh_token text,
  add column if not exists ms_access_token text,
  add column if not exists ms_token_expires_at bigint;
