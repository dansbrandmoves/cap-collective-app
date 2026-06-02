-- Connectors link two canvas elements with a curved arrow. They recompute their
-- endpoints from the linked elements, so moving an element drags its arrows along.
alter table canvas_elements add column if not exists from_id text;
alter table canvas_elements add column if not exists to_id text;
alter table canvas_elements add column if not exists meta jsonb not null default '{}'::jsonb;
