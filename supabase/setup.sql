-- ListenWell — Supabase backend setup
--
-- Run this in the Supabase Dashboard → SQL Editor for the project used by
-- the deployed site (vsnkrwunsbjkohfsxmpx.supabase.co). It is idempotent:
-- safe to run more than once.
--
-- The app requires:
--   1. a `tracks` table with row-level security scoped to each user
--   2. a private `audio-files` storage bucket where each user can manage
--      files under a folder named after their user id
--
-- If either is missing or its policies are missing, uploads fail silently
-- in older builds of the app (newer builds show the error in a toast).

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

-- 2. Storage bucket ----------------------------------------------------------

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
