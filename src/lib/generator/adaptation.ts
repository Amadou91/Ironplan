import type { 
  Goal, 
  Intensity, 
  Exercise, 
  ExercisePrescription,
  PlanInput
} from '@/types/domain'
import { clamp } from './utils'
import { 
  adjustRpe, 
  adjustSets, 
  adjustSetsForIntensity 
} from './scoring'

/**
 * Adapts an exercise prescription to a specific training style (Goal).
 * 
 * This is the core of "Option B" behavior:
 * Any exercise can be performed with different intents (strength, hypertrophy, endurance).
 * The prescription (sets, reps, rest, RPE) adapts to the CHOSEN style at runtime.
 */
export function adaptPrescription(
  exercise: Exercise,
  style: Goal,
  intensity: Intensity,
  experience: PlanInput['experienceLevel'],
  options: {
    restModifier?: number
    repsOverride?: string | number
  } = {}
): ExercisePrescription {
  const { restModifier = 1.0, repsOverride } = options
  const profile = exercise.metricProfile || 'strength'

  // 1. Determine Rep Range / Duration based on Style and Profile
  let reps = repsOverride ?? exercise.reps
  
  if (!repsOverride) {
    const isStrengthMove = profile === 'strength' || profile === 'reps_weight' || profile === 'reps_only'
    
    if (isStrengthMove) {
      if (style === 'strength') {
        reps = intensity === 'high' ? '3-6' : '4-6'
      } else if (style === 'endurance') {
        reps = intensity === 'high' ? '15-20' : '12-15'
      } else if (style === 'hypertrophy') {
        reps = intensity === 'high' ? '8-10' : '8-12'
      }
    } else {
      // For Timed Strength, Cardio, Mobility:
      // We mostly preserve the catalog reps (which represent duration or intervals)
      // but we could scale them if we had a duration scalar.
      reps = exercise.reps
    }
  }

  // 2. Adjust Sets based on Experience and Intensity
  const baseSets = adjustSetsForIntensity(
    adjustSets(exercise.sets || 3, experience), 
    intensity
  )

  // 3. Adjust RPE
  const rpe = adjustRpe(exercise.rpe || 7, intensity)

  // 4. Adjust Rest Period
  // Strength needs more rest, Endurance needs less.
  let styleRestModifier = 1.0
  if (style === 'strength') styleRestModifier = 1.2
  if (style === 'endurance') styleRestModifier = 0.7
  if (style === 'range_of_motion') styleRestModifier = 0.5
  
  const isCardio = exercise.category === 'Cardio' || exercise.focus === 'cardio' || profile === 'cardio_session'
  const restSeconds = clamp(
    Math.round((exercise.restSeconds || 60) * restModifier * styleRestModifier), 
    isCardio ? 30 : 45, 
    180
  )

  return {
    sets: baseSets,
    reps,
    rpe,
    restSeconds
  }
}
