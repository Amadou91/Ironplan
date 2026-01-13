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
