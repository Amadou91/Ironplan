create table if not exists public.muscle_groups (
  slug text primary key,
  label text not null
);

insert into public.muscle_groups (slug, label) values
  ('chest', 'Chest'),
  ('back', 'Back'),
  ('shoulders', 'Shoulders'),
  ('arms', 'Arms'),
  ('biceps', 'Biceps'),
  ('triceps', 'Triceps'),
  ('forearms', 'Forearms'),
  ('core', 'Core'),
  ('glutes', 'Glutes'),
  ('quads', 'Quads'),
  ('hamstrings', 'Hamstrings'),
  ('calves', 'Calves'),
  ('hip_flexors', 'Hip Flexors'),
  ('adductors', 'Adductors'),
  ('abductors', 'Abductors'),
  ('upper_body', 'Upper Body'),
  ('lower_body', 'Lower Body'),
  ('full_body', 'Full Body'),
  ('cardio', 'Cardio')
on conflict (slug) do nothing;

create table if not exists public.exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_muscle text references public.muscle_groups(slug),
  secondary_muscles text[] not null default '{}',
  equipment text,
  created_at timestamptz not null default now()
);

create index if not exists exercise_catalog_primary_muscle_idx on public.exercise_catalog (primary_muscle);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid references public.exercise_catalog(id) on delete set null,
  exercise_name text not null,
  primary_muscle text references public.muscle_groups(slug),
  secondary_muscles text[] not null default '{}',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists session_exercises_session_idx on public.session_exercises (session_id, order_index);

create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number int not null,
  reps int,
  weight numeric(10,2),
  rpe numeric(3,1),
  rir numeric(3,1),
  notes text,
  completed boolean not null default false,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sets_exercise_idx on public.sets (session_exercise_id, set_number);

alter table public.muscle_groups enable row level security;
alter table public.exercise_catalog enable row level security;
alter table public.sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.sets enable row level security;

create policy "Muscle groups are viewable by everyone" on public.muscle_groups
  for select using (true);

create policy "Exercise catalog is viewable by everyone" on public.exercise_catalog
  for select using (true);

create policy "Users can manage their sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage their session exercises" on public.session_exercises
  for all using (
    exists (
      select 1
      from public.sessions
      where public.sessions.id = session_exercises.session_id
        and public.sessions.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.sessions
      where public.sessions.id = session_exercises.session_id
        and public.sessions.user_id = auth.uid()
    )
  );

create policy "Users can manage their sets" on public.sets
  for all using (
    exists (
      select 1
      from public.session_exercises
      join public.sessions on public.sessions.id = session_exercises.session_id
      where session_exercises.id = sets.session_exercise_id
        and public.sessions.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.session_exercises
      join public.sessions on public.sessions.id = session_exercises.session_id
      where session_exercises.id = sets.session_exercise_id
        and public.sessions.user_id = auth.uid()
    )
  );
