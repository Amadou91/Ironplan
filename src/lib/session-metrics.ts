import type { Goal, GroupType, WeightUnit, MetricProfile } from '@/types/domain'
import { convertWeight } from '@/lib/units'

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
  // 1) Exercise Library Gate - must be a movement suitable for e1RM (e.g. not stretching)
  if (!exerciseEligible) return false

  // 2) Set Level Gate
  if (!set || set.completed === false) return false
  
  // Formulas are most accurate at low reps, but valid for trend tracking up to ~12.
  if (typeof set.reps !== 'number' || set.reps <= 0 || set.reps > 12) return false

  const rpe = typeof set.rpe === 'number' ? set.rpe : null
  const rir = typeof set.rir === 'number' ? set.rir : null

  // Close enough effort: RPE 8+ or RIR 2 or stricter
  // We need a high effort set to get a valid estimate of max strength.
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
  // standard RIR to effort mapping: 0 RIR = 10 effort, 10 RIR = 0 effort
  return clamp(10 - rir, 0, 10)
}

export const mapRpeToRir = (rpe: number) => {
  if (!Number.isFinite(rpe) || rpe < 5) return null
  if (rpe >= 10) return 0
  return 10 - rpe
}

export const computeSetTonnage = (set: MetricsSet) => {
  if (typeof set.weight !== 'number' || typeof set.reps !== 'number') return 0
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return 0
  if (set.weight <= 0 || set.reps <= 0) return 0
  return toWeightInPounds(set.weight, set.weightUnit) * set.reps
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
  const weight = toWeightInPounds(set.weight, set.weightUnit)
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
  const e1rm = computeSetE1rm(set, 'strength', true) // Default true for legacy/generic intensity calculations
  if (!e1rm) return 0
  if (typeof set.weight !== 'number' || set.weight <= 0) return 0
  const weight = toWeightInPounds(set.weight, set.weightUnit)
  return weight / e1rm
}

export const computeSetLoad = (set: MetricsSet) => {
  const tonnage = computeSetTonnage(set)
  if (tonnage > 0) {
    const effort = getEffortScore(set)
    const effortFactor = typeof effort === 'number' ? clamp(effort / 10, 0.4, 1.1) : 0.65
    return tonnage * effortFactor
  }

  // Fallback for duration-based activities (Yoga, Cardio)
  // volume_proxy = duration_minutes * intensity_factor
  if (typeof set.durationSeconds === 'number' && set.durationSeconds > 0) {
    const minutes = set.durationSeconds / 60
    const effort = getEffortScore(set)
    const effortValue = typeof effort === 'number' ? effort : 3.0
    
    // Use a non-linear multiplier for effort to reflect systemic stress
    // e.g. 5/10 effort is moderate, but 9/10 effort is significantly more taxing
    // Multiplier = (effort^1.5) / 10
    const intensityFactor = Math.pow(effortValue, 1.5) / 10
    
    return minutes * intensityFactor * 10 // scale to be roughly comparable to tonnage loads
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