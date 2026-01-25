import type { Goal, GroupType, WeightUnit, MetricProfile } from '@/types/domain'
import { toKg, toLbs, normalizeIntensity, convertWeight } from '@/lib/units'

export const E1RM_FORMULA_VERSION = 'epley_v1'

export type MetricsSet = {
  metricProfile?: MetricProfile
  reps?: number | null
  weight?: number | null
  weightUnit?: WeightUnit | null
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
  goal?: Goal | null
}

export const isSetE1rmEligible = (
  sessionGoal?: Goal | null,
  exerciseEligible?: boolean | null,
  set?: MetricsSet | null
): boolean => {
  if (!exerciseEligible) return false
  if (!set || set.completed === false) return false
  if (typeof set.reps !== 'number' || set.reps <= 0 || set.reps > 12) return false

  const rpe = typeof set.rpe === 'number' ? set.rpe : null
  const rir = typeof set.rir === 'number' ? set.rir : null

  if (rpe !== null && rpe < 8) return false
  if (rir !== null && rir > 2) return false
  if (rpe === null && rir === null) return false

  return true
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
 * Calculates Volume Load in Pounds.
 * Formula: Reps * Weight(lb)
 */
export const computeSetTonnage = (set: MetricsSet): number => {
  if (typeof set.weight !== 'number' || typeof set.reps !== 'number') return 0
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return 0
  if (set.weight <= 0 || set.reps <= 0) return 0
  return toLbs(set.weight, set.weightUnit) * set.reps
}

export const computeSetE1rm = (
  set: MetricsSet,
  sessionGoal?: Goal | null,
  exerciseEligible?: boolean | null
) => {
  if (set.metricProfile && set.metricProfile !== 'strength') return null
  if (!isSetE1rmEligible(sessionGoal, exerciseEligible, set)) return null
  if (typeof set.weight !== 'number' || typeof set.reps !== 'number') return null
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return null
  if (set.weight <= 0 || set.reps <= 0) return null
  
  // Use KG for internal calculation consistency
  const weight = toKg(set.weight, set.weightUnit)
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
  if (set.metricProfile && set.metricProfile !== 'strength' && set.metricProfile !== 'timed_strength') return false
  const effort = getEffortScore(set)
  return typeof effort === 'number' ? effort >= 8 : false
}

export const computeSetIntensity = (set: MetricsSet) => {
  const e1rm = computeSetE1rm(set, 'strength', true)
  if (!e1rm) return 0
  if (typeof set.weight !== 'number' || set.weight <= 0) return 0
  const weight = toKg(set.weight, set.weightUnit)
  return weight / e1rm
}

/**
 * Calculates Workload Score (Physiological Stress).
 * Formula: Volume Load (kg) * Normalized Intensity Factor
 */
export const computeSetLoad = (set: MetricsSet): number => {
  const profile = set.metricProfile || 'strength'
  const effort = getEffortScore(set)
  const intensityFactor = normalizeIntensity(effort)
  
  // Strategy 1: Strength/Hypertrophy (Load-based)
  // Used for 'strength' and 'timed_strength' if weight is present
  const tonnage = computeSetTonnage(set)
  if (tonnage > 0 && profile !== 'yoga_session' && profile !== 'cardio_session' && profile !== 'mobility_session') {
    // Tonnage (lbs) * IntensityFactor.
    return tonnage * intensityFactor
  }

  // Strategy 2: Duration-based (Cardio/Yoga/Mobility/Timed Bodyweight)
  // Normalize minutes to be comparable to Tonnage.
  // CONSTANT: 450 scales ~60min moderate Cardio to ~7700 Load, 
  // comparable to a moderate lifting session (~9000-10000 Load).
  const TIME_LOAD_FACTOR = 450

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

export const aggregateBestE1rm = (sets: MetricsSet[], sessionGoal?: Goal | null, exerciseEligible?: boolean | null) => {
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
