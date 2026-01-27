import type { Exercise, EquipmentOption, ExerciseCategory } from '@/types/domain'

function inferCategory(row: any): ExerciseCategory {
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

export function mapCatalogRowToExercise(row: any): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: inferCategory(row),
    focus: row.focus,
    metricProfile: row.metric_profile,
    sets: row.sets,
    reps: row.reps,
    rpe: row.rpe,
    equipment: row.equipment as EquipmentOption[],
    movementPattern: row.movement_pattern,
    difficulty: row.difficulty,
    eligibleGoals: row.eligible_goals || [],
    goal: row.goal,
    durationMinutes: row.duration_minutes,
    restSeconds: row.rest_seconds,
    loadTarget: row.load_target,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    e1rmEligible: row.e1rm_eligible,
    secondaryBodyParts: [],
    primaryBodyParts: [],
    instructions: row.instructions || [],
    videoUrl: row.video_url,
    isInterval: row.is_interval,
    intervalDuration: row.interval_duration,
    intervalRest: row.interval_rest
  }
}
