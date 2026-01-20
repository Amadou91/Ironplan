create extension if not exists "pgcrypto";

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

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  goal text,
  level text,
  tags text[],
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'COMPLETED')),
  exercises jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_created_idx
  on public.workouts (user_id, created_at desc);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  focus text not null,
  style text not null,
  experience_level text not null,
  intensity text not null,
  equipment jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  template_inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workout_templates_user_created_idx
  on public.workout_templates (user_id, created_at desc);

alter table public.workouts enable row level security;
alter table public.workout_templates enable row level security;

drop policy if exists "Users can manage their workouts" on public.workouts;
drop policy if exists "Users can manage their workout templates" on public.workout_templates;

create policy "Users can manage their workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage their workout templates" on public.workout_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes_available int,
  generated_exercises jsonb not null default '[]'::jsonb,
  impact jsonb,
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

create table if not exists public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  schedule_batch_id uuid not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  week_start_date date not null,
  order_index int not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'COMPLETED')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  day_of_week int not null check (day_of_week between 0 and 6),
  session_name text not null,
  workouts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists saved_sessions_user_day_idx
  on public.saved_sessions (user_id, day_of_week);

alter table public.scheduled_sessions enable row level security;

drop policy if exists "Users can manage their scheduled sessions" on public.scheduled_sessions;

create policy "Users can manage their scheduled sessions" on public.scheduled_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.saved_sessions enable row level security;

drop policy if exists "Users can manage their saved sessions" on public.saved_sessions;

create policy "Users can manage their saved sessions" on public.saved_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

grant usage on schema public to anon, authenticated;

grant select on public.muscle_groups to anon, authenticated;
grant select on public.exercise_catalog to anon, authenticated;

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update, delete on public.sets to authenticated;
grant select, insert, update, delete on public.scheduled_sessions to authenticated;
grant select, insert, update, delete on public.saved_sessions to authenticated;
