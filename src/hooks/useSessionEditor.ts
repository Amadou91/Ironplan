'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { equipmentPresets } from '@/lib/equipment'
import type { WeightUnit, WorkoutSet, EquipmentInventory, MetricProfile } from '@/types/domain'

export type EditableExercise = {
  id: string
  name: string
  primaryMuscle: string | null
  secondaryMuscles: string[]
  metricProfile?: MetricProfile | null
  orderIndex: number | null
  sets: WorkoutSet[]
}

export type ReadinessData = {
  sleep_quality: number
  muscle_soreness: number
  stress_level: number
  motivation: number
}

export type EditableSession = {
  id: string
  name: string
  startedAt: string
  endedAt: string | null
  templateId?: string | null
  userId?: string | null
  timezone?: string | null
  bodyWeightLb?: number | null
  readiness?: ReadinessData | null
  exercises: EditableExercise[]
}

type SetRow = {
  id: string
  set_number: number | null
  reps: number | null
  weight: number | null
  implement_count: number | null
  load_type: string | null
  rpe: number | null
  rir: number | null
  completed: boolean | null
  performed_at: string | null
  weight_unit: string | null
  duration_seconds: number | null
  distance: number | null
  rest_seconds_actual: number | null
}

type ExerciseRow = {
  id: string
  exercise_name: string
  primary_muscle: string | null
  secondary_muscles: string[]
  metric_profile: MetricProfile | null
  order_index: number | null
  sets: SetRow[]
}

type ReadinessRow = {
  sleep_quality: number
  muscle_soreness: number
  stress_level: number
  motivation: number
}

type SessionQueryResult = {
  id: string
  user_id: string | null
  template_id: string | null
  name: string
  started_at: string
  ended_at: string | null
  timezone: string | null
  body_weight_lb: number | null
  session_readiness: ReadinessRow[]
  session_exercises: ExerciseRow[]
}

export function useSessionEditor(sessionId?: string) {
  const supabase = createClient()
  const [session, setSession] = useState<EditableSession | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([])
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [preferredUnit] = useState<WeightUnit>('lb')
  const [profileWeightLb] = useState<number | null>(null)
  const [resolvedInventory] = useState<EquipmentInventory>(equipmentPresets.full_gym)

  const mapSession = useCallback((payload: SessionQueryResult): EditableSession => {
    return {
      id: payload.id,
      name: payload.name,
      startedAt: payload.started_at,
      endedAt: payload.ended_at,
      templateId: payload.template_id ?? null,
      userId: payload.user_id ?? null,
      timezone: payload.timezone ?? null,
      bodyWeightLb: payload.body_weight_lb ?? null,
      readiness: payload.session_readiness?.[0] ? {
        sleep_quality: payload.session_readiness[0].sleep_quality,
        muscle_soreness: payload.session_readiness[0].muscle_soreness,
        stress_level: payload.session_readiness[0].stress_level,
        motivation: payload.session_readiness[0].motivation
      } : null,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, index) => ({
          id: exercise.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles,
          metricProfile: exercise.metric_profile,
          orderIndex: exercise.order_index ?? index,
          sets: (exercise.sets ?? [])
            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set, idx) => ({
              id: set.id,
              setNumber: set.set_number ?? idx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              implementCount: set.implement_count ?? '',
              loadType: set.load_type ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              durationSeconds: set.duration_seconds ?? '',
              distance: set.distance ?? '',
              completed: set.completed ?? false,
              performedAt: set.performed_at,
              weightUnit: (set.weight_unit as WeightUnit) ?? 'lb',
              restSecondsActual: set.rest_seconds_actual ?? null
            }))
        }))
    }
  }, [])

  const fetchSession = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('id, user_id, template_id, name, started_at, ended_at, timezone, body_weight_lb, session_readiness(sleep_quality, muscle_soreness, stress_level, motivation), session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, implement_count, load_type, rpe, rir, completed, performed_at, weight_unit, duration_seconds, distance, rest_seconds_actual))')
      .eq('id', sessionId)
      .single()

    if (error) {
      setErrorMessage('Unable to load session details.')
    } else if (data) {
      // Cast data to SessionQueryResult because nested joins are tricky for automatic inference without generated types.
      const typedData = data as unknown as SessionQueryResult
      const mapped = mapSession(typedData)
      setSession(mapped)
      setInitialSnapshot(JSON.stringify(mapped))
    }
    setLoading(false)
  }, [sessionId, supabase, mapSession])

  useEffect(() => { fetchSession() }, [fetchSession])

  const validateSession = () => {
    if (!session) return 'No session to update.'
    if (!session.name.trim()) return 'Session name is required.'
    return null
  }

  const handleSave = async () => {
    if (!session) return
    const validationError = validateSession()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase.from('sessions').update({
        name: session.name,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        status: session.endedAt ? 'completed' : 'in_progress',
        body_weight_lb: session.bodyWeightLb
      }).eq('id', session.id)

      if (error) throw error
      setSuccessMessage('Changes saved.')
      await fetchSession()
    } catch {
      setErrorMessage('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return {
    session,
    setSession,
    loading,
    saving,
    errorMessage,
    setErrorMessage,
    successMessage,
    preferredUnit,
    profileWeightLb,
    resolvedInventory,
    handleSave,
    deletedSetIds,
    setDeletedSetIds,
    deletedExerciseIds,
    setDeletedExerciseIds,
    hasChanges: JSON.stringify(session) !== initialSnapshot || deletedSetIds.length > 0
  }
}
