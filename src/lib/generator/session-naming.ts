/**
 * Session and workout naming utilities.
 * Handles display name generation for workouts and exercises.
 */

import type { Exercise, FocusArea, Goal, PlanInput } from '@/types/domain'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'

/**
 * Formats a focus area for display.
 */
export const formatFocusLabel = (focus: FocusArea): string => {
  const map: Record<string, string> = {
    upper: 'Upper Body',
    lower: 'Lower Body',
    full_body: 'Full Body',
    core: 'Core',
    cardio: 'Conditioning',
    mobility: 'Yoga / Mobility',
    arms: 'Arms',
    legs: 'Legs',
    biceps: 'Biceps',
    triceps: 'Triceps',
    chest: 'Chest',
    back: 'Back'
  }
  return map[focus] ?? focus.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Formats a goal for display.
 */
export const formatGoalLabel = (goal: Goal | string): string => {
  const map: Record<string, string> = {
    range_of_motion: 'Mobility & Flexibility',
    hypertrophy: 'Muscle Growth',
    strength: 'Strength',
    endurance: 'Endurance',
    cardio: 'Conditioning'
  }
  return map[goal] ?? goal.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Builds a session name based on focus, exercises, and goal.
 */
export const buildSessionName = (
  focus: FocusArea,
  exercises: Exercise[],
  goal: Goal
): string => {
  const goalLabel = formatGoalLabel(goal)
  const focusLabel = formatFocusLabel(focus)
  const movementCounts = exercises.reduce<Record<string, number>>((acc, exercise) => {
    if (exercise.movementPattern) {
      acc[exercise.movementPattern] = (acc[exercise.movementPattern] ?? 0) + 1
    }
    return acc
  }, {})

  // Special cases for distinct naming
  if (focus === 'mobility' || goal === 'range_of_motion') {
    return 'Yoga / Mobility Flow'
  }

  if (focus === 'cardio' || goal === 'endurance' || goal === 'cardio') {
    return 'Conditioning Circuit'
  }

  if (focus === 'upper') {
    const pushCount = movementCounts.push ?? 0
    const pullCount = movementCounts.pull ?? 0
    if (pushCount > pullCount) return 'Upper Body - Push Focus'
    if (pullCount > pushCount) return 'Upper Body - Pull Focus'
    return `Upper Body - ${goalLabel}`
  }

  if (focus === 'lower') {
    const squatCount = movementCounts.squat ?? 0
    const hingeCount = movementCounts.hinge ?? 0
    if (squatCount > hingeCount) return 'Lower Body - Squat Focus'
    if (hingeCount > squatCount) return 'Lower Body - Hinge Focus'
    return `Lower Body - ${goalLabel}`
  }

  if (focus === 'full_body') {
    return `Full Body - ${goalLabel}`
  }

  if (focus === 'core') {
    return 'Core - Stability Focus'
  }

  // Prevent redundant labels like "Chest Chest"
  if (focusLabel.toLowerCase().includes(goalLabel.toLowerCase())) {
    return focusLabel
  }

  return `${focusLabel} - ${goalLabel}`
}

/**
 * Builds a plan title with focus, goal, and optional details.
 */
export const buildPlanTitle = (
  focus: FocusArea,
  goal: Goal,
  intensity?: PlanInput['intensity'],
  minutes?: number
): string =>
  buildWorkoutDisplayName({
    focus,
    style: goal,
    intensity,
    minutes,
    fallback: formatFocusLabel(focus)
  })

/**
 * Builds a rationale description for a session.
 */
export const buildRationale = (
  focus: FocusArea,
  duration: number,
  restPreference: PlanInput['preferences']['restPreference'],
  style: Goal
): string => {
  const recoveryNote =
    restPreference === 'high_recovery'
      ? 'Extra recovery was prioritized between sessions.'
      : restPreference === 'minimal_rest'
        ? 'Sessions are designed for minimal rest between workouts.'
        : 'Recovery is balanced across the rotation.'
  const goalLabel = formatGoalLabel(style)
  const focusLabel = formatFocusLabel(focus)

  return `${duration} minute ${goalLabel} session focused on ${focusLabel}. ${recoveryNote}`
}
