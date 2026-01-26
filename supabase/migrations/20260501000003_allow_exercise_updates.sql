-- Allow authenticated and anon users to update the exercise catalog
-- In a local development/prototype scenario, we want the Admin UI to be functional.

-- 1. Ensure RLS is enabled (if it wasn't already)
alter table public.exercise_catalog enable row level security;

-- 2. Drop existing restrictive policies
drop policy if exists "Exercise catalog is updatable by authenticated users" on public.exercise_catalog;
drop policy if exists "Exercise catalog is insertable by authenticated users" on public.exercise_catalog;
drop policy if exists "Exercise catalog is updatable by everyone" on public.exercise_catalog;
drop policy if exists "Exercise catalog is insertable by everyone" on public.exercise_catalog;

-- 3. Create permissive policies for both update and insert
create policy "Public update access" on public.exercise_catalog
  for update using (true) with check (true);

create policy "Public insert access" on public.exercise_catalog
  for insert with check (true);

create policy "Public select access" on public.exercise_catalog
  for select using (true);

-- 4. Explicitly grant table permissions to standard roles
-- This resolves "permission denied" (42501) errors which can occur if the roles lack basic SQL privileges
grant all on table public.exercise_catalog to anon, authenticated, service_role;
