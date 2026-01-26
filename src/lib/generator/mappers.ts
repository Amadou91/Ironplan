import type { Exercise, EquipmentOption } from '@/types/domain'

export function mapCatalogRowToExercise(row: any): Exercise {
  return {
    id: row.id,
    name: row.name,
    focus: row.focus,
    metricProfile: row.metric_profile,
    sets: row.sets,
    reps: row.reps,
    rpe: row.rpe,
    equipment: row.equipment as EquipmentOption[],
    movementPattern: row.movement_pattern,
    difficulty: row.difficulty,
    goal: row.goal,
    durationMinutes: row.duration_minutes,
    restSeconds: row.rest_seconds,
    loadTarget: row.load_target,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    e1rmEligible: row.e1rm_eligible,
    secondaryBodyParts: [],
    primaryBodyParts: [],
    instructions: [],
    videoUrl: undefined
  }
}
