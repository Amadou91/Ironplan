-- Add session_id to body_measurements to allow cascade deletion
ALTER TABLE public.body_measurements 
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS body_measurements_session_idx ON public.body_measurements (session_id);
