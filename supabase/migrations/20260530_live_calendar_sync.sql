-- Live calendar sync (S1): server-owned incremental sync foundation.
-- Applied to the live DB via MCP; recorded here for version control.

-- Stable Google event id → upsert/delete individual events (no full rewrite).
alter table public.owner_calendar_events
  add column if not exists google_event_id text;

create unique index if not exists owner_calendar_events_owner_cal_event_uq
  on public.owner_calendar_events (owner_id, calendar_id, google_event_id);

-- Per-calendar incremental sync token + rolling-window baseline timestamp.
create table if not exists public.calendar_sync_state (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  google_calendar_id text not null,
  sync_token text,
  baseline_at timestamptz,
  updated_at timestamptz default now(),
  primary key (owner_id, google_calendar_id)
);
alter table public.calendar_sync_state enable row level security;
-- Edge functions use the service role (bypasses RLS); no anon access needed.

-- Live delivery to owner + guest UIs without polling.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'owner_calendar_events'
  ) then
    execute 'alter publication supabase_realtime add table public.owner_calendar_events';
  end if;
end $$;
