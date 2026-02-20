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
-- Keep profiles.weight_lb in sync with the latest body_measurements entry by date
CREATE OR REPLACE FUNCTION public.sync_profile_weight()
RETURNS TRIGGER AS $$
DECLARE
  latest_weight numeric(6,2);
  target_user_id uuid;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Find the most recent weight by recorded_at for this user
  SELECT weight_lb INTO latest_weight
  FROM public.body_measurements
  WHERE user_id = target_user_id
  ORDER BY recorded_at DESC, created_at DESC
  LIMIT 1;

  UPDATE public.profiles
  SET weight_lb = latest_weight,
      updated_at = now()
  WHERE id = target_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_body_measurement_change ON public.body_measurements;
CREATE TRIGGER on_body_measurement_change
  AFTER INSERT OR UPDATE OR DELETE ON public.body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_weight();
