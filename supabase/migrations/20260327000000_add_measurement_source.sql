ALTER TABLE public.body_measurements
ADD COLUMN IF NOT EXISTS source text DEFAULT 'user';
