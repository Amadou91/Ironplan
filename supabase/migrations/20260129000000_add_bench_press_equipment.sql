-- Add Bench Press equipment requirements and backfill inventory defaults.

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
