import type {
  Exercise,
  Intensity,
  Goal,
  RestPreference,
  PlanInput
} from '@/types/domain'
import { clamp, isCompoundMovement } from '@/lib/generator/utils'

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
 * Adjusts set counts based on intensity to maintain volume load.
 * High intensity lowers reps, so we keep sets standard or higher to compensate.
 * This prevents volume load from crashing when intensity is high.
 */
export const adjustSetsForIntensity = (sets: number, intensity: Intensity) => {
  if (intensity === 'low') return Math.max(2, sets + 1)
  // Fix: High intensity should NOT reduce sets, as reps are already lower.
  // Keeping sets standard or higher compensates for reduced reps.
  if (intensity === 'high') return sets // Keep sets unchanged (was: sets - 1)
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

/**
 * Calculates realistic exercise count caps based on session duration.
 * 
 * Model assumptions per exercise:
 * - Setup/transition: 2 min
 * - Work per set: ~45 sec
 * - Rest per set: ~90 sec (varies by goal)
 * - Average sets: 3-4
 * - Total per exercise: ~10-12 min
 * 
 * The model uses ~10 min/exercise as the baseline for calculating max,
 * with a buffer for warmup and transitions between exercises.
 */
export const getExerciseCaps = (minutes: number): { min: number; max: number } => {
  const buildCaps = (min: number, max: number) => ({
    min,
    max: Math.max(min, max)
  })

  // Reserve time for warmup and cooldown (scales with session length)
  const warmupCooldown = Math.min(5, Math.max(2, minutes * 0.08))
  const effectiveMinutes = minutes - warmupCooldown
  
  // Realistic time per exercise: 10-12 min average
  // Use 11 min as middle ground for max calculation
  const avgMinutesPerExercise = 11
  
  // Calculate max based on available time
  const rawMax = Math.floor(effectiveMinutes / avgMinutesPerExercise)
  
  // Apply bounds based on session length
  if (minutes <= 25) return buildCaps(2, Math.min(rawMax, 3))
  if (minutes <= 35) return buildCaps(2, Math.min(rawMax, 4))
  if (minutes <= 50) return buildCaps(3, Math.min(rawMax, 4))
  if (minutes <= 65) return buildCaps(3, Math.min(rawMax, 5))
  if (minutes <= 80) return buildCaps(4, Math.min(rawMax, 6))
  if (minutes <= 100) return buildCaps(4, Math.min(rawMax, 7))
  return buildCaps(5, Math.min(rawMax, 8))
}

/**
 * Adjusts exercise caps based on training goal.
 * - Strength: Longer rest between sets means fewer exercises fit
 * - Endurance/Cardio: Shorter rest allows more exercises
 * - Mobility: Typically flowing sequences, can include more movements
 */
export const getGoalAdjustedExerciseCaps = (
  minutes: number, 
  goal: Goal
): { min: number; max: number } => {
  const base = getExerciseCaps(minutes)
  
  // Strength sessions need more rest, so fewer exercises fit
  if (goal === 'strength') {
    return {
      min: Math.max(2, base.min - 1),
      max: Math.max(base.min, base.max - 1)
    }
  }
  
  // Endurance/cardio can fit slightly more due to shorter rest
  if (goal === 'endurance' || goal === 'cardio') {
    return {
      min: base.min,
      max: Math.min(base.max + 1, Math.floor(minutes / 8))
    }
  }
  
  // Mobility/yoga sessions flow more quickly between movements
  if (goal === 'range_of_motion') {
    return {
      min: base.min,
      max: Math.min(base.max + 2, Math.floor(minutes / 6))
    }
  }
  
  return base
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
