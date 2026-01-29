-- Fix Outdoor Ride exercise to require outdoor_bicycle equipment instead of bodyweight
update public.exercise_catalog
set equipment = '[{"kind": "machine", "machineType": "outdoor_bicycle"}]'::jsonb
where name = 'Outdoor Ride';
