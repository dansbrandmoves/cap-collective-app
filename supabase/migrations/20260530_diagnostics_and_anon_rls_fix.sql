-- Diagnostics log + the real fix for guest writes.
-- Applied to the live DB via MCP; recorded here for version control.
--
-- Root cause found via the diagnostics log: guest (anon) inserts to shared_availability
-- were silently rejected by RLS because the policy targeted the `public` pseudo-role
-- instead of the `anon` role Supabase requests run as. So a guest connecting their
-- calendar never persisted free/busy. Re-target policies to anon + authenticated.

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  detail jsonb,
  created_at timestamptz default now()
);
alter table public.diagnostics enable row level security;
drop policy if exists diagnostics_insert on public.diagnostics;
create policy diagnostics_insert on public.diagnostics for insert to anon, authenticated with check (true);
grant insert on public.diagnostics to anon, authenticated;

drop policy if exists public_readwrite on public.shared_availability;
drop policy if exists shared_availability_rw on public.shared_availability;
create policy shared_availability_rw on public.shared_availability for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.shared_availability to anon, authenticated;
