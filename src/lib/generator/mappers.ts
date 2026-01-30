import type { 
  Exercise, 
  EquipmentOption, 
  EquipmentOrGroup,
  EquipmentRequirementMode,
  AdditionalEquipmentMode,
  ExerciseCategory, 
  FocusArea, 
  MetricProfile, 
  MovementPattern 
} from '@/types/domain'

type ExerciseRow = {
  id: string;
  name: string;
  category: string;
  focus: string | null;
  metric_profile: string | null;
  equipment: EquipmentOption[];
  movement_pattern: string | null;
  primary_muscle: string | null;
  secondary_muscles: string[];
  e1rm_eligible: boolean | null;
  is_interval: boolean;
  or_group?: string | null;
  equipment_mode?: string | null;
  additional_equipment_mode?: string | null;
};

function inferCategory(row: ExerciseRow): ExerciseCategory {
  // Respect explicit category override first
  if (row.category && ['Strength', 'Cardio', 'Mobility'].includes(row.category)) {
    return row.category as ExerciseCategory
  }

  const indicators = [
    row.name,
    row.focus,
    row.metric_profile,
    row.primary_muscle,
  ].map(s => s?.toLowerCase() || '')

  if (indicators.some(s => s.includes('yoga') || s.includes('mobility') || s.includes('stretch'))) return 'Mobility'
  if (indicators.some(s => s.includes('cardio'))) return 'Cardio'
  
  return 'Strength'
}

export function mapCatalogRowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: inferCategory(row),
    focus: (row.focus || 'full_body') as FocusArea,
    metricProfile: (row.metric_profile || 'reps_weight') as MetricProfile,
    equipment: row.equipment,
    orGroup: row.or_group as EquipmentOrGroup | undefined,
    equipmentMode: (row.equipment_mode as EquipmentRequirementMode) ?? 'or',
    additionalEquipmentMode: (row.additional_equipment_mode as AdditionalEquipmentMode) ?? 'required',
    movementPattern: row.movement_pattern as MovementPattern | undefined,
    primaryMuscle: row.primary_muscle || 'full_body',
    secondaryMuscles: row.secondary_muscles,
    e1rmEligible: row.e1rm_eligible ?? false,
    secondaryBodyParts: [],
    primaryBodyParts: [],
    isInterval: row.is_interval
  }
}
