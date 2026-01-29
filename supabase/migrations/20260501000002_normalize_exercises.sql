-- Justified corrections for exercise catalog normalization

-- Normalize Kettlebell Swing
-- It is currently focus: cardio, primary_muscle: glutes (correct)
-- Its movement pattern was hinge, which is correct for strength, 
-- but given it's a cardio focus exercise, we ensure its goal is endurance.
update public.exercise_catalog
set goal = 'endurance'
where name = 'Kettlebell Swing' and goal is null;

-- Ensure Stretching and Yoga have general_fitness goal consistently
update public.exercise_catalog
set goal = 'general_fitness'
where name in ('Stretching', 'Yoga') and (goal is null or goal != 'general_fitness');

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
