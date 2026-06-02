-- Board: one collaborative board per project, with editable columns.
-- Everyone in any of the project's groups can read + write (anon, like chat/notes).

create table if not exists board_columns (
  id text primary key,
  project_id text not null,
  title text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists board_columns_project_idx on board_columns (project_id);

-- Tasks now belong to a column (column_id). Legacy `status`/`position` columns are
-- kept for back-compat; new code orders by `position` within `column_id`.
alter table tasks add column if not exists column_id text;

-- Open up access: the board is collaborative for everyone in the project's groups.
-- Prototype RLS mirrors messages/shared_notes — permissive anon read/write.
alter table board_columns enable row level security;
alter table tasks enable row level security;

drop policy if exists tasks_owner_all on tasks;
drop policy if exists tasks_anon_all on tasks;
create policy tasks_anon_all on tasks for all to anon, authenticated using (true) with check (true);

drop policy if exists board_columns_anon_all on board_columns;
create policy board_columns_anon_all on board_columns for all to anon, authenticated using (true) with check (true);

-- Live collaboration: add both tables to the realtime publication.
alter publication supabase_realtime add table board_columns;
alter publication supabase_realtime add table tasks;
