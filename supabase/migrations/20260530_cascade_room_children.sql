-- Fix: deleting a group (room) or project silently failed when the room had
-- date requests.
--
-- Root cause: date_requests.room_id -> rooms(id) was NO ACTION, and date_requests
-- has RLS with no DELETE policy, so the app's delete() removed 0 rows. The leftover
-- requests then blocked the room delete with a FK violation, so deleteRoom() errored
-- and returned without updating the UI. The other child tables (shared_notes,
-- messages, room_members) were already ON DELETE CASCADE, which is why they didn't
-- trip it. shared_availability had no FK at all, leaving orphan rows.
--
-- Fix: cascade date_requests and shared_availability on room delete (matching the
-- other children), and add a DELETE policy so explicit app deletes also work.

alter table public.date_requests
  drop constraint if exists date_requests_group_id_fkey;
alter table public.date_requests
  add constraint date_requests_group_id_fkey
  foreign key (room_id) references public.rooms(id) on delete cascade;

alter table public.shared_availability
  add constraint shared_availability_room_id_fkey
  foreign key (room_id) references public.rooms(id) on delete cascade;

drop policy if exists anyone_delete on public.date_requests;
create policy anyone_delete on public.date_requests for delete to public using (true);
