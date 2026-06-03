-- Trello-style card power-ups: due date, labels, checklist.
-- All live on the tasks row (jsonb for the list-shaped ones) so the existing
-- updateTask(updates) path persists them with no hook changes.
alter table public.tasks
  add column if not exists due_on date,
  add column if not exists labels jsonb not null default '[]'::jsonb,
  add column if not exists checklist jsonb not null default '[]'::jsonb;
