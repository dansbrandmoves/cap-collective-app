-- Card attachments: links (paste any URL incl. Google Drive share links) and
-- uploaded files (stored in the public task-attachments bucket). Anon read/write
-- to match the rest of the board (tighten before a true public launch).
create table if not exists public.task_attachments (
  id text primary key,
  task_id text not null,
  project_id text,
  kind text not null default 'link',   -- 'link' | 'file' | 'drive'
  name text,
  url text not null,
  author text,
  created_at timestamptz not null default now()
);
alter table public.task_attachments enable row level security;

do $$ begin
  create policy "task_attachments anon read" on public.task_attachments for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "task_attachments anon insert" on public.task_attachments for insert to anon, authenticated with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "task_attachments anon delete" on public.task_attachments for delete to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.task_attachments;
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public)
  values ('task-attachments', 'task-attachments', true)
  on conflict (id) do nothing;

do $$ begin
  create policy "task-attachments files read" on storage.objects for select to anon, authenticated using (bucket_id = 'task-attachments');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "task-attachments files insert" on storage.objects for insert to anon, authenticated with check (bucket_id = 'task-attachments');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "task-attachments files delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'task-attachments');
exception when duplicate_object then null; end $$;
