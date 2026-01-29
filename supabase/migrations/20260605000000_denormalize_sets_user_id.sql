-- Migration: Denormalize user_id onto sets table for faster RLS checks
-- This eliminates 2-hop joins (sets → session_exercises → sessions) for ownership verification

-- 1. Add user_id column (nullable initially for backfill)
ALTER TABLE public.sets 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill existing sets with user_id from their parent session
UPDATE public.sets s
SET user_id = sess.user_id
FROM public.session_exercises se
JOIN public.sessions sess ON sess.id = se.session_id
WHERE s.session_exercise_id = se.id
  AND s.user_id IS NULL;

-- 3. Make user_id NOT NULL after backfill
ALTER TABLE public.sets 
ALTER COLUMN user_id SET NOT NULL;

-- 4. Add index for common query patterns (user's sets by date)
CREATE INDEX IF NOT EXISTS sets_user_performed_idx 
ON public.sets (user_id, performed_at DESC);

-- 5. Drop the old complex RLS policy
DROP POLICY IF EXISTS "Users can manage their sets" ON public.sets;

-- 6. Create new simplified RLS policy using direct user_id
CREATE POLICY "Users can manage their sets" ON public.sets
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Add a trigger to automatically set user_id on insert
-- This ensures new sets get the correct user_id without client changes
CREATE OR REPLACE FUNCTION public.set_user_id_from_session()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_id is not provided, derive it from the session
  IF NEW.user_id IS NULL THEN
    SELECT sess.user_id INTO NEW.user_id
    FROM public.session_exercises se
    JOIN public.sessions sess ON sess.id = se.session_id
    WHERE se.id = NEW.session_exercise_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for insert
DROP TRIGGER IF EXISTS set_user_id_on_insert ON public.sets;
CREATE TRIGGER set_user_id_on_insert
  BEFORE INSERT ON public.sets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_id_from_session();
