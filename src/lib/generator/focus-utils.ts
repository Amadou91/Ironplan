/**
 * Focus area matching and constraint utilities.
 * Handles body-part targeting and muscle group filtering.
 */

import type { Exercise, FocusArea } from '@/types/domain'
import { focusMuscleMap, focusAccessoryMap } from '@/lib/generator/constants'
import type { FocusConstraint } from '@/lib/generator/types'

/**
 * Gets the primary muscle key from an exercise (lowercase).
 */
export const getPrimaryMuscleKey = (exercise: Exercise): string =>
  String(exercise.primaryMuscle ?? '').trim().toLowerCase()

/**
 * Gets the display label for primary muscle.
 */
export const getPrimaryMuscleLabel = (exercise: Exercise): string => {
  if (exercise.primaryBodyParts?.length) return exercise.primaryBodyParts[0]
  if (typeof exercise.primaryMuscle === 'string') return exercise.primaryMuscle
  return ''
}

/**
 * Checks if exercise targets any of the specified muscles.
 */
export const matchesPrimaryMuscle = (exercise: Exercise, muscles: string[]): boolean => {
  const primary = getPrimaryMuscleLabel(exercise).toLowerCase()
  return muscles.some((muscle) => primary.includes(muscle.toLowerCase()))
}

/**
 * Core filtering logic for body-part focused sessions.
 * - 'full_body' sessions include all exercises.
 * - Targeted sessions (e.g., 'chest') check against the exercise's primary muscle mapping.
 * - 'cardio' focus strictly uses the 'focus' field from the catalog.
 */
export const matchesFocusArea = (focus: FocusArea, exercise: Exercise): boolean => {
  if (focus === 'full_body') return true
  if (focus === 'cardio') return exercise.focus === 'cardio'
  const focusConfig = focusMuscleMap[focus]
  if (focusConfig?.primaryMuscles?.length) {
    const matchesMuscle = matchesPrimaryMuscle(exercise, focusConfig.primaryMuscles)
    const matchesBase = focusConfig.baseFocus ? exercise.focus === focusConfig.baseFocus : true
    return matchesMuscle && matchesBase
  }
  return exercise.focus === focus
}

/**
 * Gets focus constraint configuration for a focus area.
 */
export const getFocusConstraint = (focus: FocusArea): FocusConstraint | null => {
  const focusConfig = focusMuscleMap[focus]
  if (!focusConfig?.primaryMuscles?.length) return null
  return {
    focus,
    primaryMuscles: focusConfig.primaryMuscles,
    accessoryMuscles: focusAccessoryMap[focus] ?? [],
    minPrimarySetRatio: 0.75
  }
}
