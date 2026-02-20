-- Fix Weight Synchronization and Backfill Profile Weights
-- 1. Ensure standard audit columns exist
ALTER TABLE public.body_measurements ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. Date-aware synchronization function
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

-- 3. Re-create the trigger for all changes
DROP TRIGGER IF EXISTS on_body_measurement_insert ON public.body_measurements;
DROP TRIGGER IF EXISTS on_body_measurement_change ON public.body_measurements;

CREATE TRIGGER on_body_measurement_change
  AFTER INSERT OR UPDATE OR DELETE ON public.body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_weight();

-- 4. Initial backfill to synchronize all current profiles
UPDATE public.profiles p
SET weight_lb = m.weight_lb,
    updated_at = now()
FROM (
    SELECT DISTINCT ON (user_id) user_id, weight_lb
    FROM public.body_measurements
    ORDER BY user_id, recorded_at DESC, created_at DESC
) AS m
WHERE p.id = m.user_id;
