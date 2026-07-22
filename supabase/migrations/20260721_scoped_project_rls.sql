-- Applied to the live DB via MCP; recorded here for version control.
--
-- Replace the permissive allow_all policies with per-project scoping enforced by
-- the DB (helpers in 20260721_access_helpers.sql). Access = owner (auth.uid) OR
-- member (email) OR guest (scoped-JWT production_id claim from the room-access
-- edge fn). Booking tables (booking_pages, bookings) stay public by design.
-- Verbatim revert: 20260721_scoped_rls_revert.sql.

drop policy if exists "allow_all_productions" on public.productions;
create policy "scoped_productions" on public.productions for all to anon, authenticated
  using (public.can_access_production(id)) with check (public.can_access_production(id));

drop policy if exists "allow_all_groups" on public.rooms;
create policy "scoped_rooms" on public.rooms for all to anon, authenticated
  using (public.can_access_production(production_id)) with check (public.can_access_production(production_id));

-- Also allow reading/writing your OWN membership rows by email so a signed-in user
-- can discover the projects shared with them (fetchAll scans room_members by email).
drop policy if exists "allow_all_group_members" on public.room_members;
create policy "scoped_room_members" on public.room_members for all to anon, authenticated
  using (public.can_access_room(room_id) or lower(email) = lower(auth.jwt() ->> 'email'))
  with check (public.can_access_room(room_id) or lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "allow_all_messages" on public.messages;
create policy "scoped_messages" on public.messages for all to anon, authenticated
  using (public.can_access_room(room_id)) with check (public.can_access_room(room_id));

drop policy if exists "allow_all_shared_notes" on public.shared_notes;
create policy "scoped_shared_notes" on public.shared_notes for all to anon, authenticated
  using (public.can_access_room(room_id)) with check (public.can_access_room(room_id));

drop policy if exists "anyone_read" on public.date_requests;
drop policy if exists "anyone_insert" on public.date_requests;
drop policy if exists "anyone_update" on public.date_requests;
drop policy if exists "anyone_delete" on public.date_requests;
create policy "scoped_date_requests" on public.date_requests for all to anon, authenticated
  using (public.can_access_room(room_id)) with check (public.can_access_room(room_id));

drop policy if exists "shared_availability_rw" on public.shared_availability;
create policy "scoped_shared_availability" on public.shared_availability for all to anon, authenticated
  using (public.can_access_room(room_id)) with check (public.can_access_room(room_id));

drop policy if exists "tasks_anon_all" on public.tasks;
create policy "scoped_tasks" on public.tasks for all to anon, authenticated
  using (public.can_access_production(project_id)) with check (public.can_access_production(project_id));

drop policy if exists "board_columns_anon_all" on public.board_columns;
create policy "scoped_board_columns" on public.board_columns for all to anon, authenticated
  using (public.can_access_production(project_id)) with check (public.can_access_production(project_id));

drop policy if exists "canvas_elements_anon_all" on public.canvas_elements;
create policy "scoped_canvas_elements" on public.canvas_elements for all to anon, authenticated
  using (public.can_access_production(project_id)) with check (public.can_access_production(project_id));

drop policy if exists "task_comments_anon_all" on public.task_comments;
create policy "scoped_task_comments" on public.task_comments for all to anon, authenticated
  using (public.can_access_production(project_id)) with check (public.can_access_production(project_id));

drop policy if exists "task_attachments anon read" on public.task_attachments;
drop policy if exists "task_attachments anon insert" on public.task_attachments;
drop policy if exists "task_attachments anon delete" on public.task_attachments;
create policy "scoped_task_attachments" on public.task_attachments for all to anon, authenticated
  using (public.can_access_production(project_id)) with check (public.can_access_production(project_id));

-- owner_calendar_events: stop the fully-public read. Owner keeps their own (via the
-- untouched owner_write policy); guests read the calendar of the owner whose project
-- they're scoped to; booking-page owners stay readable so public booking works.
drop policy if exists "public_read" on public.owner_calendar_events;
create policy "scoped_owner_cal_read" on public.owner_calendar_events for select to anon, authenticated
  using (
    owner_id = auth.uid()
    or owner_id::text in (select p.owner_id from public.productions p where public.can_access_production(p.id))
    or owner_id in (select owner_id from public.booking_pages)
  );
