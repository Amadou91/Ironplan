-- 1. Remove redundant JSONB column from sessions
ALTER TABLE public.sessions DROP COLUMN IF EXISTS generated_exercises;

-- 2. Clean up Muscle Groups
-- 'arms' is ambiguous; remove it to force specificity (biceps/triceps)
DELETE FROM public.muscle_groups WHERE slug = 'arms';

-- 3. Add Strict Constraints to Arrays
-- Ensure secondary_muscles doesn't contain the primary_muscle
ALTER TABLE public.exercise_catalog 
ADD CONSTRAINT check_muscles_overlap 
CHECK (NOT (primary_muscle = ANY(secondary_muscles)));

-- 4. Standardize Metric Profiles
-- Update existing 'strength' to 'reps_weight'
UPDATE public.exercise_catalog SET metric_profile = 'reps_weight' WHERE metric_profile = 'strength';
UPDATE public.session_exercises SET metric_profile = 'reps_weight' WHERE metric_profile = 'strength';

-- Update defaults
ALTER TABLE public.session_exercises ALTER COLUMN metric_profile SET DEFAULT 'reps_weight';
ALTER TABLE public.exercise_catalog ALTER COLUMN metric_profile SET DEFAULT 'reps_weight';

-- 5. Body Weight Synchronization
-- Keep profiles.weight_lb in sync with the latest body_measurements entry
CREATE OR REPLACE FUNCTION public.sync_profile_weight()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET weight_lb = NEW.weight_lb,
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_body_measurement_insert ON public.body_measurements;
CREATE TRIGGER on_body_measurement_insert
  AFTER INSERT ON public.body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_weight();
