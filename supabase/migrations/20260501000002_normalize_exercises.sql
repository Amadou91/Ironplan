-- Justified corrections for exercise catalog normalization

-- Ensure metric profiles are set for all specialty sessions
update public.exercise_catalog
set metric_profile = 'yoga_session'
where name = 'Yoga' and (metric_profile is null or metric_profile != 'yoga_session');

update public.exercise_catalog
set metric_profile = 'mobility_session'
where name = 'Stretching' and (metric_profile is null or metric_profile != 'mobility_session');

update public.exercise_catalog
set metric_profile = 'cardio_session'
where focus = 'cardio' and (metric_profile is null or metric_profile not in ('cardio_session', 'timed_strength'));
