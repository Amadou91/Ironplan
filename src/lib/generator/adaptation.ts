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

  // 1. Determine Rep Range based on Style
  let reps = repsOverride ?? exercise.reps
  
  if (!repsOverride) {
    if (style === 'strength') {
      reps = intensity === 'high' ? '3-6' : '4-6'
    } else if (style === 'endurance') {
      reps = intensity === 'high' ? '15-20' : '12-15'
    } else if (style === 'hypertrophy') {
      reps = intensity === 'high' ? '8-10' : '8-12'
    }
    // If range_of_motion or cardio, we typically keep the catalog baseline 
    // unless it's fundamentally a strength move being used for endurance.
  }

  // 2. Adjust Sets based on Experience and Intensity
  // Base sets from catalog are adjusted for experience (+/- 1) and intensity (+/- 1)
  const baseSets = adjustSetsForIntensity(
    adjustSets(exercise.sets, experience), 
    intensity
  )

  // 3. Adjust RPE
  const rpe = adjustRpe(exercise.rpe, intensity)

  // 4. Adjust Rest Period
  // Strength needs more rest, Endurance needs less.
  let styleRestModifier = 1.0
  if (style === 'strength') styleRestModifier = 1.2
  if (style === 'endurance') styleRestModifier = 0.7
  
  const isCardio = exercise.category === 'Cardio' || exercise.focus === 'cardio'
  const restSeconds = clamp(
    Math.round(exercise.restSeconds * restModifier * styleRestModifier), 
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
