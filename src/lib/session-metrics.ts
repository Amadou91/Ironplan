import type { SessionGoal, GroupType, WeightUnit, MetricProfile, LoadType } from '@/types/domain'
import { toKg, toLbs, normalizeIntensity, convertWeight } from '@/lib/units'
import { clamp, isValidNumber } from '@/lib/math'
import { getWeekKey } from '@/lib/date-utils'
import {
  E1RM_MAX_REPS,
  E1RM_MIN_RPE,
  E1RM_MAX_RIR,
  E1RM_DIVISOR,
  HARD_SET_RPE_THRESHOLD,
  TIME_LOAD_FACTOR
} from '@/constants/training'

// Re-export getWeekKey for backwards compatibility
export { getWeekKey }

export const E1RM_FORMULA_VERSION = 'epley_v1'

export type MetricsSet = {
  metricProfile?: MetricProfile
  reps?: number | null
  weight?: number | null
  weightUnit?: WeightUnit | null
  implementCount?: number | null
  loadType?: LoadType | null
  rpe?: number | null
  rir?: number | null
  performedAt?: string | null
  durationSeconds?: number | null
  distance?: number | null
  completed?: boolean | null
  restSecondsActual?: number | null
}

export type MetricsExercise = {
  primaryMuscle?: string | null
  secondaryMuscles?: string[] | null
  sets: MetricsSet[]
  e1rmEligible?: boolean
}

export type MetricsSession = {
  startedAt: string
  exercises: MetricsExercise[]
  goal?: SessionGoal | null
}

export const isSetE1rmEligible = (
  _sessionGoal?: SessionGoal | null,
  exerciseEligible?: boolean | null,
  set?: MetricsSet | null
): boolean => {
  // Strict eligibility is backed by explicit catalog metadata.
  if (exerciseEligible !== true) return false
  if (!set || set.completed === false) return false
  if (typeof set.reps !== 'number' || set.reps <= 0 || set.reps > E1RM_MAX_REPS) return false

  const rpe = typeof set.rpe === 'number' ? set.rpe : null
  const rir =
    typeof set.rir === 'number' && Number.isFinite(set.rir)
      ? set.rir
      : typeof rpe === 'number' && Number.isFinite(rpe)
        ? mapRpeToRir(rpe)
        : null

  if (rpe !== null && rpe < E1RM_MIN_RPE) return false
  if (rir === null || rir < 0 || rir > E1RM_MAX_RIR) return false

  return true
}

/**
 * Returns a confidence factor for E1RM calculations based on RPE.
 * Higher RPE = higher confidence in the E1RM estimate.
 */
export const getE1rmConfidence = (set: MetricsSet): number => {
  const rpe = typeof set.rpe === 'number' ? set.rpe : null
  const rir = typeof set.rir === 'number' ? set.rir : null
  
  const effectiveRpe = rpe ?? (rir !== null ? mapRirToRpe(rir) : null)
  if (effectiveRpe === null) return 0.5
  
  // RPE 10 = 1.0 confidence, RPE 6 = 0.6 confidence
  return clamp(effectiveRpe / 10, 0.5, 1.0)
}

// getWeekKey imported from @/lib/date-utils and re-exported above

export const toWeightInPounds = (weight: number, unit?: WeightUnit | null) =>
  convertWeight(weight, unit === 'kg' ? 'kg' : 'lb', 'lb')

export const toWeightInUnit = (weight: number, fromUnit: WeightUnit, toUnit: WeightUnit) =>
  convertWeight(weight, fromUnit, toUnit)

// clamp and isValidNumber imported from @/lib/math

export const getTotalWeight = (
  weight: number | null | undefined,
  loadType?: LoadType | null,
  implementCount?: number | null
) => {
  if (!isValidNumber(weight)) return 0
  if (loadType === 'per_implement' && isValidNumber(implementCount) && implementCount > 0) {
    return weight * implementCount
  }
  return weight
}

export const formatTotalWeightLabel = ({
  weight,
  weightUnit,
  displayUnit,
  loadType,
  implementCount,
  decimals = 1
}: {
  weight: number | null | undefined
  weightUnit: WeightUnit | null | undefined
  displayUnit: WeightUnit
  loadType?: LoadType | null
  implementCount?: number | null
  decimals?: number
}) => {
  if (!isValidNumber(weight)) return null
  const fromUnit = weightUnit ?? 'lb'
  const perImplement = convertWeight(weight, fromUnit, displayUnit)
  const total = getTotalWeight(perImplement, loadType, implementCount)
  const format = (value: number) => {
    const rounded = Number.isFinite(value) ? Number(value.toFixed(decimals)) : value
    return Number.isInteger(rounded) ? String(rounded) : String(rounded)
  }
  if (loadType === 'per_implement' && isValidNumber(implementCount) && implementCount > 0) {
    return `${implementCount} x ${format(perImplement)} ${displayUnit} = ${format(total)} ${displayUnit} total`
  }
  return `${format(total)} ${displayUnit} total`
}

export const mapRirToRpe = (rir: number) => {
  if (!Number.isFinite(rir)) return null
  return clamp(10 - rir, 0, 10)
}

export const mapRpeToRir = (rpe: number) => {
  if (!Number.isFinite(rpe) || rpe < 5) return null
  if (rpe >= 10) return 0
  return 10 - rpe
}

/**
 * Calculates External Tonnage (Volume Load) in Pounds.
 * 
 * Formula: Reps × ExternalWeight(lbs)
 * 
 * CORRECTNESS REQUIREMENT: This function uses ONLY explicit external weight.
 * - No virtual bodyweight inference
 * - No exercise name matching
 * - No user bodyweight multipliers
 * 
 * If no external weight is entered, tonnage = 0.
 * 
 * @param set - The set metrics containing reps, weight, unit, loadType, implementCount
 * @returns External tonnage in pounds (0 if no valid external weight)
 */
export const computeSetTonnage = (set: MetricsSet): number => {
  // Validate reps
  if (!isValidNumber(set.reps) || set.reps <= 0) return 0
  
  // Validate external weight
  if (!isValidNumber(set.weight) || set.weight <= 0) return 0
  
  // Calculate total weight respecting loadType and implementCount
  const totalWeight = getTotalWeight(set.weight, set.loadType, set.implementCount)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return 0
  
  // Convert to pounds and multiply by reps
  return toLbs(totalWeight, set.weightUnit) * set.reps
}

/** Metric profiles that are eligible for E1RM calculations */
const E1RM_ELIGIBLE_PROFILES: MetricProfile[] = ['reps_weight']

const normalizeMetricProfile = (profile?: MetricProfile | string | null) => {
  if (!profile) return null
  if (profile === 'strength' || profile === 'weight-reps' || profile === 'weight_reps') {
    return 'reps_weight'
  }
  return profile
}

/** Check if a metric profile is eligible for E1RM calculations (treats legacy 'strength' as 'reps_weight') */
const isE1rmEligibleProfile = (profile?: MetricProfile | string | null): boolean => {
  const normalizedProfile = normalizeMetricProfile(profile)
  if (!normalizedProfile) return true // Default to eligible if not specified
  return E1RM_ELIGIBLE_PROFILES.includes(normalizedProfile as MetricProfile)
}

export const computeSetE1rm = (
  set: MetricsSet,
  sessionGoal?: SessionGoal | null,
  exerciseEligible?: boolean | null,
  movementPattern?: string | null
) => {
  void movementPattern
  if (!isE1rmEligibleProfile(set.metricProfile)) return null
  if (!isSetE1rmEligible(sessionGoal, exerciseEligible, set)) return null
  if (!isValidNumber(set.reps) || !isValidNumber(set.weight)) return null
  const totalWeight = getTotalWeight(set.weight, set.loadType, set.implementCount)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0 || set.reps <= 0) return null
  
  // Use KG for internal calculation consistency
  const weight = toKg(totalWeight, set.weightUnit)
  const derivedRir =
    typeof set.rir === 'number' && Number.isFinite(set.rir)
      ? set.rir
      : typeof set.rpe === 'number' && Number.isFinite(set.rpe)
        ? mapRpeToRir(set.rpe)
        : null
  const rirValue = typeof derivedRir === 'number' ? clamp(derivedRir, 0, E1RM_MAX_RIR) : 0
  const repsAtFailure = set.reps + rirValue
  return weight * (1 + repsAtFailure / E1RM_DIVISOR)
}

export const getEffortScore = (set: MetricsSet) => {
  if (typeof set.rpe === 'number' && Number.isFinite(set.rpe)) return set.rpe
  if (typeof set.rir === 'number' && Number.isFinite(set.rir)) return mapRirToRpe(set.rir)
  return null
}

/** Metric profiles eligible for hard set calculations */
const HARD_SET_ELIGIBLE_PROFILES: MetricProfile[] = ['reps_weight', 'timed_strength']

/** Check if a metric profile is eligible for hard set tracking (treats legacy 'strength' as 'reps_weight') */
const isHardSetEligibleProfile = (profile?: MetricProfile | string | null): boolean => {
  const normalizedProfile = normalizeMetricProfile(profile)
  if (!normalizedProfile) return true // Default to eligible if not specified
  return HARD_SET_ELIGIBLE_PROFILES.includes(normalizedProfile as MetricProfile)
}

export const isHardSet = (set: MetricsSet) => {
  if (!isHardSetEligibleProfile(set.metricProfile)) return false
  const effort = getEffortScore(set)
  return typeof effort === 'number' ? effort >= HARD_SET_RPE_THRESHOLD : false
}

export const computeSetIntensity = (set: MetricsSet) => {
  const e1rm = computeSetE1rm(set, null, true)
  if (!e1rm) return 0
  if (!isValidNumber(set.weight)) return 0
  const totalWeight = getTotalWeight(set.weight, set.loadType, set.implementCount)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return 0
  const weight = toKg(totalWeight, set.weightUnit)
  return weight / e1rm
}

export const computeRelativeStrength = (
  e1rmKg: number | null | undefined,
  bodyWeightLb: number | null | undefined
) => {
  if (!isValidNumber(e1rmKg) || e1rmKg <= 0) return null
  if (!isValidNumber(bodyWeightLb) || bodyWeightLb <= 0) return null
  const bodyWeightKg = toKg(bodyWeightLb, 'lb')
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) return null
  return e1rmKg / bodyWeightKg
}

/**
 * Calculates Workload Score (Physiological Stress).
 * 
 * CORRECTNESS REQUIREMENT: Uses only explicit inputs.
 * - External tonnage (from explicit weight entered by user)
 * - Explicit durationSeconds (for cardio/mobility)
 * - No estimated/inferred values
 * 
 * Formula for strength: ExternalTonnage(lbs) × IntensityFactor
 * Formula for cardio/mobility: Minutes × IntensityFactor × TIME_LOAD_FACTOR
 * 
 * If no explicit weight AND no explicit duration: load = 0
 */
export const computeSetLoad = (set: MetricsSet): number => {
  const profile = set.metricProfile || 'reps_weight'
  const effort = getEffortScore(set)
  const intensityFactor = normalizeIntensity(effort)
  
  // Strategy 1: Strength/Hypertrophy (External Load-based)
  // Only applies if explicit external weight was entered
  const tonnage = computeSetTonnage(set)
  if (tonnage > 0 && profile !== 'cardio_session' && profile !== 'mobility_session') {
    return tonnage * intensityFactor
  }

  // Strategy 2: Duration-based (Cardio/Mobility)
  // Only applies if explicit durationSeconds was entered
  // TIME_LOAD_FACTOR imported from @/constants/training

  if (typeof set.durationSeconds === 'number' && set.durationSeconds > 0) {
    const minutes = set.durationSeconds / 60
    return minutes * intensityFactor * TIME_LOAD_FACTOR
  }

  // No explicit weight and no explicit duration = 0 load
  // (Pure accuracy: do not estimate from reps)
  return 0
}

export const aggregateTonnage = (sets: MetricsSet[]) =>
  sets.reduce((sum, set) => sum + computeSetTonnage(set), 0)

export const aggregateBestE1rm = (
  sets: MetricsSet[],
  sessionGoal?: SessionGoal | null,
  exerciseEligible?: boolean | null,
  movementPattern?: string | null
) => {
  const e1rms = sets
    .map((set) => computeSetE1rm(set, sessionGoal, exerciseEligible, movementPattern))
    .filter((val): val is number => val !== null)
  return e1rms.length > 0 ? Math.max(...e1rms) : 0
}

export const aggregateHardSets = (sets: MetricsSet[]) =>
  sets.reduce((sum, set) => sum + (isHardSet(set) ? 1 : 0), 0)

export const computeWeeklyVolumeByMuscleGroup = (sessions: MetricsSession[]) => {
  const weekly = new Map<string, Map<string, number>>()

  sessions.forEach((session) => {
    const weekKey = getWeekKey(session.startedAt)
    if (!weekly.has(weekKey)) {
      weekly.set(weekKey, new Map())
    }
    const weekMap = weekly.get(weekKey)
    if (!weekMap) return

    session.exercises.forEach((exercise) => {
      const muscles = [exercise.primaryMuscle, ...(exercise.secondaryMuscles ?? [])].filter(
        (muscle): muscle is string => Boolean(muscle)
      )
      if (!muscles.length) {
        muscles.push('unknown')
      }
      exercise.sets.forEach((set) => {
        const tonnage = computeSetTonnage(set)
        if (!tonnage) return
        muscles.forEach((muscle) => {
          weekMap.set(muscle, (weekMap.get(muscle) ?? 0) + tonnage)
        })
      })
    })
  })

  return weekly
}

export const getGroupLabel = (groupType?: GroupType | null, groupId?: string | null) => {
  if (!groupType || !groupId) return ''
  const label = groupType.replace('_', ' ')
  return `${label} ${groupId}`
}
