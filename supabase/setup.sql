-- ListenWell — Supabase backend setup
--
-- Run this in the Supabase Dashboard → SQL Editor for the project used by
-- the deployed site (vsnkrwunsbjkohfsxmpx.supabase.co). It is idempotent:
-- safe to run more than once.
--
-- The app requires:
--   1. a `tracks` table (one row per uploaded song), RLS-scoped per user
--   2. a `user_state` table (playlists, loved songs, settings), per user
--   3. a private `audio-files` storage bucket where each user can manage
--      files under a folder named after their user id
--
-- Symptoms when this has NOT been run on the project:
--   - "Could not find the table 'public.user_state' in the schema cache"
--   - "permission denied for table tracks"
--   - 403 responses from storage, and uploads that never persist
--
-- Run the WHOLE file at once (Supabase Dashboard -> SQL Editor -> Run).

-- 1. Tracks table ------------------------------------------------------------

create table if not exists public.tracks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  artist text,
  album text,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

drop policy if exists "Users can view own tracks" on public.tracks;
create policy "Users can view own tracks"
  on public.tracks for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own tracks" on public.tracks;
create policy "Users can insert own tracks"
  on public.tracks for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own tracks" on public.tracks;
create policy "Users can update own tracks"
  on public.tracks for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own tracks" on public.tracks;
create policy "Users can delete own tracks"
  on public.tracks for delete
  to authenticated
  using (auth.uid() = user_id);

-- Table-level privileges. RLS policies above decide WHICH rows a user can
-- touch, but the role still needs the base GRANT or every query fails with
-- "permission denied for table tracks". Supabase normally grants these by
-- default; we set them explicitly so this script works even when the table
-- was created some other way.
grant select, insert, update, delete on public.tracks to authenticated;

-- Per-account upload cap, enforced in the database so it can't be bypassed by
-- calling the API directly (the client also checks this for a friendly error).
-- Change `max_uploads` here when you revise the limit.
create or replace function public.enforce_track_upload_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  track_count integer;
  max_uploads constant integer := 50;
begin
  select count(*) into track_count from public.tracks where user_id = new.user_id;
  if track_count >= max_uploads then
    raise exception 'Upload limit reached: a maximum of % songs are allowed per account.', max_uploads
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_track_upload_limit on public.tracks;
create trigger enforce_track_upload_limit
  before insert on public.tracks
  for each row execute function public.enforce_track_upload_limit();

-- 2. Per-user synced state (playlists, loved songs, settings) -----------------
-- One JSONB row per user; the client loads it on login and writes it
-- (debounced) whenever any synced value changes.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "Users can view own state" on public.user_state;
create policy "Users can view own state"
  on public.user_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own state" on public.user_state;
create policy "Users can insert own state"
  on public.user_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own state" on public.user_state;
create policy "Users can update own state"
  on public.user_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own state" on public.user_state;
create policy "Users can delete own state"
  on public.user_state for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_state to authenticated;

-- 3. Storage bucket ----------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('audio-files', 'audio-files', false)
on conflict (id) do nothing;

-- Files are stored as <user_id>/<track_id>/<file>, so the first folder
-- segment must match the authenticated user's id.

drop policy if exists "Users can upload own audio" on storage.objects;
create policy "Users can upload own audio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'audio-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read own audio" on storage.objects;
create policy "Users can read own audio"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'audio-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own audio" on storage.objects;
create policy "Users can update own audio"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'audio-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own audio" on storage.objects;
create policy "Users can delete own audio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'audio-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Refresh the API schema cache --------------------------------------------
-- PostgREST (the REST API) caches the schema. Without this, a freshly
-- created table can return "Could not find the table 'public.<x>' in the
-- schema cache" until the cache reloads on its own.
notify pgrst, 'reload schema';
