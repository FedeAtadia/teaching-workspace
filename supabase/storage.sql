-- Storage for task attachments (FILE-1..3). Applied to each Supabase project
-- once, and again whenever it changes: every statement can be re-run.
--
-- Kept out of drizzle/ because it lives in Supabase's own `storage` schema,
-- which the in-memory test database (PGlite) doesn't have.
--
--   npm run storage:apply              (dev, from .env.local)
--   see docs/BRANCHING.md              (prod, from .env.prod)

-- A private bucket: nothing in it is reachable without a signed link.
-- FILE-1: PDF, PNG or JPEG, up to 20 MB, enforced by Storage itself too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- FILE-2: each teacher reads and writes only their own folder, named after
-- their user id: task-files/<teacher id>/<task id>/<file>.
drop policy if exists "task-files: teachers read their own" on storage.objects;
create policy "task-files: teachers read their own" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "task-files: teachers upload to their own" on storage.objects;
create policy "task-files: teachers upload to their own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "task-files: teachers replace their own" on storage.objects;
create policy "task-files: teachers replace their own" on storage.objects
  for update to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "task-files: teachers delete their own" on storage.objects;
create policy "task-files: teachers delete their own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
