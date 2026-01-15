create extension if not exists "pgcrypto";

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  goal text,
  level text,
  tags text[],
  exercises jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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
