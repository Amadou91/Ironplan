-- Enforce set-level metric integrity for strength analytics.
-- Clean invalid historical rows first so constraint creation is non-breaking.

UPDATE public.sets
SET rpe = null
WHERE rpe IS NOT NULL AND (rpe < 0 OR rpe > 10);

UPDATE public.sets
SET rir = null
WHERE rir IS NOT NULL AND (rir < 0 OR rir > 6);

UPDATE public.sets
SET reps = null
WHERE reps IS NOT NULL AND reps < 0;

UPDATE public.sets
SET weight = null
WHERE weight IS NOT NULL AND weight < 0;

UPDATE public.sets
SET duration_seconds = null
WHERE duration_seconds IS NOT NULL AND duration_seconds < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sets_rpe_range'
      AND conrelid = 'public.sets'::regclass
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_rpe_range
      CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sets_rir_range'
      AND conrelid = 'public.sets'::regclass
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_rir_range
      CHECK (rir IS NULL OR (rir >= 0 AND rir <= 6));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sets_reps_non_negative'
      AND conrelid = 'public.sets'::regclass
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_reps_non_negative
      CHECK (reps IS NULL OR reps >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sets_weight_non_negative'
      AND conrelid = 'public.sets'::regclass
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_weight_non_negative
      CHECK (weight IS NULL OR weight >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sets_duration_non_negative'
      AND conrelid = 'public.sets'::regclass
  ) THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_duration_non_negative
      CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
  END IF;
END $$;
