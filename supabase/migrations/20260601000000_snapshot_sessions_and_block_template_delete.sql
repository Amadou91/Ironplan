-- Add session snapshot fields so history is independent of templates
alter table public.sessions
  add column if not exists session_focus text,
  add column if not exists session_goal text,
  add column if not exists session_intensity text;

-- Remove template foreign key dependency so session records are immutable when templates change/delete
alter table public.sessions
  drop constraint if exists sessions_template_id_fkey;

-- Backfill snapshot fields from templates when possible
update public.sessions s
set session_focus = coalesce(s.session_focus, t.focus),
    session_goal = coalesce(s.session_goal, t.style),
    session_intensity = coalesce(s.session_intensity, t.intensity)
from public.workout_templates t
where s.template_id = t.id
  and (s.session_focus is null or s.session_goal is null or s.session_intensity is null);

-- Prevent deleting a template that still has an active session
create or replace function public.prevent_template_delete_with_active_sessions()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.sessions
    where template_id = old.id
      and (
        status in ('initializing', 'in_progress')
        or (ended_at is null and status not in ('completed', 'cancelled'))
      )
  ) then
    raise exception 'Template has an active session and cannot be deleted until it is completed or cancelled.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists workout_templates_prevent_delete_active_sessions on public.workout_templates;
create trigger workout_templates_prevent_delete_active_sessions
before delete on public.workout_templates
for each row
execute function public.prevent_template_delete_with_active_sessions();
