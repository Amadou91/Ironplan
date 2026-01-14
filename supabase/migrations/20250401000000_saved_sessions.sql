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

create index if not exists saved_sessions_user_idx
  on public.saved_sessions (user_id);

alter table public.saved_sessions enable row level security;

create policy "Users can manage their saved sessions" on public.saved_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
