-- Add load type and implement count for accurate total load calculations
DO $$
BEGIN
  CREATE TYPE public.load_type_enum AS ENUM ('total', 'per_implement');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS load_type public.load_type_enum NOT NULL DEFAULT 'total',
  ADD COLUMN IF NOT EXISTS implement_count integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sets_implement_count_range') THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_implement_count_range CHECK (
        implement_count IS NULL OR implement_count IN (1, 2)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sets_per_implement_requires_count') THEN
    ALTER TABLE public.sets
      ADD CONSTRAINT sets_per_implement_requires_count CHECK (
        load_type <> 'per_implement' OR implement_count IN (1, 2)
      );
  END IF;
END $$;
