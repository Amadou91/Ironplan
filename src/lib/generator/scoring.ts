import type {
  Exercise,
  Intensity,
  Goal,
  RestPreference,
  PlanInput
} from '@/types/domain'
import { clamp, isCompoundMovement } from './utils'

/**
 * Calculates a score modifier based on the exercise difficulty and user experience.
 * Used during selection to favor exercises that match the user's skill level.
 * 
 * - Beginner: Favors 'beginner' exercises (+2), penalizes 'advanced' (-2).
 * - Advanced: Favors 'advanced' exercises (+2), slight penalty for 'beginner' (-1).
 */
export const getExperienceScore = (exercise: Exercise, experience: PlanInput['experienceLevel']) => {
  if (!exercise.difficulty) return 0
  if (experience === 'beginner') {
    if (exercise.difficulty === 'beginner') return 2
    if (exercise.difficulty === 'intermediate') return 0.5
    return -2
  }
  if (experience === 'advanced') {
    if (exercise.difficulty === 'advanced') return 2
    if (experience === 'advanced' && exercise.difficulty === 'intermediate') return 1
    return -1
  }
  if (exercise.difficulty === 'intermediate') return 1.5
  return 0.5
}

/**
 * Favors compound movements for high intensity sessions and 
 * isolation/lighter movements for low intensity sessions.
 */
export const getIntensityScore = (exercise: Exercise, intensity: Intensity) => {
  if (intensity === 'high') {
    return isCompoundMovement(exercise) ? 2 : 0
  }
  if (intensity === 'low') {
    return isCompoundMovement(exercise) ? -0.5 : 1
  }
  return 0
}

/**
 * Baseline RPE adjustment based on session intensity.
 * Database defaults are treated as 'Moderate' (Intensity) baselines.
 */
export const adjustRpe = (baseRpe: number, intensity: Intensity) => {
  if (intensity === 'low') return clamp(baseRpe - 1, 5, 9)
  if (intensity === 'high') return clamp(baseRpe + 1, 5, 9)
  return baseRpe
}

/**
 * Adjusts set counts based on user experience.
 * More experienced users get higher volume baselines.
 */
export const adjustSets = (baseSets: number, experience: PlanInput['experienceLevel']) => {
  if (experience === 'beginner') return clamp(baseSets - 1, 2, 5)
  if (experience === 'advanced') return clamp(baseSets + 1, 3, 6)
  return baseSets
}

/**
 * Adjusts set counts inversely with intensity to maintain manageable workload.
 * Higher intensity sessions typically have fewer sets per exercise.
 */
export const adjustSetsForIntensity = (sets: number, intensity: Intensity) => {
  if (intensity === 'low') return Math.max(2, sets + 1)
  if (intensity === 'high') return Math.max(2, sets - 1)
  return sets
}

/**
 * Derives rep ranges based on the session goal and intensity.
 * NOTE: This currently overrides the 'reps' field from the exercise catalog,
 * using the catalog value only as an informational baseline for specific exercise types.
 */
export const deriveReps = (goal: Goal, intensity: Intensity) => {
  if (goal === 'strength') return intensity === 'high' ? '3-6' : '4-6'
  if (goal === 'endurance') return intensity === 'high' ? '15-20' : '12-15'
  if (goal === 'range_of_motion' || goal === 'cardio') return null // Use catalog baseline
  return intensity === 'high' ? '8-10' : '8-12'
}

export const getIntensityRestModifier = (intensity: Intensity) => {
  if (intensity === 'low') return 0.85
  if (intensity === 'high') return 1.15
  return 1
}

export const getExerciseCaps = (minutes: number) => {
  if (minutes <= 30) return { min: 3, max: 5 }
  if (minutes <= 45) return { min: 4, max: 6 }
  if (minutes <= 60) return { min: 5, max: 8 }
  if (minutes <= 90) return { min: 6, max: 9 }
  return { min: 6, max: 10 }
}

export const getSetCaps = (minutes: number) => {
  if (minutes <= 30) return { min: 2, max: 4 }
  if (minutes <= 60) return { min: 2, max: 5 }
  return { min: 2, max: 6 }
}

export const getFamilyCaps = (minutes: number) => {
  if (minutes <= 35) return 2
  if (minutes <= 60) return 3
  return 4
}

export const getRestModifier = (minutes: number, preference: RestPreference) => {
  let modifier = minutes <= 30 ? 0.8 : minutes <= 45 ? 0.9 : minutes >= 90 ? 1.1 : 1
  if (preference === 'minimal_rest') modifier -= 0.1
  if (preference === 'high_recovery') modifier += 0.1
  return clamp(modifier, 0.7, 1.3)
}
