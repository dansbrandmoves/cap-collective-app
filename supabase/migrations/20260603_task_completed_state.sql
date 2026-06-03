-- A card can be marked complete (Trello-style hover check + modal toggle).
-- Captured as real state so future features (filters, "done" rollups, activity)
-- can build on it, not just a UI flourish.
alter table public.tasks
  add column if not exists completed boolean not null default false,
  add column if not exists completed_at timestamptz;
