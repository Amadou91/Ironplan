create extension if not exists "pgcrypto";

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  goal text,
  level text,
  tags text[],
  status text not null default 'DRAFT',
  exercises jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_status_check'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
      add constraint workouts_status_check
      check (status in ('DRAFT', 'ACTIVE', 'ARCHIVED', 'COMPLETED'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_user_id_fkey'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
      add constraint workouts_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

create index if not exists workouts_user_created_idx
  on public.workouts (user_id, created_at desc);

alter table public.workouts enable row level security;

drop policy if exists "Users can manage their workouts" on public.workouts;

create policy "Users can manage their workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
