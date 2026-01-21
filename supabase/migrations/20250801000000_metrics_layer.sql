do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'set_type_enum'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.set_type_enum as enum ('working', 'warmup', 'backoff', 'drop', 'amrap');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'weight_unit_enum'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.weight_unit_enum as enum ('lb', 'kg');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'group_type_enum'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.group_type_enum as enum ('superset', 'circuit', 'giant_set', 'dropset');
  end if;
end $$;

alter table public.sessions
  add column if not exists timezone text,
  add column if not exists session_notes text;

alter table public.session_exercises
  add column if not exists variation jsonb;

update public.session_exercises
  set variation = '{}'::jsonb
  where variation is null;

alter table public.session_exercises
  alter column variation set default '{}'::jsonb,
  alter column variation set not null;

alter table public.sets
  add column if not exists set_type public.set_type_enum,
  add column if not exists weight_unit public.weight_unit_enum,
  add column if not exists rest_seconds_actual integer,
  add column if not exists failure boolean,
  add column if not exists tempo text,
  add column if not exists rom_cue text,
  add column if not exists pain_score integer,
  add column if not exists pain_area text,
  add column if not exists group_id text,
  add column if not exists group_type public.group_type_enum,
  add column if not exists extras jsonb;

update public.sets
  set set_type = 'working'
  where set_type is null;

update public.sets
  set weight_unit = 'lb'
  where weight_unit is null;

update public.sets
  set failure = false
  where failure is null;

update public.sets
  set extras = '{}'::jsonb
  where extras is null;

alter table public.sets
  alter column set_type set default 'working',
  alter column set_type set not null,
  alter column weight_unit set default 'lb',
  alter column weight_unit set not null,
  alter column failure set default false,
  alter column extras set default '{}'::jsonb,
  alter column extras set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sets_rpe_rir_exclusive'
      and conrelid = 'public.sets'::regclass
  ) then
    alter table public.sets
      add constraint sets_rpe_rir_exclusive
      check (not (rpe is not null and rir is not null));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sets_pain_score_range'
      and conrelid = 'public.sets'::regclass
  ) then
    alter table public.sets
      add constraint sets_pain_score_range
      check (pain_score is null or (pain_score >= 0 and pain_score <= 10));
  end if;
end $$;

create index if not exists sessions_user_id_started_at_idx
  on public.sessions (user_id, started_at desc);

create index if not exists session_exercises_session_id_order_idx
  on public.session_exercises (session_id, order_index);

create index if not exists sets_session_exercise_id_set_number_idx
  on public.sets (session_exercise_id, set_number);

create index if not exists sets_performed_at_idx
  on public.sets (performed_at);
