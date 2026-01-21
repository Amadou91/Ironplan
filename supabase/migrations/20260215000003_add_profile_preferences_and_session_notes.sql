alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.sessions
  add column if not exists timezone text,
  add column if not exists session_notes text;
