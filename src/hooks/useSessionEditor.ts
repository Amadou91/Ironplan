'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { enhanceExerciseData, toMuscleSlug } from '@/lib/muscle-utils'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { normalizePreferences } from '@/lib/preferences'
import { equipmentPresets } from '@/lib/equipment'
import { computeReadinessScore, getReadinessLevel } from '@/lib/training-metrics'
import type { WeightUnit, WorkoutSet, EquipmentInventory, FocusArea, Goal } from '@/types/domain'

export type EditableExercise = {
  id: string
  name: string
  primaryMuscle: string | null
  secondaryMuscles: string[] | null
  metricProfile?: string | null
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

const normalizeNumber = (value: number | '' | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

export function useSessionEditor(sessionId?: string) {
  const supabase = createClient()
  const [session, setSession] = useState<EditableSession | null>(null)
  const [template, setTemplate] = useState<{ focus: FocusArea; style: Goal } | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([])
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('lb')
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)
  const [resolvedInventory, setResolvedInventory] = useState<EquipmentInventory>(equipmentPresets.full_gym)

  const mapSession = useCallback((payload: any): EditableSession => {
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
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise: any, index: number) => ({
          id: exercise.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles,
          metricProfile: exercise.metric_profile,
          orderIndex: exercise.order_index ?? index,
          sets: (exercise.sets ?? [])
            .sort((a: any, b: any) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set: any, idx: number) => ({
              id: set.id,
              setNumber: set.set_number ?? idx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              durationSeconds: set.duration_seconds ?? '',
              distance: set.distance ?? '',
              completed: set.completed ?? false,
              performedAt: set.performed_at,
              weightUnit: (set.weight_unit as WeightUnit) ?? 'lb'
            }))
        }))
    }
  }, [])

  const fetchSession = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('id, user_id, template_id, name, started_at, ended_at, timezone, body_weight_lb, session_readiness(sleep_quality, muscle_soreness, stress_level, motivation), session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, duration_seconds, distance)), template:workout_templates(focus, style)')
      .eq('id', sessionId)
      .single()

    if (error) {
      setErrorMessage('Unable to load session details.')
    } else if (data) {
      const mapped = mapSession(data)
      setSession(mapped)
      if ((data as any).template) setTemplate((data as any).template)
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
    } catch (e) {
      setErrorMessage('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return {
    session,
    setSession,
    template,
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
