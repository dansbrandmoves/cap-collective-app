-- Whiteboard: one infinite canvas per project. Elements are stickies, shapes,
-- text, and comment pins. Collaborative + realtime, anon access like the board.
create table if not exists canvas_elements (
  id text primary key,
  project_id text not null,
  type text not null,                 -- 'sticky' | 'rect' | 'circle' | 'text' | 'comment'
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 160,
  h double precision not null default 120,
  z double precision not null default 0,
  text text default '',
  color text default '#fde68a',
  font text,                          -- google font family (nullable)
  author text,                        -- creator / comment author
  created_at timestamptz not null default now()
);
create index if not exists canvas_elements_project_idx on canvas_elements (project_id);

alter table canvas_elements enable row level security;
drop policy if exists canvas_elements_anon_all on canvas_elements;
create policy canvas_elements_anon_all on canvas_elements for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table canvas_elements;
