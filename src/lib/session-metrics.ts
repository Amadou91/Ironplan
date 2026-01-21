import type { GroupType, SetType, WeightUnit } from '@/types/domain'
import { convertWeight } from '@/lib/units'

export const E1RM_FORMULA_VERSION = 'epley_v1'

export type MetricsSet = {
  reps?: number | null
  weight?: number | null
  weightUnit?: WeightUnit | null
  rpe?: number | null
  rir?: number | null
  failure?: boolean | null
  setType?: SetType | null
  performedAt?: string | null
  restSecondsActual?: number | null
}

export type MetricsExercise = {
  primaryMuscle?: string | null
  secondaryMuscles?: string[] | null
  sets: MetricsSet[]
}

export type MetricsSession = {
  startedAt: string
  exercises: MetricsExercise[]
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
  const rounded = Math.round(rir)
  if (rounded <= 0) return 10
  if (rounded === 1) return 9
  if (rounded === 2) return 8
  if (rounded === 3) return 7
  return 5.5
}

export const mapRpeToRir = (rpe: number) => {
  if (!Number.isFinite(rpe)) return null
  if (rpe >= 10) return 0
  if (rpe >= 9.5) return 0.5
  if (rpe >= 9) return 1
  if (rpe >= 8) return 2
  if (rpe >= 7) return 3
  if (rpe >= 5.5) return 4
  return null
}

export const computeSetTonnage = (set: MetricsSet) => {
  if (typeof set.weight !== 'number' || typeof set.reps !== 'number') return 0
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return 0
  if (set.weight <= 0 || set.reps <= 0) return 0
  return toWeightInPounds(set.weight, set.weightUnit) * set.reps
}

export const computeSetE1rm = (set: MetricsSet) => {
  if (typeof set.weight !== 'number' || typeof set.reps !== 'number') return 0
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return 0
  if (set.weight <= 0 || set.reps <= 0) return 0
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
  if (set.setType === 'amrap') return true
  if (set.failure) return true
  const effort = getEffortScore(set)
  return typeof effort === 'number' ? effort >= 8 : false
}

export const computeSetIntensity = (set: MetricsSet) => {
  const e1rm = computeSetE1rm(set)
  if (!e1rm) return 0
  if (typeof set.weight !== 'number' || set.weight <= 0) return 0
  const weight = toWeightInPounds(set.weight, set.weightUnit)
  return weight / e1rm
}

const getSetTypeModifier = (setType?: SetType | null) => {
  if (setType === 'backoff') return 0.9
  if (setType === 'drop') return 0.85
  if (setType === 'amrap') return 1.05
  return 1
}

export const computeSetLoad = (set: MetricsSet) => {
  const tonnage = computeSetTonnage(set)
  if (!tonnage) return 0
  const effort = getEffortScore(set)
  const effortFactor = typeof effort === 'number' ? clamp(effort / 10, 0.4, 1.1) : 0.65
  return tonnage * effortFactor * getSetTypeModifier(set.setType)
}

export const aggregateTonnage = (sets: MetricsSet[]) =>
  sets.reduce((sum, set) => sum + computeSetTonnage(set), 0)

export const aggregateBestE1rm = (sets: MetricsSet[]) =>
  sets.reduce((best, set) => Math.max(best, computeSetE1rm(set)), 0)

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
