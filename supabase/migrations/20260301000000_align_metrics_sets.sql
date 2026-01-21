do $$
begin
  create type public.weight_unit_enum as enum ('lb', 'kg');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.set_type_enum as enum ('working', 'backoff', 'drop', 'amrap');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.group_type_enum as enum ('superset', 'circuit', 'giant_set', 'dropset');
exception
  when duplicate_object then null;
end $$;

alter table public.sets
  add column if not exists set_type public.set_type_enum not null default 'working',
  add column if not exists weight_unit public.weight_unit_enum not null default 'lb',
  add column if not exists rest_seconds_actual int,
  add column if not exists failure boolean default false,
  add column if not exists tempo text,
  add column if not exists rom_cue text,
  add column if not exists pain_score int,
  add column if not exists pain_area text,
  add column if not exists group_id text,
  add column if not exists group_type public.group_type_enum,
  add column if not exists extras jsonb not null default '{}'::jsonb;

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
      check ((pain_score is null) or (pain_score >= 0 and pain_score <= 10));
  end if;
end $$;

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
