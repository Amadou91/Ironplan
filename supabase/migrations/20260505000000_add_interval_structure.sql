-- Add interval structure to exercise_catalog
alter table public.exercise_catalog
add column if not exists is_interval boolean not null default false,
add column if not exists interval_duration int, -- Seconds ON
add column if not exists interval_rest int;    -- Seconds OFF (Rest between intervals)

-- No complex round structure for now as requested "rounds_count" was optional/secondary 
-- and "rest between rounds" is rare. We can treat 'sets' as total intervals for simple cases.
