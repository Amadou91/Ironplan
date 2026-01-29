'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SessionExercise, WorkoutSet, WeightUnit, LoadType } from '@/types/domain'

type SetPayload = {
  session_exercise_id: string
  set_number: number
  reps: number | null
  weight: number | null
  implement_count: number | null
  load_type: string
  rpe: number | null
  rir: number | null
  completed: boolean
  performed_at: string
  weight_unit: string
  duration_seconds: number | null
  distance: number | null
  distance_unit: string | null
  rest_seconds_actual: number | null
  extras: Record<string, unknown>
  extra_metrics: Record<string, unknown>
}

export type PersistSetResult = {
  success: boolean
  id?: string
  performedAt?: string
  error?: string
}

/**
 * Hook for persisting workout sets to the database.
 * Handles both insert (new sets) and update (existing sets) operations.
 */
export function useSetPersistence() {
  const [isPersisting, setIsPersisting] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const supabase = createClient()

  const buildSetPayload = useCallback((exercise: SessionExercise, set: WorkoutSet): SetPayload => {
    return {
      session_exercise_id: exercise.id,
      set_number: set.setNumber,
      reps: set.reps === '' ? null : Number(set.reps),
      weight: set.weight === '' ? null : Number(set.weight),
      implement_count: set.implementCount === '' ? null : (typeof set.implementCount === 'number' ? set.implementCount : null),
      load_type: set.loadType === 'per_implement' ? 'per_implement' : 'total',
      rpe: set.rpe === '' ? null : Number(set.rpe),
      rir: set.rir === '' ? null : Number(set.rir),
      completed: set.completed,
      performed_at: set.performedAt ?? new Date().toISOString(),
      weight_unit: set.weightUnit ?? 'lb',
      duration_seconds: set.durationSeconds === '' ? null : (typeof set.durationSeconds === 'number' ? set.durationSeconds : null),
      distance: set.distance === '' ? null : (typeof set.distance === 'number' ? set.distance : null),
      distance_unit: set.distanceUnit ?? null,
      rest_seconds_actual: typeof set.restSecondsActual === 'number' ? set.restSecondsActual : null,
      extras: (set.extras as Record<string, unknown>) ?? {},
      extra_metrics: (set.extraMetrics as Record<string, unknown>) ?? {}
    }
  }, [])

  const persistSet = useCallback(async (
    exercise: SessionExercise,
    set: WorkoutSet
  ): Promise<PersistSetResult> => {
    if (!exercise.id) {
      return { success: false, error: 'Exercise ID is required' }
    }

    setIsPersisting(true)
    setLastError(null)

    try {
      const payload = buildSetPayload(exercise, set)
      const isNewSet = !set.id || set.id.startsWith('temp-')

      if (isNewSet) {
        const { data, error } = await supabase
          .from('sets')
          .insert(payload)
          .select('id, performed_at')
          .single()

        if (error) {
          setLastError(error.message)
          return { success: false, error: error.message }
        }

        return {
          success: true,
          id: data.id,
          performedAt: data.performed_at
        }
      } else {
        const { error } = await supabase
          .from('sets')
          .update(payload)
          .eq('id', set.id)

        if (error) {
          setLastError(error.message)
          return { success: false, error: error.message }
        }

        return { success: true }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error persisting set'
      setLastError(message)
      return { success: false, error: message }
    } finally {
      setIsPersisting(false)
    }
  }, [buildSetPayload, supabase])

  const deleteSet = useCallback(async (setId: string): Promise<PersistSetResult> => {
    if (!setId || setId.startsWith('temp-')) {
      return { success: true } // Nothing to delete
    }

    setIsPersisting(true)
    setLastError(null)

    try {
      const { error } = await supabase.from('sets').delete().eq('id', setId)

      if (error) {
        setLastError(error.message)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error deleting set'
      setLastError(message)
      return { success: false, error: message }
    } finally {
      setIsPersisting(false)
    }
  }, [supabase])

  const persistSessionBodyWeight = useCallback(async (
    sessionId: string,
    weightLb: number | null
  ): Promise<PersistSetResult> => {
    setIsPersisting(true)
    setLastError(null)

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ body_weight_lb: weightLb })
        .eq('id', sessionId)

      if (error) {
        setLastError(error.message)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating body weight'
      setLastError(message)
      return { success: false, error: message }
    } finally {
      setIsPersisting(false)
    }
  }, [supabase])

  return {
    persistSet,
    deleteSet,
    persistSessionBodyWeight,
    isPersisting,
    lastError,
    clearError: () => setLastError(null)
  }
}
