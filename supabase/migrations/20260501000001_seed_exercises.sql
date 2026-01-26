delete from public.exercise_catalog;

insert into public.exercise_catalog (
  name, focus, movement_pattern, difficulty, goal, primary_muscle, secondary_muscles,
  sets, reps, rpe, equipment, duration_minutes, load_target, rest_seconds, metric_profile, e1rm_eligible
) values
-- Strength (Reps & Weight)
('Barbell Back Squat', 'lower', 'squat', 'intermediate', 'strength', 'quads', '{}', 4, '5-8', 8, '[{"kind": "barbell"}]'::jsonb, 12, 135, 120, 'reps_weight', true),
('Dumbbell Goblet Squat', 'lower', 'squat', 'beginner', 'hypertrophy', 'quads', '{}', 3, '8-12', 7, '[{"kind": "dumbbell"}]'::jsonb, 10, 30, 90, 'reps_weight', false),
('Romanian Deadlift', 'lower', 'hinge', 'intermediate', 'hypertrophy', 'hamstrings', '{}', 3, '8-10', 8, '[{"kind": "barbell"}, {"kind": "dumbbell"}]'::jsonb, 10, 115, 120, 'reps_weight', true),
('Bench Press', 'upper', 'push', 'intermediate', 'strength', 'chest', '{}', 4, '5-8', 8, '[{"kind": "barbell"}]'::jsonb, 12, 115, 120, 'reps_weight', true),
('Dumbbell Bench Press', 'upper', 'push', 'intermediate', 'hypertrophy', 'chest', '{}', 3, '8-12', 7, '[{"kind": "dumbbell"}]'::jsonb, 10, 40, 90, 'reps_weight', false),
('Incline Barbell Press', 'upper', 'push', 'intermediate', 'strength', 'chest', '{}', 4, '6-8', 8, '[{"kind": "barbell"}]'::jsonb, 11, 95, 120, 'reps_weight', true),
('Decline Bench Press', 'upper', 'push', 'intermediate', 'strength', 'chest', '{}', 3, '6-8', 8, '[{"kind": "barbell"}]'::jsonb, 10, 105, 120, 'reps_weight', true),
('Chest Dip', 'upper', 'push', 'intermediate', 'hypertrophy', 'chest', '{}', 3, '8-12', 8, '[{"kind": "bodyweight"}]'::jsonb, 9, 150, 90, 'reps_weight', false),
('Cable Chest Fly', 'upper', 'push', 'beginner', 'hypertrophy', 'chest', '{}', 3, '10-15', 7, '[{"kind": "machine", "machineType": "cable"}]'::jsonb, 8, 30, 75, 'reps_weight', false),
('Pec Deck Fly', 'upper', 'push', 'beginner', 'hypertrophy', 'chest', '{}', 3, '10-15', 7, '[{"kind": "machine"}]'::jsonb, 8, 70, 75, 'reps_weight', false),
('Floor Press', 'upper', 'push', 'beginner', 'strength', 'chest', '{}', 3, '6-10', 7, '[{"kind": "dumbbell"}, {"kind": "barbell"}]'::jsonb, 9, 85, 90, 'reps_weight', true),
('Dumbbell Row', 'upper', 'pull', 'intermediate', 'hypertrophy', 'back', '{}', 3, '8-12', 7, '[{"kind": "dumbbell"}]'::jsonb, 10, 25, 90, 'reps_weight', false),
('Overhead Press', 'upper', 'push', 'intermediate', 'strength', 'shoulders', '{}', 3, '6-10', 8, '[{"kind": "barbell"}, {"kind": "dumbbell"}]'::jsonb, 10, 75, 120, 'reps_weight', true),
('Walking Lunge', 'lower', 'squat', 'intermediate', 'hypertrophy', 'quads', '{}', 3, '10-12', 7, '[{"kind": "dumbbell"}, {"kind": "bodyweight"}]'::jsonb, 9, 20, 75, 'reps_weight', false),
('Dumbbell Biceps Curl', 'upper', 'pull', 'beginner', 'hypertrophy', 'biceps', '{}', 3, '10-12', 7, '[{"kind": "dumbbell"}, {"kind": "band"}]'::jsonb, 8, 20, 60, 'reps_weight', false),
('Hammer Curl', 'upper', 'pull', 'intermediate', 'hypertrophy', 'biceps', '{}', 3, '8-12', 7, '[{"kind": "dumbbell"}, {"kind": "kettlebell"}]'::jsonb, 8, 25, 75, 'reps_weight', false),
('Barbell Curl', 'upper', 'pull', 'intermediate', 'strength', 'biceps', '{}', 4, '6-8', 8, '[{"kind": "barbell"}]'::jsonb, 9, 65, 90, 'reps_weight', false),
('Alternating Dumbbell Curl', 'upper', 'pull', 'beginner', 'strength', 'biceps', '{}', 3, '6-10', 8, '[{"kind": "dumbbell"}]'::jsonb, 8, 20, 75, 'reps_weight', false),
('Concentration Curl', 'upper', 'pull', 'beginner', 'hypertrophy', 'biceps', '{}', 3, '10-12', 7, '[{"kind": "dumbbell"}]'::jsonb, 8, 15, 60, 'reps_weight', false),
('Zottman Curl', 'upper', 'pull', 'intermediate', 'hypertrophy', 'biceps', '{}', 3, '8-12', 7, '[{"kind": "dumbbell"}]'::jsonb, 8, 20, 75, 'reps_weight', false),
('Reverse Curl', 'upper', 'pull', 'intermediate', 'strength', 'biceps', '{}', 3, '6-10', 8, '[{"kind": "barbell"}, {"kind": "dumbbell"}]'::jsonb, 8, 55, 90, 'reps_weight', false),
('Cable Biceps Curl', 'upper', 'pull', 'intermediate', 'strength', 'biceps', '{}', 3, '6-10', 8, '[{"kind": "machine", "machineType": "cable"}]'::jsonb, 8, 50, 75, 'reps_weight', false),
('Cable Rope Hammer Curl', 'upper', 'pull', 'intermediate', 'hypertrophy', 'biceps', '{}', 3, '8-12', 7, '[{"kind": "machine", "machineType": "cable"}]'::jsonb, 8, 45, 75, 'reps_weight', false),
('Band Biceps Curl', 'upper', 'pull', 'beginner', 'strength', 'biceps', '{}', 3, '8-12', 7, '[{"kind": "band"}]'::jsonb, 7, 20, 60, 'reps_weight', false),
('Kettlebell Curl', 'upper', 'pull', 'beginner', 'hypertrophy', 'biceps', '{}', 3, '10-12', 7, '[{"kind": "kettlebell"}]'::jsonb, 8, 25, 60, 'reps_weight', false),
('Drag Curl', 'upper', 'pull', 'intermediate', 'strength', 'biceps', '{}', 3, '6-8', 8, '[{"kind": "barbell"}]'::jsonb, 8, 60, 90, 'reps_weight', false),
('Overhead Triceps Extension', 'upper', 'push', 'beginner', 'hypertrophy', 'triceps', '{}', 3, '10-12', 7, '[{"kind": "dumbbell"}, {"kind": "band"}]'::jsonb, 8, 20, 60, 'reps_weight', false),
('Triceps Rope Pushdown', 'upper', 'push', 'intermediate', 'hypertrophy', 'triceps', '{}', 3, '10-12', 7, '[{"kind": "machine", "machineType": "cable"}]'::jsonb, 8, 40, 60, 'reps_weight', false),
('Incline Dumbbell Press', 'upper', 'push', 'intermediate', 'hypertrophy', 'chest', '{}', 3, '8-12', 7, '[{"kind": "dumbbell"}]'::jsonb, 9, 25, 90, 'reps_weight', false),
('Lat Pulldown', 'upper', 'pull', 'beginner', 'hypertrophy', 'back', '{}', 3, '8-12', 7, '[{"kind": "machine", "machineType": "cable"}]'::jsonb, 9, 70, 90, 'reps_weight', false),
('Resistance Band Pull-Apart', 'upper', 'pull', 'beginner', 'hypertrophy', 'shoulders', '{}', 3, '12-15', 6, '[{"kind": "band"}]'::jsonb, 6, 20, 60, 'reps_weight', false),
('Leg Press', 'lower', 'squat', 'intermediate', 'hypertrophy', 'quads', '{}', 3, '10-12', 7, '[{"kind": "machine", "machineType": "leg_press"}]'::jsonb, 10, 160, 90, 'reps_weight', false),
('Kettlebell Swing', 'lower', 'hinge', 'intermediate', 'endurance', 'glutes', '{}', 4, '12-15', 8, '[{"kind": "kettlebell"}]'::jsonb, 8, 35, 75, 'reps_weight', false),

-- Duration / Bodyweight
('Plank Series', 'core', 'core', 'beginner', 'endurance', 'core', '{}', 3, '30-45 sec', 7, '[{"kind": "bodyweight"}]'::jsonb, 6, null, 60, 'duration', false),
('Dead Bug', 'core', 'core', 'beginner', 'endurance', 'core', '{}', 3, '8-12', 6, '[{"kind": "bodyweight"}]'::jsonb, 6, 10, 60, 'reps_only', false),

-- Cardio
('Skipping', 'cardio', 'cardio', 'beginner', 'cardio', 'cardio', '{}', 6, '45 sec on/15 sec off', 7, '[{"kind": "bodyweight"}]'::jsonb, 10, null, 45, 'distance_duration', false),
('Indoor Ride', 'cardio', 'cardio', 'beginner', 'cardio', 'cardio', '{}', 1, '20-30 min', 6, '[{"kind": "machine"}]'::jsonb, 20, null, 60, 'distance_duration', false),
('Outdoor Ride', 'cardio', 'cardio', 'intermediate', 'cardio', 'cardio', '{}', 1, '30-45 min', 6, '[{"kind": "bodyweight"}]'::jsonb, 30, null, 60, 'distance_duration', false),

-- Yoga / Mobility
('Yoga', 'mobility', 'core', 'beginner', 'general_fitness', 'yoga', '{}', 1, '15-20 min', 5, '[{"kind": "bodyweight"}]'::jsonb, 15, null, 45, 'duration', false),
('Stretching', 'mobility', 'core', 'beginner', 'general_fitness', 'full_body', '{}', 1, '10-15 min', 3, '[{"kind": "bodyweight"}]'::jsonb, 10, null, 30, 'duration', false);