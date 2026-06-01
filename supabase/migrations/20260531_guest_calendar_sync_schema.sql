-- Unified calendar sync — guest side. Mirrors the owner pipeline
-- (profiles.google_refresh_token + calendar_sync_state) but keyed by the guest's
-- identity in a room, since guests have no auth user / profile row.
-- Applied to the live DB via MCP; recorded here for version control.

-- One row per (room, guest) who connected a Google Calendar. Holds the long-lived
-- refresh token so the server can re-read their free/busy on a schedule.
create table if not exists public.guest_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  guest_name text not null,
  google_refresh_token text,
  google_access_token text,
  google_token_expires_at bigint,
  -- Which Google calendar to read (guests use 'primary'); kept for parity/future.
  google_calendar_id text not null default 'primary',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (room_id, guest_name)
);
-- Service-role only (edge functions). RLS on, no policies → clients can't read tokens.
alter table public.guest_calendar_tokens enable row level security;

-- Per-(room,guest) incremental sync token + rolling-window baseline, like
-- calendar_sync_state is for owners.
create table if not exists public.guest_calendar_sync_state (
  room_id text not null,
  guest_name text not null,
  google_calendar_id text not null default 'primary',
  sync_token text,
  baseline_at timestamptz,
  updated_at timestamptz default now(),
  primary key (room_id, guest_name, google_calendar_id)
);
alter table public.guest_calendar_sync_state enable row level security;
-- No policies: edge functions use the service role (bypasses RLS).
