ALTER TABLE sets
ADD COLUMN IF NOT EXISTS duration_seconds integer,
ADD COLUMN IF NOT EXISTS distance numeric,
ADD COLUMN IF NOT EXISTS distance_unit text;

CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight_lb numeric(6,2),
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own measurements"
  ON body_measurements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own measurements"
  ON body_measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);
