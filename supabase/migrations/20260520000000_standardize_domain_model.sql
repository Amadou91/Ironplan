-- 20260520000000_standardize_domain_model.sql

-- 1. Standardization: Cardio
-- Category: "Cardio" -> Goal: "Endurance", Target Muscle: "Full Body"
UPDATE public.exercise_catalog
SET 
  goal = 'endurance',
  primary_muscle = 'full_body'
WHERE category = 'Cardio';

-- 2. Standardization: Mobility
-- Category: "Mobility" -> Goal: "Range of Motion", Target Muscle: "Full Body"
UPDATE public.exercise_catalog
SET 
  goal = 'range_of_motion',
  primary_muscle = 'full_body'
WHERE category = 'Mobility';

-- 3. Cleanup: Target Muscle Rules
-- If any other exercises (Strength) had 'cardio' or 'mobility' as muscle, default to 'full_body'
UPDATE public.exercise_catalog
SET primary_muscle = 'full_body'
WHERE primary_muscle IN ('cardio', 'mobility');

-- 4. Remove invalid Muscle Groups
DELETE FROM public.muscle_groups 
WHERE slug IN ('cardio', 'mobility');

-- 5. Update eligible_goals to replace 'cardio'/'mobility' with correct values
-- This uses array replacement logic
UPDATE public.exercise_catalog
SET eligible_goals = array_replace(eligible_goals, 'cardio', 'endurance')
WHERE 'cardio' = ANY(eligible_goals);

UPDATE public.exercise_catalog
SET eligible_goals = array_replace(eligible_goals, 'mobility', 'range_of_motion')
WHERE 'mobility' = ANY(eligible_goals);
