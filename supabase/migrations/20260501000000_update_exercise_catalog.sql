-- Update exercise_catalog to support full ExerciseTemplate data
alter table public.exercise_catalog
  add column if not exists focus text,
  add column if not exists movement_pattern text,
  add column if not exists goal text,
  add column if not exists metric_profile text,
  add column if not exists sets int,
  add column if not exists reps text,
  add column if not exists rpe int,
  add column if not exists duration_minutes int,
  add column if not exists rest_seconds int,
  add column if not exists load_target int,
  add column if not exists e1rm_eligible boolean default false;

-- Handle equipment column change (safely drop and recreate as jsonb)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'exercise_catalog' and column_name = 'equipment' and data_type = 'text') then
    alter table public.exercise_catalog drop column equipment;
  end if;
end $$;

alter table public.exercise_catalog 
  add column if not exists equipment jsonb not null default '[]'::jsonb;

-- Add indexes for common filters
create index if not exists exercise_catalog_focus_idx on public.exercise_catalog (focus);
create index if not exists exercise_catalog_goal_idx on public.exercise_catalog (goal);
