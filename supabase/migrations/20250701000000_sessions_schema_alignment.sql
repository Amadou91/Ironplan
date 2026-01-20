do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'workout_id'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'sessions'
        and column_name = 'template_id'
    ) then
      alter table public.sessions drop constraint if exists sessions_workout_id_fkey;
      alter table public.sessions rename column workout_id to template_id;
    else
      alter table public.sessions drop constraint if exists sessions_workout_id_fkey;
      alter table public.sessions drop column workout_id;
    end if;
  end if;
end $$;

alter table public.sessions
  add column if not exists template_id uuid references public.workout_templates(id) on delete set null,
  add column if not exists minutes_available int,
  add column if not exists generated_exercises jsonb not null default '[]'::jsonb,
  add column if not exists impact jsonb;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'sessions_status_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions drop constraint sessions_status_check;
  end if;
end $$;

update public.sessions
  set status = 'in_progress'
  where status = 'active';

alter table public.sessions
  alter column status set default 'in_progress';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_status_check'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_status_check
      check (status in ('in_progress', 'completed', 'cancelled'));
  end if;
end $$;

alter table public.sessions
  drop constraint if exists sessions_template_id_fkey;

alter table public.sessions
  add constraint sessions_template_id_fkey
  foreign key (template_id)
  references public.workout_templates(id)
  on delete set null;
