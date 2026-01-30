-- Migration: Add equipment mode columns for explicit OR/AND equipment logic
-- Date: 2026-01-29

-- Add equipment_mode column for free-weight equipment logic
-- 'or' (default): Any selected free-weight equipment satisfies the requirement
-- 'and': All selected free-weight equipment must be available
ALTER TABLE exercise_catalog 
ADD COLUMN IF NOT EXISTS equipment_mode text DEFAULT 'or';

-- Add additional_equipment_mode column for bench/machine equipment logic  
-- 'required' (default): Must be available for exercise to be selected
-- 'optional': Preferred but not required (soft requirement)
ALTER TABLE exercise_catalog 
ADD COLUMN IF NOT EXISTS additional_equipment_mode text DEFAULT 'required';

-- Add constraints to ensure valid values
ALTER TABLE exercise_catalog 
ADD CONSTRAINT equipment_mode_check 
CHECK (equipment_mode IN ('or', 'and'));

ALTER TABLE exercise_catalog 
ADD CONSTRAINT additional_equipment_mode_check 
CHECK (additional_equipment_mode IN ('required', 'optional'));

-- Comment for documentation
COMMENT ON COLUMN exercise_catalog.equipment_mode IS 
'Determines how free-weight equipment (bodyweight, barbell, dumbbell, kettlebell, band) is evaluated: "or" = any one satisfies, "and" = all required';

COMMENT ON COLUMN exercise_catalog.additional_equipment_mode IS 
'Determines if bench/machine equipment is required or optional: "required" = must be available (AND logic), "optional" = preferred only (soft requirement)';
