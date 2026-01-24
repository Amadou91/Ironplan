insert into public.muscle_groups (slug, label) values ('yoga', 'Yoga') on conflict (slug) do nothing;
