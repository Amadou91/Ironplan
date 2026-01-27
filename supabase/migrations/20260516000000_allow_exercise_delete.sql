-- Allow authenticated and anon users to delete from exercise catalog
-- Needed for the "Reset Workouts" functionality in Admin UI.

-- 1. Create permissive policy for delete
-- (Matches the existing permissive policies for select/insert/update in 20260501000003)
create policy "Public delete access" on public.exercise_catalog
  for delete using (true);
