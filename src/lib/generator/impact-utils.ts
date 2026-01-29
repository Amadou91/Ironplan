/**
 * Workout impact calculation utilities.
 * Handles workload scoring and impact metrics.
 */

import type { Exercise, PlanDay, WorkoutImpact } from '@/types/domain'
import { computeExerciseMetrics } from '@/lib/workout-metrics'
import { estimateExerciseMinutes } from './timing-utils'

/**
 * Calculates the total impact of a set of exercises.
 */
export const calculateExerciseImpact = (exercises: Exercise[]): WorkoutImpact => {
  let totalWorkload = 0
  let totalVolume = 0
  let totalDuration = 0
  let totalIntensity = 0

  exercises.forEach((exercise) => {
    const metrics = computeExerciseMetrics(exercise)
    totalWorkload += metrics.workload
    totalVolume += metrics.volume ?? 0
    totalIntensity += metrics.intensity ?? 0

    // Estimate duration for density calc
    const loadTarget = exercise.loadTarget
    const load = loadTarget !== undefined 
      ? { value: loadTarget, unit: 'lb' as const, label: `${loadTarget} lb` }
      : undefined
    const estimatedMinutes = estimateExerciseMinutes(
      exercise,
      {
        sets: exercise.sets ?? 3,
        reps: exercise.reps ?? '8-12',
        rpe: exercise.rpe ?? 7,
        restSeconds: exercise.restSeconds ?? 60,
        load
      },
      undefined,
      undefined
    )
    totalDuration += estimatedMinutes
  })

  // Normalized scoring matching `workout-metrics.ts`
  // Score = Workload / 10
  const score = Math.round(totalWorkload / 10)

  // Calculate average intensity (RPE)
  const avgIntensity = exercises.length > 0 ? totalIntensity / exercises.length : 0

  // Calculate overall density (Volume KG / Minutes)
  const density = totalDuration > 0 ? totalVolume / totalDuration : 0

  return {
    score,
    breakdown: {
      volume: Math.round(totalVolume),
      intensity: Math.round(avgIntensity * 10), // Scale 0-100
      density: Math.round(density)
    }
  }
}

/**
 * Calculates the total impact of a workout schedule.
 */
export const calculateWorkoutImpact = (schedule: PlanDay[]): WorkoutImpact =>
  calculateExerciseImpact(schedule.flatMap((day) => day.exercises))
