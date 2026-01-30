'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { normalizePreferences } from '@/lib/preferences'
import { convertWeight, roundWeight } from '@/lib/units'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { sessionQueryResultSchema, safeParseSingle } from '@/lib/validation/schemas'
import type { WeightUnit, WorkoutSession, MetricProfile, LoadType } from '@/types/domain'

type SessionPayload = {
  id: string
  user_id: string | null
  name: string
  template_id: string | null
  session_focus?: string | null
  session_goal?: string | null
  session_intensity?: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  body_weight_lb?: number | null
  session_notes?: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    metric_profile: string | null
    order_index: number | null
    sets: Array<{
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
      distance_unit: string | null
      rest_seconds_actual: number | null
      extras: Record<string, unknown> | null
      extra_metrics: Record<string, unknown> | null
    }>
  }>
}

/**
 * Hook for fetching and hydrating workout sessions from Supabase.
 * Handles session loading, profile preferences, and unit conversion.
 */
export function useSessionFetcher(sessionId?: string | null) {
  const { activeSession, startSession, updateSession } = useWorkoutStore()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)
  const [sessionBodyWeight, setSessionBodyWeight] = useState<string>('')
  
  const supabase = createClient()
  const preferredUnit = activeSession?.weightUnit ?? 'lb'

  const mapSession = useCallback((payload: SessionPayload, unit: WeightUnit): WorkoutSession => {
    if (payload.body_weight_lb) {
      const displayWeight = unit === 'kg' 
        ? roundWeight(convertWeight(payload.body_weight_lb, 'lb', 'kg')) 
        : payload.body_weight_lb
      setSessionBodyWeight(String(displayWeight))
    }
    
    return {
      id: payload.id,
      userId: payload.user_id ?? '',
      templateId: payload.template_id ?? undefined,
      name: payload.name,
      sessionFocus: (payload.session_focus as WorkoutSession['sessionFocus']) ?? null,
      sessionGoal: (payload.session_goal as WorkoutSession['sessionGoal']) ?? null,
      sessionIntensity: (payload.session_intensity as WorkoutSession['sessionIntensity']) ?? null,
      startedAt: payload.started_at,
      endedAt: payload.ended_at ?? undefined,
      status: (payload.status as WorkoutSession['status']) ?? 'in_progress',
      sessionNotes: payload.session_notes ?? undefined,
      bodyWeightLb: payload.body_weight_lb ?? null,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, idx) => ({
          id: exercise.id,
          sessionId: payload.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
          secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
          metricProfile: (exercise.metric_profile as MetricProfile) ?? undefined,
          orderIndex: exercise.order_index ?? idx,
          sets: (exercise.sets ?? [])
            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set, setIdx) => ({
              id: set.id,
              setNumber: set.set_number ?? setIdx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              implementCount: set.implement_count ?? '',
              loadType: (set.load_type as LoadType | null) ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              performedAt: set.performed_at ?? undefined,
              completed: set.completed ?? false,
              weightUnit: (set.weight_unit as WeightUnit) ?? 'lb',
              durationSeconds: set.duration_seconds ?? undefined,
              distance: set.distance ?? undefined,
              distanceUnit: set.distance_unit ?? undefined,
              restSecondsActual: set.rest_seconds_actual ?? undefined,
              extras: set.extras as Record<string, string | null> ?? undefined,
              extraMetrics: set.extra_metrics ?? undefined
            }))
        }))
    }
  }, [])

  // Fetch session from database
  useEffect(() => {
    if (activeSession || !sessionId) return
    
    const fetchSession = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, user_id, name, template_id, session_focus, session_goal, session_intensity, started_at, ended_at, status, 
          body_weight_lb, session_notes,
          session_exercises(
            id, exercise_name, primary_muscle, secondary_muscles, 
            metric_profile, order_index,
            sets(
              id, set_number, reps, weight, implement_count, load_type, 
              rpe, rir, completed, performed_at, weight_unit, 
              duration_seconds, distance, distance_unit, rest_seconds_actual, 
              extras, extra_metrics
            )
          )
        `)
        .eq('id', sessionId)
        .single()

      if (error) {
        setErrorMessage('Unable to load the active session.')
        setLoading(false)
        return
      }

      // Validate the response
      const validated = safeParseSingle(sessionQueryResultSchema, data, 'session fetch')
      if (!validated) {
        setErrorMessage('Session data is invalid.')
        setLoading(false)
        return
      }

      if (validated.status && validated.status !== 'in_progress') {
        setErrorMessage('This session is no longer active.')
        setLoading(false)
        return
      }

      startSession(mapSession(validated as SessionPayload, preferredUnit))
      setLoading(false)
    }
    
    fetchSession()
  }, [activeSession, mapSession, preferredUnit, sessionId, startSession, supabase])

  // Load profile preferences
  useEffect(() => {
    if (!activeSession?.userId) return
    
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('weight_lb, preferences')
        .eq('id', activeSession.userId)
        .maybeSingle()
      
      setProfileWeightLb(data?.weight_lb ?? null)
      
      if (!activeSession?.weightUnit) {
        const normalized = normalizePreferences(data?.preferences)
        updateSession({ weightUnit: normalized.settings?.units ?? 'lb' })
      }
    }
    
    loadProfile()
  }, [activeSession?.userId, activeSession?.weightUnit, updateSession, supabase])

  const togglePreferredUnit = useCallback(() => {
    const nextUnit = preferredUnit === 'lb' ? 'kg' : 'lb'
    updateSession({ weightUnit: nextUnit })

    if (sessionBodyWeight) {
      const val = parseFloat(sessionBodyWeight)
      if (!isNaN(val)) {
        const converted = roundWeight(convertWeight(val, preferredUnit, nextUnit))
        setSessionBodyWeight(String(converted))
      }
    }
  }, [preferredUnit, sessionBodyWeight, updateSession])

  return {
    loading,
    errorMessage,
    setErrorMessage,
    profileWeightLb,
    sessionBodyWeight,
    setSessionBodyWeight,
    preferredUnit,
    togglePreferredUnit
  }
}
