-- SECURITY: avatars / logos / canvas-images / task-attachments are PUBLIC buckets,
-- so objects are served by their /object/public/ URL with no policy check. The broad
-- SELECT policies on storage.objects additionally let anyone LIST/enumerate every
-- file. The app only uploads, builds getPublicUrl() links, and removes -- it never
-- .list()s -- so dropping these SELECT policies stops enumeration while public-URL
-- rendering, uploads, and deletes keep working.

drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "canvas_images_read" on storage.objects;
drop policy if exists "public_read_logos" on storage.objects;
drop policy if exists "task-attachments files read" on storage.objects;
