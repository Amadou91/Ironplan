/**
 * Movement pattern analysis utilities.
 * Handles exercise classification and compound movement detection.
 */

import type { Exercise, MovementPattern } from '@/types/domain'

/**
 * Normalizes an exercise name to a key format.
 */
export const normalizeExerciseKey = (name: string): string => name.trim().toLowerCase()

/**
 * Determines the movement "family" for variety scoring.
 * Prevents the generator from picking too many similar movements (e.g., multiple "press" exercises)
 * in a single session or consecutively.
 * 
 * Uses 'movementPattern' from the catalog as a fallback, but applies string-based 
 * heuristics for more granular categorization.
 */
export const getMovementFamilyFromName = (
  name: string,
  movementPattern?: MovementPattern | null
): string => {
  const lower = name.toLowerCase()
  if (lower.includes('press') || lower.includes('push-up') || lower.includes('pushup')) return 'press'
  if (lower.includes('fly') || lower.includes('pec deck')) return 'fly'
  if (lower.includes('dip')) return 'dip'
  if (lower.includes('row')) return 'row'
  if (lower.includes('pull')) return 'pull'
  if (lower.includes('curl')) return 'curl'
  if (lower.includes('extension')) return 'extension'
  if (lower.includes('raise') || lower.includes('lateral')) return 'raise'
  if (lower.includes('squat')) return 'squat'
  if (lower.includes('deadlift') || lower.includes('rdl') || lower.includes('hinge')) return 'hinge'
  if (lower.includes('lunge') || lower.includes('split squat')) return 'lunge'
  if (lower.includes('carry')) return 'carry'
  if (lower.includes('plank') || lower.includes('core')) return 'core'
  if (lower.includes('run') || lower.includes('bike') || lower.includes('rower') || lower.includes('interval')) {
    return 'cardio'
  }
  return movementPattern ?? 'other'
}

/**
 * Gets the movement family for an exercise.
 */
export const getMovementFamily = (exercise: Exercise): string =>
  getMovementFamilyFromName(exercise.name, exercise.movementPattern)

/**
 * Identifies compound movements for intensity-based scoring.
 * Based on the 'movementPattern' field in the exercise catalog.
 */
export const isCompoundMovement = (exercise: Exercise): boolean =>
  ['squat', 'hinge', 'push', 'pull', 'carry'].includes(exercise.movementPattern ?? '')
