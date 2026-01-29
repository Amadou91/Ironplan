-- 20260520000000_standardize_domain_model.sql

-- 1. Standardization: Cardio
-- Category: "Cardio" -> Target Muscle: "Full Body"
UPDATE public.exercise_catalog
SET primary_muscle = 'full_body'
WHERE category = 'Cardio';

-- 2. Standardization: Mobility
-- Category: "Mobility" -> Target Muscle: "Full Body"
UPDATE public.exercise_catalog
SET primary_muscle = 'full_body'
WHERE category = 'Mobility';

-- 3. Cleanup: Target Muscle Rules
-- If any other exercises (Strength) had 'cardio' or 'mobility' as muscle, default to 'full_body'
UPDATE public.exercise_catalog
SET primary_muscle = 'full_body'
WHERE primary_muscle IN ('cardio', 'mobility');

-- 4. Remove invalid Muscle Groups
DELETE FROM public.muscle_groups 
WHERE slug IN ('cardio', 'mobility');

-- 5. Eligible goals removed; no updates required.
