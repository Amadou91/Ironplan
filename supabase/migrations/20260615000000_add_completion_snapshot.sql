-- Add completion_snapshot to store all mutable user data at session completion time.
-- This ensures historical sessions are fully immutable and never affected by 
-- subsequent changes to user profiles, preferences, or calculation logic.

-- The snapshot captures:
-- - body_weight_lb: User's weight at completion (already exists as column, included for completeness)
-- - preferences: User preferences snapshot (units, RPE baselines, etc.)
-- - equipment_inventory: Equipment available at time of session
-- - e1rm_formula_version: Algorithm version used for E1RM calculations
-- - computed_metrics: Pre-calculated session metrics that should never change

alter table public.sessions
  add column if not exists completion_snapshot jsonb;

-- Add comment for documentation
comment on column public.sessions.completion_snapshot is 
  'Immutable snapshot of user data and computed metrics at session completion. Contains: preferences, equipment_inventory, e1rm_formula_version, computed_metrics. Ensures historical sessions are never affected by profile or algorithm changes.';

-- Create an index for potential future queries on snapshot fields
create index if not exists sessions_completion_snapshot_idx
  on public.sessions using gin (completion_snapshot jsonb_path_ops)
  where status = 'completed';
