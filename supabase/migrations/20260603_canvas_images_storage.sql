-- Image elements on the whiteboard: store the optimized file in a public bucket,
-- keep the URL + byte size on the element for quota accounting.
alter table canvas_elements add column if not exists src text;
alter table canvas_elements add column if not exists bytes bigint not null default 0;

-- Public bucket for canvas images (prototype: anon read/write, like the rest).
insert into storage.buckets (id, name, public)
values ('canvas-images', 'canvas-images', true)
on conflict (id) do nothing;

drop policy if exists canvas_images_read on storage.objects;
create policy canvas_images_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'canvas-images');

drop policy if exists canvas_images_insert on storage.objects;
create policy canvas_images_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'canvas-images');

drop policy if exists canvas_images_delete on storage.objects;
create policy canvas_images_delete on storage.objects for delete to anon, authenticated
  using (bucket_id = 'canvas-images');
