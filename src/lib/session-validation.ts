/**
 * Session validation utilities.
 * Ensures all required fields are completed before a workout can be saved.
 */

import type { WorkoutSession, WorkoutSet, MetricProfile } from '@/types/domain'

export type SetValidationError = {
  exerciseIndex: number
  exerciseName: string
  setNumber: number
  missingFields: string[]
}

export type SessionValidationResult = {
  isValid: boolean
  errors: SetValidationError[]
  hasNoCompletedSets: boolean
}

/**
 * Gets the required fields for a set based on its metric profile.
 * Returns field names that must have valid values.
 */
function getRequiredFieldsForProfile(
  profile: MetricProfile | undefined
): { field: keyof WorkoutSet; label: string }[] {
  switch (profile) {
    case 'cardio_session':
      // Cardio requires duration
      return [{ field: 'durationSeconds', label: 'Duration' }]
    case 'mobility_session':
      // Mobility requires duration
      return [{ field: 'durationSeconds', label: 'Duration' }]
    case 'duration':
      // Duration-based exercises require duration
      return [{ field: 'durationSeconds', label: 'Duration' }]
    case 'timed_strength':
      // Timed strength requires duration and weight
      return [
        { field: 'durationSeconds', label: 'Duration' },
        { field: 'weight', label: 'Weight' }
      ]
    case 'reps_only':
      // Reps-only exercises require reps
      return [{ field: 'reps', label: 'Reps' }]
    case 'reps_weight':
    default:
      // Standard strength exercises require reps and weight
      return [
        { field: 'reps', label: 'Reps' },
        { field: 'weight', label: 'Weight' }
      ]
  }
}

/**
 * Checks if a set field has a valid value (not empty, null, or undefined).
 */
function isFieldValid(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'number') return !isNaN(value) && value >= 0
  return true
}

/**
 * Validates a single set against its required fields.
 * Only validates sets that are marked as completed.
 */
function validateSet(
  set: WorkoutSet,
  metricProfile: MetricProfile | undefined
): string[] {
  // Only validate completed sets - uncompleted sets are allowed to be incomplete
  if (!set.completed) return []

  const requiredFields = getRequiredFieldsForProfile(metricProfile)
  const missingFields: string[] = []

  for (const { field, label } of requiredFields) {
    if (!isFieldValid(set[field])) {
      missingFields.push(label)
    }
  }

  return missingFields
}

/**
 * Validates an entire session for completion.
 * Checks that all completed sets have their required fields filled in.
 * Returns validation errors if any required fields are missing.
 */
export function validateSessionForCompletion(
  session: WorkoutSession | null | undefined
): SessionValidationResult {
  if (!session) {
    return {
      isValid: false,
      errors: [],
      hasNoCompletedSets: true
    }
  }

  const errors: SetValidationError[] = []
  let totalCompletedSets = 0

  session.exercises.forEach((exercise, exerciseIndex) => {
    exercise.sets.forEach((set) => {
      if (set.completed) {
        totalCompletedSets++
        const missingFields = validateSet(set, exercise.metricProfile)
        if (missingFields.length > 0) {
          errors.push({
            exerciseIndex,
            exerciseName: exercise.name,
            setNumber: set.setNumber,
            missingFields
          })
        }
      }
    })
  })

  return {
    isValid: errors.length === 0 && totalCompletedSets > 0,
    errors,
    hasNoCompletedSets: totalCompletedSets === 0
  }
}

/**
 * Formats validation errors into a human-readable message.
 */
export function formatValidationErrors(errors: SetValidationError[]): string {
  if (errors.length === 0) return ''

  // Group errors by exercise
  const byExercise = new Map<string, SetValidationError[]>()
  for (const error of errors) {
    const existing = byExercise.get(error.exerciseName) ?? []
    existing.push(error)
    byExercise.set(error.exerciseName, existing)
  }

  const lines: string[] = []
  for (const [exerciseName, exerciseErrors] of byExercise) {
    const setDetails = exerciseErrors
      .map((e) => `Set ${e.setNumber}: ${e.missingFields.join(', ')}`)
      .join('; ')
    lines.push(`${exerciseName} — ${setDetails}`)
  }

  return lines.join('\n')
}
