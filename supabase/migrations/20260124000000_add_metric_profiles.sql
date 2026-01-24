-- Add metric_profile to session_exercises (acting as the exercises table)
ALTER TABLE public.session_exercises 
ADD COLUMN IF NOT EXISTS metric_profile text NOT NULL DEFAULT 'strength';

-- Add extra_metrics to sets
ALTER TABLE public.sets 
ADD COLUMN IF NOT EXISTS extra_metrics jsonb;

-- Backfill metric_profile based on name matching
UPDATE public.session_exercises
SET metric_profile = CASE
    WHEN exercise_name ILIKE '%yoga%' OR exercise_name ILIKE '%flow%' THEN 'yoga_session'
    WHEN exercise_name ILIKE '%run%' 
      OR exercise_name ILIKE '%bike%' 
      OR exercise_name ILIKE '%row%' 
      OR exercise_name ILIKE '%elliptical%' 
      OR exercise_name ILIKE '%cycling%' 
      OR exercise_name ILIKE '%cardio%' 
      OR exercise_name ILIKE '%skipping%' THEN 'cardio_session'
    WHEN exercise_name ILIKE '%stretch%' OR exercise_name ILIKE '%mobility%' THEN 'mobility_session'
    WHEN exercise_name ILIKE '%plank%' 
      OR exercise_name ILIKE '%wall sit%' 
      OR exercise_name ILIKE '%hold%' 
      OR exercise_name ILIKE '%carry%' THEN 'timed_strength'
    ELSE 'strength'
END;
