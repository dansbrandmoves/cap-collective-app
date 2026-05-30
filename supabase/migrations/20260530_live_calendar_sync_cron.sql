-- S1.4: 15-minute server cron fallback for sync-calendar.
-- Applied to the live DB via MCP; recorded here for version control.
--
-- ONE-TIME SETUP (run in Supabase SQL editor with your service-role key from
-- Dashboard → Settings → API): the cron stays a no-op until this exists.
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.cron_sync_calendars()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  key text;
begin
  select decrypted_secret into key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if key is null then
    raise notice 'cron_sync_calendars: service_role_key not in vault; skipping';
    return;
  end if;
  perform net.http_post(
    url := 'https://xwuekcysigkujhyucugi.supabase.co/functions/v1/sync-calendar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
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
