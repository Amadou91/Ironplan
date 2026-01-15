grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.scheduled_sessions to authenticated;
grant select, insert, update, delete on public.saved_sessions to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update, delete on public.sets to authenticated;

grant select on public.muscle_groups to anon, authenticated;
grant select on public.exercise_catalog to anon, authenticated;
