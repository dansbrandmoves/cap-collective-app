-- EMERGENCY REVERT for 20260721_scoped_project_rls. NOT applied — run this via
-- MCP apply_migration only if the scoped policies break guest/owner access and
-- you need to restore the old permissive behavior instantly. It drops the scoped
-- policies and re-creates the original allow_all ones verbatim.

drop policy if exists "scoped_productions" on public.productions;
create policy "allow_all_productions" on public.productions for all to public using (true) with check (true);

drop policy if exists "scoped_rooms" on public.rooms;
create policy "allow_all_groups" on public.rooms for all to public using (true) with check (true);

drop policy if exists "scoped_room_members" on public.room_members;
create policy "allow_all_group_members" on public.room_members for all to public using (true) with check (true);

drop policy if exists "scoped_messages" on public.messages;
create policy "allow_all_messages" on public.messages for all to public using (true) with check (true);

drop policy if exists "scoped_shared_notes" on public.shared_notes;
create policy "allow_all_shared_notes" on public.shared_notes for all to public using (true) with check (true);

drop policy if exists "scoped_date_requests" on public.date_requests;
create policy "anyone_read"   on public.date_requests for select to public using (true);
create policy "anyone_insert" on public.date_requests for insert to public with check (true);
create policy "anyone_update" on public.date_requests for update to public using (true);
create policy "anyone_delete" on public.date_requests for delete to public using (true);

drop policy if exists "scoped_shared_availability" on public.shared_availability;
create policy "shared_availability_rw" on public.shared_availability for all to anon, authenticated using (true) with check (true);

drop policy if exists "scoped_tasks" on public.tasks;
create policy "tasks_anon_all" on public.tasks for all to anon, authenticated using (true) with check (true);

drop policy if exists "scoped_board_columns" on public.board_columns;
create policy "board_columns_anon_all" on public.board_columns for all to anon, authenticated using (true) with check (true);

drop policy if exists "scoped_canvas_elements" on public.canvas_elements;
create policy "canvas_elements_anon_all" on public.canvas_elements for all to anon, authenticated using (true) with check (true);

drop policy if exists "scoped_task_comments" on public.task_comments;
create policy "task_comments_anon_all" on public.task_comments for all to anon, authenticated using (true) with check (true);

drop policy if exists "scoped_task_attachments" on public.task_attachments;
create policy "task_attachments anon read"   on public.task_attachments for select to anon, authenticated using (true);
create policy "task_attachments anon insert" on public.task_attachments for insert to anon, authenticated with check (true);
create policy "task_attachments anon delete" on public.task_attachments for delete to anon, authenticated using (true);

drop policy if exists "scoped_owner_cal_read" on public.owner_calendar_events;
create policy "public_read" on public.owner_calendar_events for select to public using (true);
