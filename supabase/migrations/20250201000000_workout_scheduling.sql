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

alter table public.scheduled_sessions
  add column if not exists status text not null default 'DRAFT';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_sessions_status_check'
      and conrelid = 'public.scheduled_sessions'::regclass
  ) then
    alter table public.scheduled_sessions
      add constraint scheduled_sessions_status_check
      check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'COMPLETED'));
  end if;
end $$;

create index if not exists scheduled_sessions_user_week_idx
  on public.scheduled_sessions (user_id, week_start_date, day_of_week, is_active);

create index if not exists scheduled_sessions_batch_idx
  on public.scheduled_sessions (schedule_batch_id);

create unique index if not exists scheduled_sessions_unique_active_day
  on public.scheduled_sessions (user_id, week_start_date, day_of_week)
  where status = 'ACTIVE';

alter table public.scheduled_sessions enable row level security;

drop policy if exists "Users can manage their scheduled sessions" on public.scheduled_sessions;

create policy "Users can manage their scheduled sessions" on public.scheduled_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
