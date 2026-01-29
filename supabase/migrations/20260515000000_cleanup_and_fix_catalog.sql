-- Migration: Cleanup redundant tables and fix exercise_catalog schema

-- 1. Add missing columns to exercise_catalog
alter table public.exercise_catalog
  add column if not exists instructions text[] not null default '{}',
  add column if not exists video_url text;

-- 2. Consolidate category column (ensure it matches our standard)
-- It was added in 20260505000001_add_category_column.sql
-- We ensure it exists and has the correct type.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'exercise_catalog' and column_name = 'category') then
    alter table public.exercise_catalog add column category text not null default 'Strength';
  end if;
end $$;

-- 3. Remove redundant tables
-- These were identified as unused in the current codebase.
drop table if exists public.saved_sessions cascade;
drop table if exists public.scheduled_sessions cascade;
drop table if exists public.workouts cascade;

-- 4. Add missing column to session_exercises for consistency (optional but recommended)
-- Some fields from catalog are often useful in session snapshots.
-- However, we currently only map name, primary_muscle, secondary_muscles, metric_profile.
-- We'll keep it minimal as per current usage to avoid bloat.

-- 5. Final check on exercise_catalog indexes
create index if not exists exercise_catalog_category_idx on public.exercise_catalog (category);
