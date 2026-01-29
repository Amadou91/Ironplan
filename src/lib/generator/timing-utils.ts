/**
 * Exercise timing estimation utilities.
 * Handles duration calculations for exercises and workouts.
 */

import type { Exercise, EquipmentOption, Goal } from '@/types/domain'
import type { ExercisePrescription } from './types'

/**
 * Gets setup time in minutes for an equipment type.
 */
export const getSetupMinutes = (option?: EquipmentOption | null): number => {
  switch (option?.kind) {
    case 'bodyweight':
      return 1
    case 'bench_press':
    case 'dumbbell':
    case 'kettlebell':
    case 'band':
      return 2
    case 'barbell':
    case 'machine':
      return 3
    default:
      return 2
  }
}

/**
 * Gets work time in seconds based on goal and exercise type.
 */
export const getWorkSeconds = (goal: Goal, exercise: Exercise): number => {
  if (exercise.focus === 'cardio' || exercise.movementPattern === 'cardio') return 60
  if (goal === 'strength') return 50
  if (goal === 'endurance' || goal === 'cardio') return 60
  return 45
}

/**
 * Estimates total time for an exercise in minutes.
 */
export const estimateExerciseMinutes = (
  exercise: Exercise,
  prescription: ExercisePrescription,
  option?: EquipmentOption | null,
  goal?: Goal
): number => {
  const setupMinutes = getSetupMinutes(option)
  const workSeconds = getWorkSeconds(goal ?? 'general_fitness', exercise)
  // Robustly handle undefined restSeconds by defaulting to 90s (typical rest)
  const restSeconds = prescription.restSeconds ?? 90
  const workMinutes = (prescription.sets * (workSeconds + restSeconds)) / 60
  const fallbackPerSet = exercise.durationMinutes
    ? exercise.durationMinutes / Math.max(exercise.sets, 1)
    : null
  const fallbackMinutes = fallbackPerSet ? setupMinutes + prescription.sets * fallbackPerSet : 0
  const estimated = setupMinutes + workMinutes
  return Math.max(1, Math.round(Math.max(estimated, fallbackMinutes) * 10) / 10)
}
