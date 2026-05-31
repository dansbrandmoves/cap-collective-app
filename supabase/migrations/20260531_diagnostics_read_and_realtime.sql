-- Diagnostics / execution log: enable reads + live updates for the admin view.
-- The table already had an anon/authenticated INSERT policy (so guests can log),
-- but no SELECT policy — meaning the admin Diagnostics page could never read rows.

-- Allow signed-in users to read diagnostics. The admin UI gates to role=admin
-- client-side; tighten to a true admin predicate before broad production use.
drop policy if exists diagnostics_select on public.diagnostics;
create policy diagnostics_select on public.diagnostics
  for select to authenticated using (true);

grant select on public.diagnostics to authenticated;

-- Live updates for the admin Diagnostics view (n8n-style executions list).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'diagnostics'
  ) then
    alter publication supabase_realtime add table public.diagnostics;
  end if;
end $$;
