-- Allow 'initializing' as a valid session status
alter table public.sessions drop constraint sessions_status_check;
alter table public.sessions add constraint sessions_status_check check (status in ('initializing', 'in_progress', 'completed', 'cancelled'));
