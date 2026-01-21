'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Dumbbell, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { summarizeTrainingLoad } from '@/lib/training-metrics'
import type { FocusArea, PlanInput } from '@/types/domain'

type TemplateRow = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  experience_level: PlanInput['experienceLevel']
  intensity: PlanInput['intensity']
  created_at: string
  template_inputs: PlanInput | null
}

type SessionRow = {
  id: string
  template_id: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  session_exercises: Array<{
    id: string
    sets: Array<{
      id: string
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      weight_unit: string | null
      failure: boolean | null
      set_type: string | null
      rest_seconds_actual: number | null
    }>
  }>
}

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export default function WorkoutsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingWorkoutIds, setDeletingWorkoutIds] = useState<Record<string, boolean>>({})

  const activeSessionLink = activeSession?.templateId
    ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=workouts`
    : '/dashboard'

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

    const loadTemplates = async () => {
      setLoading(true)
      const session = await ensureSession()
      if (!session) {
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('workout_templates')
        .select('id, title, focus, style, experience_level, intensity, template_inputs, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12)

      if (fetchError) {
        console.error('Failed to load templates', fetchError)
        setError('Unable to load your templates. Please try again.')
        setLoading(false)
        return
      }

      const { data: sessionRows, error: sessionError } = await supabase
        .from('sessions')
        .select('id, template_id, started_at, ended_at, status, session_exercises(id, sets(id, reps, weight, rpe, rir, completed, weight_unit, failure, set_type, rest_seconds_actual))')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(80)

      if (sessionError) {
        console.error('Failed to load sessions', sessionError)
      }

      setTemplates((data as TemplateRow[]) ?? [])
      setSessions((sessionRows as SessionRow[]) ?? [])
      setLoading(false)
    }

    loadTemplates()
  }, [ensureSession, supabase, user, userLoading])

  const focusByTemplateId = useMemo(() => {
    const map = new Map<string, string>()
    templates.forEach((template) => {
      map.set(template.id, template.focus)
    })
    return map
  }, [templates])

  const focusStats = useMemo(() => {
    const totals = new Map<string, { count: number; sets: number }>()
    const now = Date.now()
    const recentWindow = 14 * 24 * 60 * 60 * 1000
    const loadWindow = 7 * 24 * 60 * 60 * 1000

    sessions.forEach((session) => {
      if (!session.template_id) return
      const focus = focusByTemplateId.get(session.template_id)
      if (!focus) return
      const completedAt = session.ended_at ?? session.started_at
      const completedTime = completedAt ? new Date(completedAt).getTime() : 0
      if (!completedTime) return

      const entry = totals.get(focus) ?? { count: 0, sets: 0 }
      if (now - completedTime <= recentWindow) {
        entry.count += 1
      }
      if (now - completedTime <= loadWindow) {
        const sessionSets = session.session_exercises.reduce(
          (sum, exercise) => sum + (exercise.sets?.filter((set) => set.completed !== false).length ?? 0),
          0
        )
        entry.sets += sessionSets
      }
      totals.set(focus, entry)
    })

    return totals
  }, [focusByTemplateId, sessions])

  const trainingLoadSummary = useMemo(() => {
    const mappedSessions = sessions.map((session) => ({
      startedAt: session.started_at,
      endedAt: session.ended_at,
      sets: session.session_exercises.flatMap((exercise) =>
        (exercise.sets ?? [])
          .filter((set) => set.completed !== false)
          .map((set) => ({
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            failure: set.failure ?? null,
            setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
            restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
          }))
      )
    }))
    return summarizeTrainingLoad(mappedSessions)
  }, [sessions])

  const recommendedTemplateId = useMemo(() => {
    if (!templates.length) return null
    const now = Date.now()
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
  }, [focusByTemplateId, focusStats, templates, sessions, trainingLoadSummary.status])

  const handleDeleteTemplate = async (template: TemplateRow) => {
    if (!user) return
    const displayTitle = buildWorkoutDisplayName({
      focus: template.focus,
      style: template.style,
      intensity: template.intensity,
      minutes: template.template_inputs?.time?.minutesPerSession,
      fallback: template.title
    })
    if (!confirm(`Delete "${displayTitle}"? This cannot be undone.`)) return
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
      console.error('Failed to delete template', deleteError)
      setError('Unable to delete this template. Please try again.')
    } finally {
      setDeletingWorkoutIds((prev) => ({ ...prev, [template.id]: false }))
    }
  }

  if (loading || userLoading) {
    return <div className="page-shell p-10 text-center text-muted">Loading workouts...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to manage your workouts.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-subtle">Workouts</p>
            <h1 className="font-display text-3xl font-semibold text-strong">Your training library</h1>
            <p className="mt-2 text-sm text-muted">
              Build templates, preview sessions, and start workouts with smart recommendations.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/generate">
              <Button size="sm">
                <Sparkles className="h-4 w-4" /> Create new plan
              </Button>
            </Link>
          </div>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        {activeSession && (
          <Card className="p-6 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-primary-strong)]">Session in progress</p>
                <p className="text-xs text-subtle">Finish your active session before starting another.</p>
              </div>
              <Link href={activeSessionLink}>
                <Button variant="secondary" size="sm">Resume session</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Dumbbell className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-lg font-semibold text-strong">Templates</h2>
                <p className="text-sm text-muted">Pick a plan, or build a new one from scratch.</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-muted">
                  No templates yet. Generate one to get started.
                </div>
              ) : (
                templates.map((template) => {
                  const isRecommended = recommendedTemplateId === template.id
                  const displayTitle = buildWorkoutDisplayName({
                    focus: template.focus,
                    style: template.style,
                    intensity: template.intensity,
                    minutes: template.template_inputs?.time?.minutesPerSession,
                    fallback: template.title
                  })
                  return (
                    <div key={template.id} className="rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-strong">{displayTitle}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                            {isRecommended && (
                              <span className="badge-accent whitespace-nowrap">Best for Today</span>
                            )}
                            <span>Created {formatDate(template.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Link href={`/workouts/${template.id}/start`}>
                            <Button size="sm">Start</Button>
                          </Link>
                          <Link href={`/workout/${template.id}?from=workouts`}>
                            <Button variant="outline" size="sm">Preview</Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                            onClick={() => handleDeleteTemplate(template)}
                            disabled={Boolean(deletingWorkoutIds[template.id])}
                          >
                            {deletingWorkoutIds[template.id] ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-accent" />
              <div>
                <h2 className="text-lg font-semibold text-strong">Plan builder</h2>
                <p className="text-sm text-muted">Create a template in a few focused steps.</p>
              </div>
            </div>
            <div className="mt-6 space-y-4 text-sm text-muted">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
                <p className="font-semibold text-strong">Build a plan</p>
                <p className="mt-1 text-xs text-subtle">Pick your style, equipment, and schedule to generate a template.</p>
                <Link href="/generate" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent">
                  Build a plan <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
