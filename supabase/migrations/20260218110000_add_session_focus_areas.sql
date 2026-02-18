-- Add normalized multi-focus relation for sessions
create table if not exists public.session_focus_areas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  focus_area text not null,
  created_at timestamptz not null default now(),
  unique (session_id, focus_area)
);

alter table public.session_focus_areas
  drop constraint if exists session_focus_areas_focus_area_fkey;

alter table public.session_focus_areas
  drop constraint if exists session_focus_areas_focus_area_check;

alter table public.session_focus_areas
  add constraint session_focus_areas_focus_area_check
  check (
    focus_area in (
      'upper',
      'lower',
      'full_body',
      'core',
      'cardio',
      'mobility',
      'arms',
      'legs',
      'biceps',
      'triceps',
      'chest',
      'back',
      'shoulders',
      'upper_body',
      'lower_body'
    )
  );

create index if not exists session_focus_areas_session_idx
  on public.session_focus_areas (session_id);

create index if not exists session_focus_areas_focus_idx
  on public.session_focus_areas (focus_area);

-- Backfill from existing single-focus snapshot field (if present on this schema)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sessions'
      and column_name = 'session_focus'
  ) then
    insert into public.session_focus_areas (session_id, focus_area)
    select
      s.id,
      case
        when s.session_focus = 'upper_body' then 'upper'
        when s.session_focus = 'lower_body' then 'lower'
        else s.session_focus
      end as focus_area
    from public.sessions s
    where s.session_focus is not null
      and s.session_focus in (
        'upper',
        'lower',
        'full_body',
        'core',
        'cardio',
        'mobility',
        'arms',
        'legs',
        'biceps',
        'triceps',
        'chest',
        'back',
        'shoulders',
        'upper_body',
        'lower_body'
      )
    on conflict (session_id, focus_area) do nothing;
  end if;
end;
$$;

alter table public.session_focus_areas enable row level security;

create policy "Users can manage their session focus areas" on public.session_focus_areas
  for all
  using (
    exists (
      select 1
      from public.sessions
      where public.sessions.id = session_id
        and public.sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions
      where public.sessions.id = session_id
        and public.sessions.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.session_focus_areas to authenticated;
