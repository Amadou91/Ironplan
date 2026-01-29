import type { SessionGoal, GroupType, WeightUnit, MetricProfile, LoadType } from '@/types/domain'
import { toKg, toLbs, normalizeIntensity, convertWeight } from '@/lib/units'

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
  sessionGoal?: SessionGoal | null,
  exerciseEligible?: boolean | null,
  set?: MetricsSet | null
): boolean => {
  if (!exerciseEligible) return false
  if (!set || set.completed === false) return false
  if (typeof set.reps !== 'number' || set.reps <= 0 || set.reps > 12) return false

  const rpe = typeof set.rpe === 'number' ? set.rpe : null
  const rir = typeof set.rir === 'number' ? set.rir : null

  // Relaxed filtering: allow RPE >= 6 (instead of 8) for broader E1RM data
  // Lower RPE sets will have reduced confidence but still contribute
  if (rpe !== null && rpe < 6) return false
  if (rir !== null && rir > 4) return false
  if (rpe === null && rir === null) return false

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

export const getWeekKey = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${week}`
}

export const toWeightInPounds = (weight: number, unit?: WeightUnit | null) =>
  convertWeight(weight, unit === 'kg' ? 'kg' : 'lb', 'lb')

export const toWeightInUnit = (weight: number, fromUnit: WeightUnit, toUnit: WeightUnit) =>
  convertWeight(weight, fromUnit, toUnit)

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const isValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

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

// Default bodyweight placeholder in lbs (average user weight * 0.7 for push-ups, etc.)
const DEFAULT_BODYWEIGHT_FACTOR = 0.7
const DEFAULT_USER_WEIGHT_LBS = 170

/**
 * Calculates Volume Load in Pounds.
 * Formula: Reps * Weight(lb)
 * For bodyweight exercises without weight, uses a placeholder estimation.
 */
export const computeSetTonnage = (set: MetricsSet, userWeightLbs?: number): number => {
  if (!isValidNumber(set.reps) || set.reps <= 0) return 0
  
  // Handle bodyweight exercises with no weight recorded
  if (!isValidNumber(set.weight) || set.weight <= 0) {
    // If no weight but we have reps, this might be a bodyweight exercise
    // Use a placeholder to avoid breaking volume graphs
    const effectiveWeight = (userWeightLbs ?? DEFAULT_USER_WEIGHT_LBS) * DEFAULT_BODYWEIGHT_FACTOR
    return effectiveWeight * set.reps
  }
  
  const totalWeight = getTotalWeight(set.weight, set.loadType, set.implementCount)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return 0
  return toLbs(totalWeight, set.weightUnit) * set.reps
}

export const computeSetE1rm = (
  set: MetricsSet,
  sessionGoal?: SessionGoal | null,
  exerciseEligible?: boolean | null
) => {
  if (set.metricProfile && set.metricProfile !== 'reps_weight') return null
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
  const rirValue = typeof derivedRir === 'number' ? clamp(derivedRir, 0, 6) : 0
  const repsAtFailure = set.reps + rirValue
  return weight * (1 + repsAtFailure / 30)
}

export const getEffortScore = (set: MetricsSet) => {
  if (typeof set.rpe === 'number' && Number.isFinite(set.rpe)) return set.rpe
  if (typeof set.rir === 'number' && Number.isFinite(set.rir)) return mapRirToRpe(set.rir)
  return null
}

export const isHardSet = (set: MetricsSet) => {
  if (set.metricProfile && set.metricProfile !== 'reps_weight' && set.metricProfile !== 'timed_strength') return false
  const effort = getEffortScore(set)
  return typeof effort === 'number' ? effort >= 8 : false
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

/**
 * Calculates Workload Score (Physiological Stress).
 * Formula: Volume Load (kg) * Normalized Intensity Factor
 */
export const computeSetLoad = (set: MetricsSet): number => {
  const profile = set.metricProfile || 'reps_weight'
  const effort = getEffortScore(set)
  const intensityFactor = normalizeIntensity(effort)
  
  // Strategy 1: Strength/Hypertrophy (Load-based)
  // Used for 'strength' and 'timed_strength' if weight is present
  const tonnage = computeSetTonnage(set)
  if (tonnage > 0 && profile !== 'cardio_session' && profile !== 'mobility_session') {
    // Tonnage (lbs) * IntensityFactor.
    return tonnage * intensityFactor
  }

  // Strategy 2: Duration-based (Cardio/Mobility/Timed Bodyweight)
  // Normalize minutes to be comparable to Tonnage.
  // CONSTANT: 215 scales ~60min cardio @ RPE 7 to ~7,500 Load,
  // comparable to a moderate lifting session.
  const TIME_LOAD_FACTOR = 215

  if (typeof set.durationSeconds === 'number' && set.durationSeconds > 0) {
    const minutes = set.durationSeconds / 60
    return minutes * intensityFactor * TIME_LOAD_FACTOR
  }

  // Fallback: If no duration but reps provided for non-weighted (e.g. bodyweight reps)
  // Estimate duration: 3 seconds per rep?
  if (typeof set.reps === 'number' && set.reps > 0) {
     const estimatedMinutes = (set.reps * 3) / 60
     return estimatedMinutes * intensityFactor * TIME_LOAD_FACTOR
  }

  return 0
}

export const aggregateTonnage = (sets: MetricsSet[]) =>
  sets.reduce((sum, set) => sum + computeSetTonnage(set), 0)

export const aggregateBestE1rm = (sets: MetricsSet[], sessionGoal?: SessionGoal | null, exerciseEligible?: boolean | null) => {
  const e1rms = sets
    .map((set) => computeSetE1rm(set, sessionGoal, exerciseEligible))
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
