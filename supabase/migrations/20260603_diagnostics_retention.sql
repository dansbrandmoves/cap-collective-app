-- Diagnostics retention: keep a generous 30-day window, prune the rest daily so
-- the table never grows unbounded (the 15-min sync crons write to it continuously).
-- Applied to the live DB via MCP; recorded here for version control.
create or replace function public.prune_diagnostics()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.diagnostics where created_at < now() - interval '30 days';
$$;

-- Schedule daily at 04:10 UTC (off-peak; idempotent — unschedule any prior copy first).
select cron.unschedule('prune-diagnostics-daily')
where exists (select 1 from cron.job where jobname = 'prune-diagnostics-daily');

select cron.schedule('prune-diagnostics-daily', '10 4 * * *', $$ select public.prune_diagnostics(); $$);
