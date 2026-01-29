-- Add Bench Press equipment requirements and backfill inventory defaults.

-- Ensure equipment is jsonb (fix for schema mismatch where baseline created it as text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'exercise_catalog' 
    AND column_name = 'equipment' 
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.exercise_catalog 
    ALTER COLUMN equipment TYPE jsonb 
    USING CASE WHEN equipment IS NULL OR equipment = '' THEN '[]'::jsonb ELSE equipment::jsonb END;
    
    -- Also set default to '[]'::jsonb
    ALTER TABLE public.exercise_catalog ALTER COLUMN equipment SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 1) Update bench-dependent exercises to require Bench Press equipment.
update public.exercise_catalog
set equipment = (
  select jsonb_agg(
    case
      when (option->>'kind') in ('barbell', 'dumbbell') then
        case
          when option ? 'requires' then option
          else option || jsonb_build_object('requires', to_jsonb(array['bench_press']))
        end
      else option
    end
  )
  from jsonb_array_elements(equipment) as option
)
where name in (
  'Bench Press',
  'Dumbbell Bench Press',
  'Incline Barbell Press',
  'Decline Bench Press',
  'Incline Dumbbell Press'
);

-- 2) Ensure workout template inventories include benchPress (default false when missing).
update public.workout_templates
set equipment = jsonb_set(
  coalesce(equipment, '{}'::jsonb),
  '{inventory,benchPress}',
  'false'::jsonb,
  true
)
where (equipment->'inventory'->>'benchPress') is null;

update public.workout_templates
set template_inputs = jsonb_set(
  coalesce(template_inputs, '{}'::jsonb),
  '{equipment,inventory,benchPress}',
  'false'::jsonb,
  true
)
where (template_inputs->'equipment'->'inventory'->>'benchPress') is null;
