-- Allow authenticated users to update the exercise catalog
-- In a real production app, this should be restricted to admin users.
-- For now, consistent with the "Admin UI" context in a single-tenant/prototype scenario.

create policy "Exercise catalog is updatable by authenticated users" on public.exercise_catalog
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Exercise catalog is insertable by authenticated users" on public.exercise_catalog
  for insert
  with check (auth.role() = 'authenticated');
