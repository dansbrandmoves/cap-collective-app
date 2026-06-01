-- Light tasks: a simple owner-only kanban board per project.
create table if not exists tasks (
  id text primary key,
  project_id text not null,
  title text not null,
  status text not null default 'todo',   -- 'todo' | 'doing' | 'done'
  assignee text,                          -- roster person name (nullable)
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists tasks_project_idx on tasks (project_id);

alter table tasks enable row level security;

-- Owner-only: a task is reachable only by the owner of its project.
drop policy if exists tasks_owner_all on tasks;
create policy tasks_owner_all on tasks
  for all to authenticated
  using (project_id in (select id from productions where owner_id = auth.uid()::text))
  with check (project_id in (select id from productions where owner_id = auth.uid()::text));
