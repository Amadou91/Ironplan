'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { summarizeTrainingLoad } from '@/lib/training-metrics'
import type { FocusArea, PlanInput, MetricProfile } from '@/types/domain'

export type SessionRow = {
  id: string
  name: string
  template_id: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  minutes_available?: number | null
  timezone?: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    metric_profile?: string | null
    sets: Array<{
      id: string
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      performed_at: string | null
      weight_unit: string | null
      duration_seconds?: number | null
    }>
  }>
}

export type TemplateRow = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  experience_level: PlanInput['experienceLevel']
  intensity: PlanInput['intensity']
  created_at: string
  template_inputs: PlanInput | null
}

export function useDashboardData() {
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingWorkoutIds, setDeletingWorkoutIds] = useState<Record<string, boolean>>({})

  const ensureSession = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !data.session) {
      setUser(null)
      setError('Your session has expired. Please sign in again.')
      return null
    }
    return data.session
  }, [setUser, supabase])

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      setLoading(false)
      return
    }

    const loadTodayData = async () => {
      setLoading(true)
      const session = await ensureSession()
      if (!session) {
        setLoading(false)
        return
      }

      const [{ data: sessionRows, error: sessionError }, { data: templateRows, error: templateError }] =
        await Promise.all([
          supabase
            .from('sessions')
            .select(
              'id, name, template_id, started_at, ended_at, status, minutes_available, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, sets(id, reps, weight, rpe, rir, completed, performed_at, weight_unit, duration_seconds))'
            )
            .eq('user_id', user.id)
            .order('started_at', { ascending: false })
            .limit(24),
          supabase
            .from('workout_templates')
            .select('id, title, focus, style, experience_level, intensity, template_inputs, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(12)
        ])

      if (sessionError) {
        console.error('Failed to load sessions', sessionError)
        setError('Unable to load today overview. Please try again.')
      }
      setSessions((sessionRows as SessionRow[]) ?? [])
      setTemplates((templateRows as TemplateRow[]) ?? [])
      setLoading(false)
    }

    loadTodayData()
  }, [ensureSession, supabase, user, userLoading])

  useEffect(() => {
    if (!activeSession || !user) return
    const refreshStatus = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, status, ended_at')
        .eq('id', activeSession.id)
        .maybeSingle()

      if (error) return
      if (!data) {
        endSession()
        return
      }
      const stillActive = data.status === 'in_progress' || (!data.status && !data.ended_at)
      if (!stillActive) {
        endSession()
      }
    }
    refreshStatus()
  }, [activeSession, endSession, supabase, user])

  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates])

  const focusByTemplateId = useMemo(() => {
    const map = new Map<string, string>()
    templates.forEach((template) => {
      map.set(template.id, template.focus)
    })
    return map
  }, [templates])

  const trainingLoadSummary = useMemo(() => {
    const mappedSessions = sessions.map((session) => ({
      startedAt: session.started_at,
      endedAt: session.ended_at,
      sets: session.session_exercises.flatMap((exercise) =>
        exercise.sets
          .filter((set) => set.completed !== false)
          .map((set) => ({
            metricProfile: (exercise.metric_profile as MetricProfile) ?? undefined,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            performedAt: set.performed_at ?? null,
            durationSeconds: set.duration_seconds ?? null
          }))
      )
    }))
    return summarizeTrainingLoad(mappedSessions)
  }, [sessions])

  const recommendedTemplateId = useMemo(() => {
    if (!templates.length) return null
    const now = Date.now()
    const recentWindow = 14 * 24 * 60 * 60 * 1000
    const loadWindow = 7 * 24 * 60 * 60 * 1000

    const focusStats = new Map<string, { count: number; sets: number }>()
    sessions.forEach((session) => {
      if (!session.template_id) return
      const focus = focusByTemplateId.get(session.template_id)
      if (!focus) return
      const completedAt = session.ended_at ?? session.started_at
      const completedTime = completedAt ? new Date(completedAt).getTime() : 0
      if (!completedTime) return

      const entry = focusStats.get(focus) ?? { count: 0, sets: 0 }
      if (now - completedTime <= recentWindow) entry.count += 1
      if (now - completedTime <= loadWindow) {
        const sessionSets = session.session_exercises.reduce(
          (sum, exercise) => sum + (exercise.sets?.filter((set) => set.completed !== false).length ?? 0),
          0
        )
        entry.sets += sessionSets
      }
      focusStats.set(focus, entry)
    })

    let bestId: string | null = null
    let bestScore = -Infinity

    templates.forEach((template) => {
      const focus = focusByTemplateId.get(template.id) ?? 'full_body'
      const templateSessions = sessions.filter(
        (session) => session.template_id === template.id && (session.status === 'completed' || session.ended_at)
      )
      const lastCompletedAt = templateSessions.reduce((latest, session) => {
        const completedAt = session.ended_at ?? session.started_at
        const timestamp = completedAt ? new Date(completedAt).getTime() : 0
        return timestamp > latest ? timestamp : latest
      }, 0)
      const daysSince = lastCompletedAt ? Math.max(0, (now - lastCompletedAt) / 86400000) : 30
      const focusEntry = focusStats.get(focus)
      const recentCount = focusEntry?.count ?? 0
      const recentSets = focusEntry?.sets ?? 0

      const balanceScore = Math.max(0, 6 - recentCount) * 4
      const recoveryScore = Math.min(daysSince, 14) * 3
      const loadPenalty = Math.min(recentSets / 4, 20)
      const loadStatus = trainingLoadSummary.status
      const intensityScore = template.intensity === 'high' ? 3 : template.intensity === 'low' ? 1 : 2
      const loadAdjustment =
        loadStatus === 'overreaching'
          ? (intensityScore === 3 ? -6 : intensityScore === 1 ? 4 : 0)
          : loadStatus === 'undertraining'
            ? (intensityScore === 3 ? 4 : intensityScore === 1 ? -2 : 0)
            : 0
      const firstTimeBoost = templateSessions.length === 0 ? 8 : 0
      const score = balanceScore + recoveryScore + firstTimeBoost - loadPenalty + loadAdjustment

      if (score > bestScore) {
        bestScore = score
        bestId = template.id
      }
    })

    return bestId
  }, [focusByTemplateId, templates, sessions, trainingLoadSummary.status])

  const handleDeleteTemplate = async (template: TemplateRow) => {
    if (!user) return
    setDeletingWorkoutIds((prev) => ({ ...prev, [template.id]: true }))
    try {
      const { error: deleteError } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', template.id)
        .eq('user_id', user.id)
      if (deleteError) throw deleteError
      setTemplates((prev) => prev.filter((item) => item.id !== template.id))
    } catch (deleteError) {
      setError('Unable to delete this template. Please try again.')
    } finally {
      setDeletingWorkoutIds((prev) => ({ ...prev, [template.id]: false }))
    }
  }

  return {
    user,
    userLoading,
    sessions,
    templates,
    loading,
    error,
    deletingWorkoutIds,
    templateById,
    trainingLoadSummary,
    recommendedTemplateId,
    handleDeleteTemplate
  }
}
