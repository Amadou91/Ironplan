import { useMemo, useState } from 'react'
import type { WorkoutSet, MetricProfile } from '@/types/domain'
import type { WeightOption } from '@/lib/equipment'

export interface UseSetEditorOptions {
  set: WorkoutSet
  metricProfile?: MetricProfile
  weightOptions?: WeightOption[]
  isCardio?: boolean
  isMobility?: boolean
  isTimeBased?: boolean
  onUpdate: (field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void
}

export function useSetEditor({
  set,
  metricProfile,
  weightOptions,
  isCardio,
  isMobility,
  isTimeBased,
  onUpdate
}: UseSetEditorOptions) {
  const [weightError, setWeightError] = useState(false)
  const [repsError, setRepsError] = useState(false)

  const isEditing = !set.completed

      const effectiveProfile = useMemo(() => {
        if (metricProfile) return metricProfile
        if (isMobility) return 'mobility_session'
        if (isCardio) return 'cardio_session'
        if (isTimeBased) return 'timed_strength'
        return 'strength'
      }, [metricProfile, isMobility, isCardio, isTimeBased])

  const timeLabel = useMemo(() => {
    if (!set.performedAt) return 'Not logged yet'
    const date = new Date(set.performedAt)
    return Number.isNaN(date.getTime()) ? 'Not logged yet' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [set.performedAt])

  const validateAndUpdate = (field: keyof WorkoutSet, val: string) => {
    if (val === '') {
      onUpdate(field, '')
      if (field === 'weight') setWeightError(false)
      if (field === 'reps') setRepsError(false)
      return
    }

    const regex = field === 'weight' ? /^\d*\.?\d*$/ : /^\d*$/
    if (regex.test(val)) {
      const num = Number(val)
      if (Number.isFinite(num)) {
        onUpdate(field, num)
        if (field === 'weight') setWeightError(false)
        if (field === 'reps') setRepsError(false)
      }
    } else {
      if (field === 'weight') setWeightError(true)
      if (field === 'reps') setRepsError(true)
    }
  }

  const updateExtra = (key: string, value: unknown) => {
    const currentExtras = (set.extraMetrics as Record<string, unknown>) ?? {}
    onUpdate('extraMetrics', { ...currentExtras, [key]: value })
  }

  const getExtra = (key: string) => {
    const extras = (set.extraMetrics as Record<string, unknown>) ?? {}
    return extras[key]
  }

  const weightChoices = useMemo(() => {
    const options = weightOptions ?? []
    if (typeof set.weight === 'number' && Number.isFinite(set.weight)) {
      const storedKind = (set.extraMetrics as Record<string, unknown> | null)?.equipmentKind as string | undefined
      const existing = options.some((option) => option.value === set.weight && option.equipmentKind === storedKind)
      if (!existing) {
        const unitLabel = set.weightUnit ?? 'lb'
        return [...options, { key: `logged-${set.weight}`, value: set.weight, label: `${set.weight} ${unitLabel} (logged)` }]
      }
    }
    return options
  }, [set.weight, set.weightUnit, weightOptions, set.extraMetrics])

  const durationMinutes = useMemo(() => {
    if (typeof set.durationSeconds === 'number') return Number((set.durationSeconds / 60).toFixed(2))
    if (['timed_strength', 'cardio_session', 'mobility_session'].includes(effectiveProfile) && typeof set.reps === 'number') {
      return Number((set.reps / 60).toFixed(2))
    }
    return ''
  }, [set.durationSeconds, set.reps, effectiveProfile])

  const handleDurationChange = (val: string) => {
    onUpdate('durationSeconds', val === '' ? '' : Math.round(Number(val) * 60))
  }

  const restMinutes = useMemo(() => {
    if (typeof set.restSecondsActual === 'number' && set.restSecondsActual >= 0) {
      return Number((set.restSecondsActual / 60).toFixed(2))
    }
    return ''
  }, [set.restSecondsActual])

  const handleRestChange = (val: string) => {
    onUpdate('restSecondsActual', val === '' ? null : Math.round(Number(val) * 60))
  }

  const rirValue = (['cardio_session', 'mobility_session'].includes(effectiveProfile))
    ? (typeof set.rpe === 'number' ? String(set.rpe) : '')
    : (typeof set.rir === 'number' ? String(set.rir) : '')

  return {
    isEditing,
    effectiveProfile,
    timeLabel,
    weightError,
    repsError,
    validateAndUpdate,
    updateExtra,
    getExtra,
    weightChoices,
    durationMinutes,
    handleDurationChange,
    restMinutes,
    handleRestChange,
    rirValue
  }
}
