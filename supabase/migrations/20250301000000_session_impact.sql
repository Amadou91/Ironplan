alter table public.sessions
  add column if not exists impact jsonb;
