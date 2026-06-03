-- 15-min server cron for Microsoft Graph calendar sync — mirrors cron_sync_calendars.
-- Self-authorizes with the DB-stored cron_secret (validated by the edge fn).
-- Applied to the live DB via MCP; recorded here for version control.

create or replace function public.cron_sync_ms_calendars()
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
  if secret is null then raise notice 'cron_sync_ms_calendars: no cron_secret'; return; end if;
  perform net.http_post(
    url := 'https://xwuekcysigkujhyucugi.supabase.co/functions/v1/sync-ms-calendar',
    headers := jsonb_build_object('Content-Type','application/json','apikey',anon,'Authorization','Bearer '||anon,'x-cron-secret',secret),
    body := jsonb_build_object('all', true)
  );
end;
$$;

do $$
begin
  perform cron.unschedule('sync-ms-calendars-15min')
  where exists (select 1 from cron.job where jobname = 'sync-ms-calendars-15min');
exception when others then null;
end $$;

select cron.schedule('sync-ms-calendars-15min', '*/15 * * * *', $cron$ select public.cron_sync_ms_calendars(); $cron$);
