-- 0. Ensure required muscle groups exist
insert into public.muscle_groups (slug, label) 
values ('mobility', 'Mobility') 
on conflict (slug) do nothing;

-- 1. Schema Cleanup: Remove redundant columns
alter table public.exercise_catalog 
drop column if exists video_url,
drop column if exists instructions,
drop column if exists eligible_goals,
drop column if exists load_target,
drop column if exists reps,
drop column if exists sets,
drop column if exists rpe,
drop column if exists duration_minutes,
drop column if exists rest_seconds,
drop column if exists difficulty,
drop column if exists goal,
drop column if exists interval_duration,
drop column if exists interval_rest;

-- 2. Data Consistency Fixes: Ensure 'Yoga' exercises use 'mobility' as primary muscle
update public.exercise_catalog
set primary_muscle = 'mobility'
where primary_muscle = 'yoga' or lower(name) like '%yoga%';

-- 3. Automate the 'Focus' Column
-- First, drop the existing focus column
alter table public.exercise_catalog drop column if exists focus;

-- Create the mapping function
create or replace function public.derive_focus_from_muscle(muscle_slug text)
returns text as $$
begin
  return case
    when muscle_slug in ('chest', 'back', 'shoulders', 'arms', 'biceps', 'triceps', 'forearms') then 'upper'
    when muscle_slug in ('glutes', 'quads', 'hamstrings', 'calves', 'hip_flexors', 'adductors', 'abductors') then 'lower'
    when muscle_slug in ('core') then 'core'
    when muscle_slug in ('cardio') then 'cardio'
    when muscle_slug in ('mobility', 'yoga') then 'mobility'
    else 'full_body'
  end;
end;
$$ language plpgsql immutable;

-- Re-add focus as a Generated Column
alter table public.exercise_catalog 
add column focus text generated always as (public.derive_focus_from_muscle(primary_muscle)) stored;

-- Update index for the new generated column
create index if not exists exercise_catalog_focus_idx on public.exercise_catalog (focus);
