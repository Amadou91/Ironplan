-- Add category column to exercise_catalog
alter table public.exercise_catalog
add column if not exists category text not null default 'Strength';

-- Optional: Add check constraint if we want to enforce specific categories
-- alter table public.exercise_catalog
-- add constraint exercise_catalog_category_check check (category in ('Strength', 'Cardio', 'Yoga'));
