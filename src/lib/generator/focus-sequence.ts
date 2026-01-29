/**
 * Focus sequence and workout planning utilities.
 * Handles session distribution and focus area sequencing.
 */

import type { FocusArea, Goal, GoalPriority, PlanInput, PlanDay } from '@/types/domain'

/**
 * Builds focus distribution from a schedule.
 */
export const buildFocusDistribution = (schedule: PlanDay[]): Record<FocusArea, number> =>
  schedule.reduce<Record<FocusArea, number>>(
    (acc, day) => {
      acc[day.focus] = (acc[day.focus] ?? 0) + 1
      return acc
    },
    {
      upper: 0,
      lower: 0,
      full_body: 0,
      core: 0,
      cardio: 0,
      mobility: 0,
      arms: 0,
      legs: 0,
      biceps: 0,
      triceps: 0,
      chest: 0,
      back: 0,
      shoulders: 0
    }
  )

/**
 * Maps a goal to appropriate focus areas.
 */
export const goalToFocus = (goal: Goal): FocusArea[] => {
  switch (goal) {
    case 'endurance':
    case 'cardio':
      return ['cardio', 'full_body', 'mobility']
    case 'hypertrophy':
      return ['upper', 'lower', 'full_body']
    case 'general_fitness':
      return ['full_body', 'cardio', 'mobility']
    default:
      return ['upper', 'lower', 'core']
  }
}

/**
 * Merges focus areas by priority.
 */
export const mergeFocusByPriority = (
  primary: FocusArea[],
  secondary: FocusArea[] | undefined,
  priority: GoalPriority
): FocusArea[] => {
  if (!secondary || priority === 'primary') {
    return primary
  }

  if (priority === 'secondary') {
    return [...secondary, ...secondary, ...primary]
  }

  return primary.flatMap((focus, index) => [focus, secondary[index % secondary.length]])
}

/**
 * Builds a focus area sequence for multiple sessions.
 */
export const buildFocusSequence = (
  sessions: number,
  preferences: PlanInput['preferences'],
  goals: PlanInput['goals']
): FocusArea[] => {
  const preferencePool = preferences.focusAreas.length > 0 ? preferences.focusAreas : undefined
  const primaryPool = preferencePool ?? goalToFocus(goals.primary)
  const secondaryPool = goals.secondary ? goalToFocus(goals.secondary) : undefined
  const focusPool = preferencePool ?? mergeFocusByPriority(primaryPool, secondaryPool, goals.priority)

  const sequence: FocusArea[] = []
  for (let i = 0; i < sessions; i += 1) {
    sequence.push(focusPool[i % focusPool.length])
  }
  return sequence
}
