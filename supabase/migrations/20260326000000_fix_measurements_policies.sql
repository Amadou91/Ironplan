-- Add missing policies for body_measurements to allow full management by the owner
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'body_measurements' AND policyname = 'Users can delete their own measurements'
    ) THEN
        CREATE POLICY "Users can delete their own measurements"
          ON body_measurements FOR DELETE
          USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'body_measurements' AND policyname = 'Users can update their own measurements'
    ) THEN
        CREATE POLICY "Users can update their own measurements"
          ON body_measurements FOR UPDATE
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Ensure grants are in place for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.body_measurements TO authenticated;
