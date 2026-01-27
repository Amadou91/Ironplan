-- Rename 'yoga' muscle group to 'mobility'
-- 1. Insert 'mobility' if it doesn't exist
insert into public.muscle_groups (slug, label)
values ('mobility', 'Mobility')
on conflict (slug) do nothing;

-- 2. Update exercise_catalog
update public.exercise_catalog
set primary_muscle = 'mobility'
where primary_muscle = 'yoga';

update public.exercise_catalog
set secondary_muscles = array_replace(secondary_muscles, 'yoga', 'mobility')
where 'yoga' = any(secondary_muscles);

-- Update category if it exists (it was added in a migration)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'exercise_catalog' and column_name = 'category') then
    update public.exercise_catalog
    set category = 'Mobility'
    where category = 'Yoga';
  end if;
end $$;

update public.exercise_catalog
set metric_profile = 'mobility_session'
where metric_profile = 'yoga_session';

-- 3. Update session_exercises
update public.session_exercises
set primary_muscle = 'mobility'
where primary_muscle = 'yoga';

update public.session_exercises
set secondary_muscles = array_replace(secondary_muscles, 'yoga', 'mobility')
where 'yoga' = any(secondary_muscles);

update public.session_exercises
set metric_profile = 'mobility_session'
where metric_profile = 'yoga_session';

-- 4. Delete old 'yoga' muscle group if it's no longer used
-- We check if it exists first
do $$
begin
  if exists (select 1 from public.muscle_groups where slug = 'yoga') then
    delete from public.muscle_groups
    where slug = 'yoga';
  end if;
end $$;
