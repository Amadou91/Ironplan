create extension if not exists "pgcrypto";

do $$
begin
  create type public.weight_unit_enum as enum ('lb', 'kg');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.group_type_enum as enum ('superset', 'circuit', 'giant_set', 'dropset');
exception
  when duplicate_object then null;
end $$;

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  height_in numeric(5,2),
  weight_lb numeric(6,2),
  body_fat_percent numeric(5,2),
  birthdate date,
  sex text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  timezone text,
  session_notes text,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);

create table if not exists public.session_readiness (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  sleep_quality int not null,
  muscle_soreness int not null,
  stress_level int not null,
  motivation int not null,
  readiness_score int,
  readiness_level text,
  created_at timestamptz not null default now(),
  constraint session_readiness_sleep_quality_range check (sleep_quality between 1 and 5),
  constraint session_readiness_muscle_soreness_range check (muscle_soreness between 1 and 5),
  constraint session_readiness_stress_level_range check (stress_level between 1 and 5),
  constraint session_readiness_motivation_range check (motivation between 1 and 5),
  constraint session_readiness_score_range check (readiness_score is null or readiness_score between 0 and 100),
  constraint session_readiness_level check (readiness_level in ('low', 'steady', 'high'))
);

create unique index if not exists session_readiness_session_unique on public.session_readiness (session_id);
create index if not exists session_readiness_user_recorded_idx on public.session_readiness (user_id, recorded_at desc);

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
  created_at timestamptz not null default now(),
  weight_unit public.weight_unit_enum not null default 'lb',
  tempo text,
  rom_cue text,
  group_id text,
  group_type public.group_type_enum,
  extras jsonb not null default '{}'::jsonb,
  constraint sets_rpe_rir_exclusive check (not (rpe is not null and rir is not null))
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
alter table public.profiles enable row level security;
alter table public.exercise_catalog enable row level security;
alter table public.sessions enable row level security;
alter table public.session_readiness enable row level security;
alter table public.session_exercises enable row level security;
alter table public.sets enable row level security;

create policy "Muscle groups are viewable by everyone" on public.muscle_groups
  for select using (true);

drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Profiles are updatable by owner" on public.profiles;
drop policy if exists "Profiles are insertable by owner" on public.profiles;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Profiles are insertable by owner" on public.profiles
  for insert with check (auth.uid() = id);

grant select, insert, update on public.profiles to authenticated;

create policy "Exercise catalog is viewable by everyone" on public.exercise_catalog
  for select using (true);

create policy "Users can manage their sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can manage their session readiness" on public.session_readiness
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
grant select, insert, update, delete on public.session_readiness to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update, delete on public.sets to authenticated;
grant select, insert, update, delete on public.scheduled_sessions to authenticated;
grant select, insert, update, delete on public.saved_sessions to authenticated;