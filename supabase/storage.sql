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

-- SHARE-6: a guest reads the files of a class shared with them (SHARE-1),
-- read-only: the task's file, its adapted file and the passing standards'
-- files, the adapted ones and a student's own standards only when the owner
-- lets the guest see adaptations (SHARE-3). Nothing else of the owner's.
--
-- In its own schema, which the public API doesn't expose, and run with the
-- definer's rights: storage's checks run as the guest, who can't read the
-- class_shares table themselves (row-level security with no policies).
create schema if not exists annora_private;
grant usage on schema annora_private to authenticated;

create or replace function annora_private.can_read_shared_file(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- <owner>/<task id>[/adapted]/<file> or <owner>/standards/<standard id>/<file>
  parts text[] := storage.foldername(object_name);
  owner_id text := parts[1];
  is_uuid constant text := '^[0-9a-fA-F-]{36}$';
begin
  if (select auth.uid()) is null or owner_id is null then
    return false;
  end if;
  if parts[2] = 'standards' then
    if parts[3] is null or parts[3] !~ is_uuid then
      return false;
    end if;
    return exists (
      select 1
      from public.standards s
      join public.class_shares cs on cs.class_id = s.class_id
      where s.id = parts[3]::uuid
        and s.teacher_id::text = owner_id
        and cs.guest_id = (select auth.uid())
        and cs.status = 'accepted'
        and (s.student_id is null or cs.include_adaptations)
    );
  end if;
  if parts[2] is null or parts[2] !~ is_uuid then
    return false;
  end if;
  return exists (
    select 1
    from public.tasks t
    join public.class_shares cs on cs.class_id = t.class_id
    where t.id = parts[2]::uuid
      and t.teacher_id::text = owner_id
      and cs.guest_id = (select auth.uid())
      and cs.status = 'accepted'
      and (parts[3] is distinct from 'adapted' or cs.include_adaptations)
  );
end;
$$;

revoke all on function annora_private.can_read_shared_file(text) from public;
grant execute on function annora_private.can_read_shared_file(text) to authenticated;

drop policy if exists "task-files: guests read shared classes" on storage.objects;
create policy "task-files: guests read shared classes" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-files' and annora_private.can_read_shared_file(name));
