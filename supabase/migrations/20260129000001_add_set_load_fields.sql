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

ALTER TABLE public.sets
  ADD CONSTRAINT IF NOT EXISTS sets_implement_count_range CHECK (
    implement_count IS NULL OR implement_count IN (1, 2)
  );

ALTER TABLE public.sets
  ADD CONSTRAINT IF NOT EXISTS sets_per_implement_requires_count CHECK (
    load_type <> 'per_implement' OR implement_count IN (1, 2)
  );
