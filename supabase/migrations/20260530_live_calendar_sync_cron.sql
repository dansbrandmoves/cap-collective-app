-- S1.4: 15-minute server cron fallback for sync-calendar.
-- Applied to the live DB via MCP; recorded here for version control.
--
-- Cron authorizes with a DB-stored secret (validated by the sync-calendar edge
-- function) using the public anon key for the gateway — no service-role key or Vault
-- needed, so the whole thing is self-contained.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Service-role-only config table (RLS on, no policies → only edge functions read it).
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;

insert into public.app_config (key, value)
values ('cron_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

-- Cron job body: read the secret and POST {all:true} to sync-calendar.
create or replace function public.cron_sync_calendars()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  secret text;
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dWVrY3lzaWdrdWpoeXVjdWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU2MjMsImV4cCI6MjA5MDY0MTYyM30.rkYuML0hpIToWV20A2GeH8sY91xCHMwBnkSG_awI9BM';
begin
  select value into secret from public.app_config where key = 'cron_secret' limit 1;
  if secret is null then raise notice 'cron_sync_calendars: no cron_secret'; return; end if;
  perform net.http_post(
    url := 'https://xwuekcysigkujhyucugi.supabase.co/functions/v1/sync-calendar',
    headers := jsonb_build_object('Content-Type','application/json','apikey',anon,'Authorization','Bearer '||anon,'x-cron-secret',secret),
    body := jsonb_build_object('all', true)
  );
end;
$$;

do $$
begin
  perform cron.unschedule('sync-calendars-15min')
  where exists (select 1 from cron.job where jobname = 'sync-calendars-15min');
exception when others then null;
end $$;

select cron.schedule('sync-calendars-15min', '*/15 * * * *', $cron$ select public.cron_sync_calendars(); $cron$);
