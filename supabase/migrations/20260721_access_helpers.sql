-- Applied to the live DB via MCP; recorded here for version control.
--
-- Per-project access helpers for RLS. SECURITY DEFINER so they read
-- productions/rooms/room_members as the function owner (bypassing those tables'
-- RLS) -- this both avoids policy recursion and is the standard Supabase pattern.
-- STABLE lets Postgres cache within a query. auth.uid()/auth.jwt() read the
-- CALLER's request JWT (a request-level GUC), unaffected by SECURITY DEFINER.
--
-- Three access legs, matching the app's real model:
--   owner  : productions.owner_id (text) = auth.uid()::text
--   member : email match, case-insensitive (room_members has no user_id)
--   guest  : a scoped JWT minted by the room-access edge fn carries production_id
--
-- Intentionally executable by anon + authenticated (RLS policies run as the
-- querying role). The Supabase "anon can execute SECURITY DEFINER function"
-- advisor flags them -- expected and correct for a policy helper; they only
-- return a boolean access decision and never leak row data.

create or replace function public.can_access_production(pid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1 from productions p
      where p.id = pid and p.owner_id = auth.uid()::text
    )
    or exists (
      select 1 from rooms r
      join room_members m on m.room_id = r.id
      where r.production_id = pid
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
    or ((auth.jwt() ->> 'production_id') = pid)
  , false);
$$;

create or replace function public.can_access_room(rid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_production((select production_id from rooms where id = rid));
$$;

grant execute on function public.can_access_production(text) to anon, authenticated;
grant execute on function public.can_access_room(text) to anon, authenticated;
