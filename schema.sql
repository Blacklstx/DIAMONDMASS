-- ============================================================
-- DIAMONDMASS 16-WEEK TRACKER — Supabase schema
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Needed for gen_random_uuid() / crypto functions
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. PROFILES  (one row per signed-up user)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age int,
  gender text,
  height numeric,
  goal text default 'cutting' check (goal in ('cutting','bulking')),
  start_date date,
  start_weight numeric,
  target_weight numeric,
  start_waist numeric,
  training_days int,
  steps_target int,
  calorie_target int,
  protein_target int,
  cardio_target int,
  allow_future_checkins boolean default true,
  language text default 'th',
  role text default 'user' check (role in ('user','admin')),
  coach_token uuid default gen_random_uuid(),
  coach_share_active boolean default false,
  created_at timestamptz default now()
);

-- Migration safety if table already exists
alter table public.profiles add column if not exists role text default 'user' check (role in ('user','admin'));
alter table public.profiles alter column allow_future_checkins set default true;
update public.profiles set allow_future_checkins = true where allow_future_checkins is not true;

alter table public.profiles enable row level security;

-- Admin security definer helper
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- ------------------------------------------------------------
-- 2. CHECKINS  (one row per user per week, all weekly fields in `data` jsonb)
-- ------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  week int not null check (week between 1 and 16),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, week)
);

alter table public.checkins enable row level security;

create policy "checkins_all_own" on public.checkins
  for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. CHECKIN_PHOTOS (Dedicated table for tracking photos per week)
-- ------------------------------------------------------------
create table if not exists public.checkin_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  week int not null check (week between 1 and 16),
  front_path text,
  left_path text,
  right_path text,
  back_path text,
  updated_at timestamptz default now(),
  unique (user_id, week)
);

alter table public.checkin_photos enable row level security;

create policy "checkin_photos_all_own" on public.checkin_photos
  for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. STORAGE — private bucket for progress photos
--    Path convention: {user_id}/week-01/front.jpg etc.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "photos_select_own" on storage.objects
  for select using (
    bucket_id = 'progress-photos'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "photos_update_own" on storage.objects
  for update using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'progress-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------------------------------------------------------
-- 4. COACH REPORT — read-only function, callable by anon (no login needed)
--    Returns profile + all checkins ONLY if the token matches an
--    active coach_share_active row. Photos are intentionally excluded.
-- ------------------------------------------------------------
create or replace function public.get_coach_report(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_checkins jsonb;
begin
  select * into v_profile
  from public.profiles
  where coach_token = p_token and coach_share_active = true;

  if not found then
    return null;
  end if;

  select jsonb_agg(
           (c.data - 'photos') || jsonb_build_object('week', c.week)
         ) into v_checkins
  from public.checkins c
  where c.user_id = v_profile.id;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile) - 'coach_token',
    'checkins', coalesce(v_checkins, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_coach_report(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. ADMIN MANAGEMENT FUNCTIONS (Security Definer)
-- ------------------------------------------------------------

-- Reset all checkins and progress photos for a trainee
create or replace function public.admin_reset_user_data(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only admins can reset user data';
  end if;

  delete from public.checkins where user_id = p_user_id;
  delete from public.checkin_photos where user_id = p_user_id;

  delete from storage.objects
  where bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = p_user_id::text;

  return true;
end;
$$;

-- Permanently delete trainee user account and all data
create or replace function public.admin_delete_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only admins can delete users';
  end if;

  -- Delete from auth.users (cascades to profiles, checkins, checkin_photos)
  delete from auth.users where id = p_user_id;

  -- Delete progress photos from storage
  delete from storage.objects
  where bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = p_user_id::text;

  return true;
end;
$$;

grant execute on function public.admin_reset_user_data(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ============================================================
-- Done. Next steps:
-- 1. Go to Authentication → Providers → make sure "Email" is enabled.
-- 2. Authentication → Email Templates: customize if you like (optional).
-- 3. Authentication → URL Configuration: add your Netlify domain to
--    "Redirect URLs" once you deploy, so password-reset links work.
-- ============================================================
