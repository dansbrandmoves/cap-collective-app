-- Card detail view: a description on the task, plus a comments/activity feed.
alter table tasks add column if not exists description text;

create table if not exists task_comments (
  id text primary key,
  task_id text not null,
  project_id text not null,
  author text,
  text text not null default '',
  kind text not null default 'comment',  -- 'comment' | 'activity'
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on task_comments (task_id);

alter table task_comments enable row level security;
drop policy if exists task_comments_anon_all on task_comments;
create policy task_comments_anon_all on task_comments for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table task_comments;
