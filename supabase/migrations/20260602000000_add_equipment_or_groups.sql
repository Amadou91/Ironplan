-- Add equipment OR-group support to exercise_catalog
-- OR-groups allow exercises to declare equipment substitutability
-- See src/lib/equipment-groups.ts for full documentation

-- Add the or_group column
alter table public.exercise_catalog
add column if not exists or_group text;

-- Add a comment explaining the field
comment on column public.exercise_catalog.or_group is
'Optional equipment OR-group for substitutable equipment. Values: free_weight_primary, single_implement, pull_up_infrastructure, treadmill_outdoor, stationary_spin, rowing_machines, resistance_variable';

-- Create index for efficient filtering by OR-group
create index if not exists exercise_catalog_or_group_idx on public.exercise_catalog (or_group);

-- Assign OR-groups to existing exercises based on their equipment patterns
-- These assignments follow the explicit scoping rules defined in the equipment-groups module

-- 1. free_weight_primary: Exercises that can use Barbell OR Dumbbells interchangeably
-- Only for bilateral movements where load pattern is equivalent
update public.exercise_catalog
set or_group = 'free_weight_primary'
where name in (
  'Romanian Deadlift',
  'Overhead Press',
  'Floor Press',
  'Reverse Curl'
)
and or_group is null;

-- 2. single_implement: Kettlebell OR single Dumbbell for ballistic/unilateral exercises
-- Strictly for single-implement movements like swings, goblet squats
update public.exercise_catalog
set or_group = 'single_implement'
where name in (
  'Dumbbell Goblet Squat',
  'Kettlebell Swing',
  'Hammer Curl'  -- Can be done with single DB or KB
)
and or_group is null;

-- 3. resistance_variable: Resistance Bands OR Cables
-- Only where the exercise profile supports variable resistance substitution
update public.exercise_catalog
set or_group = 'resistance_variable'
where name in (
  'Dumbbell Biceps Curl',  -- Has band option in equipment
  'Overhead Triceps Extension',  -- Has band option
  'Resistance Band Pull-Apart'  -- Could use cable face pull as alternative
)
and or_group is null;

-- Note: The following OR-groups are context-specific and should be assigned
-- when cardio exercises are added to the catalog:
-- - treadmill_outdoor: for running-based cardio
-- - stationary_spin: for cycling-based cardio  
-- - rowing_machines: for rowing/ski erg cardio

-- Note: pull_up_infrastructure group should be assigned to pull-up/chin-up exercises
-- when they are added with explicit pull-up bar or rings equipment options
