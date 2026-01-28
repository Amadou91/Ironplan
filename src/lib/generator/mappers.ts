import type { 
  Exercise, 
  EquipmentOption, 
  ExerciseCategory, 
  FocusArea, 
  MetricProfile, 
  MovementPattern 
} from '@/types/domain'

type ExerciseRow = {
  id: string;
  name: string;
  category: string;
  focus: string;
  metric_profile: string;
  equipment: EquipmentOption[];
  movement_pattern: string;
  primary_muscle: string;
  secondary_muscles: string[];
  e1rm_eligible: boolean;
  is_interval: boolean;
};

function inferCategory(row: ExerciseRow): ExerciseCategory {
  const indicators = [
    row.name,
    row.focus,
    row.metric_profile,
    row.primary_muscle,
  ].map(s => s?.toLowerCase() || '')

  if (indicators.some(s => s.includes('yoga') || s.includes('mobility') || s.includes('stretch'))) return 'Mobility'
  if (indicators.some(s => s.includes('cardio'))) return 'Cardio'

  if (row.category && ['Strength', 'Cardio', 'Mobility'].includes(row.category)) {
    return row.category as ExerciseCategory
  }
  
  return 'Strength'
}

export function mapCatalogRowToExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: inferCategory(row),
    focus: row.focus as FocusArea,
    metricProfile: row.metric_profile as MetricProfile,
    equipment: row.equipment,
    movementPattern: row.movement_pattern as MovementPattern,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    e1rmEligible: row.e1rm_eligible,
    secondaryBodyParts: [],
    primaryBodyParts: [],
    isInterval: row.is_interval
  }
}
