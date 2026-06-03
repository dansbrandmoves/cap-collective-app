-- Explicit per-project role, foundation for permissions.
-- Model: the project's owner_id is the Coordinator (implicit, full control).
-- Everyone in room_members is a 'member' by default; 'coordinator'/'admin' are
-- reserved for future co-owner / elevated-permission features so checks can be
-- explicit (role-based) instead of only owner_id === user.id.
alter table public.room_members
  add column if not exists role text not null default 'member';

do $$ begin
  alter table public.room_members
    add constraint room_members_role_check check (role in ('member', 'coordinator', 'admin'));
exception when duplicate_object then null; end $$;
