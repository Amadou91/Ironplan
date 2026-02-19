import { useState, useCallback, useEffect } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { parseWithFallback, sessionQueryResultSchema } from '@/lib/validation/schemas'
import { mapSessionPayload, type SessionPayload } from '@/lib/session-mapper'

export function useSessionLoader(sessionId: string) {
  const supabase = useSupabase()
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [durationMinutes, setDurationMinutes] = useState(45)

  const loadSession = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setLoadError(null)

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, user_id, name, template_id, session_focus, session_goal, session_intensity, 
          started_at, ended_at, status, body_weight_lb, session_notes,
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

      if (error) throw error
      if (!data) throw new Error('Session not found')

      const payload = parseWithFallback(sessionQueryResultSchema, data, 'session edit') as SessionPayload
      const session = mapSessionPayload(payload)

      // Calculate original duration
      if (payload.started_at && payload.ended_at) {
        const start = new Date(payload.started_at).getTime()
        const end = new Date(payload.ended_at).getTime()
        const mins = Math.round((end - start) / 60000)
        if (mins > 0) setDurationMinutes(mins)
      }

      startSession(session)
    } catch (err) {
      const errorDetails = err && typeof err === 'object'
        ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
        : String(err)
      console.error('Failed to load session:', errorDetails)
      setLoadError('Unable to load session for editing.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, supabase, startSession])

  // Load session on mount (only if not already in store with matching ID)
  useEffect(() => {
    if (activeSession?.id === sessionId) {
      setLoading(false)
      // Recalculate duration if possible, otherwise keep default
      if (activeSession.startedAt && activeSession.endedAt) {
          const start = new Date(activeSession.startedAt).getTime()
          const end = new Date(activeSession.endedAt).getTime()
          const mins = Math.round((end - start) / 60000)
          if (mins > 0) setDurationMinutes(mins)
      }
      return
    }
    loadSession()
  }, [sessionId, activeSession?.id, activeSession?.startedAt, activeSession?.endedAt, loadSession])

  return {
    loading,
    loadError,
    durationMinutes
  }
}
