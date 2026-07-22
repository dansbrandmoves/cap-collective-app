-- SECURITY: several SECURITY DEFINER functions were reachable via public REST RPC
-- because functions default to GRANT EXECUTE TO PUBLIC (anon/authenticated inherit
-- through PUBLIC). Revoke from PUBLIC. cron_* + maintenance functions are only ever
-- called by pg_cron and triggers, which run as postgres (unaffected). admin_*
-- functions stay callable by authenticated (the admin dashboard uses them and they
-- verify role='admin' internally); just remove the anon path.

revoke execute on function public.cron_sync_calendars() from public, anon, authenticated;
revoke execute on function public.cron_sync_guest_calendars() from public, anon, authenticated;
revoke execute on function public.cron_sync_ms_calendars() from public, anon, authenticated;
revoke execute on function public.prune_diagnostics() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_update_user(uuid, text, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;
