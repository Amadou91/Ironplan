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

alter table public.session_readiness enable row level security;

drop policy if exists "Users can manage their session readiness" on public.session_readiness;

create policy "Users can manage their session readiness" on public.session_readiness
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.session_readiness to authenticated;
