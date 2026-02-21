'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import type { SessionExercise, WorkoutSet } from '@/types/domain'
import { getSetOperationQueue, type SetQueueSnapshot, type SetSyncState } from '@/lib/local-first/set-operation-queue'

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

export type SessionSetSyncStatus = {
  state: SetSyncState
  pending: number
  error: number
}

/**
 * Hook for persisting workout sets to the database.
 * Uses a durable local-first queue to survive refresh/crash and flaky network.
 */
export function useSetPersistence() {
  const [isDirectPersisting, setIsDirectPersisting] = useState(false)
  const [directError, setDirectError] = useState<string | null>(null)
  const supabase = useSupabase()
  const queue = useMemo(() => getSetOperationQueue(supabase), [supabase])
  const [queueSnapshot, setQueueSnapshot] = useState<SetQueueSnapshot>(() => queue.getSnapshot())

  useEffect(() => queue.subscribe(setQueueSnapshot), [queue])

  const buildSetPayload = useCallback((exercise: SessionExercise, set: WorkoutSet): SetPayload => {
    return {
      session_exercise_id: exercise.id,
      set_number: set.setNumber,
      reps: (set.reps === '' || set.reps === null) ? null : Number(set.reps),
      weight: (set.weight === '' || set.weight === null) ? null : Number(set.weight),
      implement_count: (set.implementCount === '' || set.implementCount === null) ? null : Number(set.implementCount),
      load_type: set.loadType === 'per_implement' ? 'per_implement' : 'total',
      rpe: (set.rpe === '' || set.rpe === null) ? null : Number(set.rpe),
      rir: (set.rir === '' || set.rir === null) ? null : Number(set.rir),
      completed: set.completed,
      performed_at: set.performedAt ?? new Date().toISOString(),
      weight_unit: set.weightUnit ?? 'lb',
      duration_seconds: (set.durationSeconds === '' || set.durationSeconds === null) ? null : Number(set.durationSeconds),
      distance: (set.distance === '' || set.distance === null) ? null : Number(set.distance),
      distance_unit: set.distanceUnit ?? null,
      rest_seconds_actual: (set.restSecondsActual === null || set.restSecondsActual === undefined) ? null : Number(set.restSecondsActual),
      extras: (set.extras as Record<string, unknown>) ?? {},
      extra_metrics: (set.extraMetrics as Record<string, unknown>) ?? {}
    }
  }, [])

  const getSessionSyncStatus = useCallback((sessionId?: string | null): SessionSetSyncStatus => {
    if (sessionId && queueSnapshot.sessions[sessionId]) {
      return queueSnapshot.sessions[sessionId]
    }
    return {
      state: queueSnapshot.state,
      pending: queueSnapshot.pending,
      error: queueSnapshot.error
    }
  }, [queueSnapshot])

  const persistSet = useCallback(async (
    exercise: SessionExercise,
    set: WorkoutSet
  ): Promise<PersistSetResult> => {
    if (!exercise.id) {
      return { success: false, error: 'Exercise ID is required' }
    }

    try {
      const payload = buildSetPayload(exercise, set)
      const setId = set.id && !set.id.startsWith('temp-') ? set.id : crypto.randomUUID()
      const sessionId = exercise.sessionId

      await queue.enqueueUpsert({
        setId,
        sessionId,
        sessionExerciseId: exercise.id,
        payload
      })

      return {
        success: true,
        id: setId,
        performedAt: payload.performed_at
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error persisting set'
      setDirectError(message)
      return { success: false, error: message }
    }
  }, [buildSetPayload, queue])

  const deleteSet = useCallback(async (
    setId: string,
    context?: { sessionId: string; sessionExerciseId: string }
  ): Promise<PersistSetResult> => {
    if (!setId) return { success: true }

    try {
      if (context?.sessionId && context.sessionExerciseId) {
        await queue.enqueueDelete({
          setId,
          sessionId: context.sessionId,
          sessionExerciseId: context.sessionExerciseId
        })
      } else {
        await queue.cancelSet(setId)
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error deleting set'
      setDirectError(message)
      return { success: false, error: message }
    }
  }, [queue])

  const retrySync = useCallback(async () => {
    await queue.flushNow()
  }, [queue])

  const persistSessionBodyWeight = useCallback(async (
    sessionId: string,
    weightLb: number | null
  ): Promise<PersistSetResult> => {
    setIsDirectPersisting(true)
    setDirectError(null)

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ body_weight_lb: weightLb })
        .eq('id', sessionId)

      if (error) {
        setDirectError(error.message)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error updating body weight'
      setDirectError(message)
      return { success: false, error: message }
    } finally {
      setIsDirectPersisting(false)
    }
  }, [supabase])

  const isPersisting = isDirectPersisting || queueSnapshot.isFlushing
  const lastError = directError ?? queueSnapshot.lastError

  return {
    persistSet,
    deleteSet,
    persistSessionBodyWeight,
    retrySync,
    getSessionSyncStatus,
    isPersisting,
    lastError,
    clearError: () => setDirectError(null)
  }
}
