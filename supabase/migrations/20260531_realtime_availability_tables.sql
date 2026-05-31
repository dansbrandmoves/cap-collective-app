-- Make the project joint-availability view update live.
--
-- The owner's ProjectOverview (via useProjectAvailability) subscribes to
-- shared_availability + date_requests, but neither was in the realtime
-- publication — so a guest connecting their calendar or tapping days only
-- showed up after the owner manually refreshed. Add both.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_availability') then
    alter publication supabase_realtime add table public.shared_availability;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='date_requests') then
    alter publication supabase_realtime add table public.date_requests;
  end if;
end $$;

-- Realtime only delivers full row data on UPDATE/DELETE when REPLICA IDENTITY
-- is FULL; otherwise the client's old-row room_id filter can miss events
-- (e.g. a guest disconnecting clears rows via DELETE).
alter table public.shared_availability replica identity full;
alter table public.date_requests replica identity full;
