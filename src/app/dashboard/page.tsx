'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Dumbbell, Sparkles, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { aggregateHardSets, computeSetLoad, computeSetTonnage } from '@/lib/session-metrics'
import { getLoadBasedReadiness, summarizeTrainingLoad } from '@/lib/training-metrics'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import type { FocusArea, PlanInput } from '@/types/domain'

type SessionRow = {
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
    sets: Array<{
      id: string
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      performed_at: string | null
      weight_unit: string | null
      failure: boolean | null
      set_type: string | null
      rest_seconds_actual: number | null
    }>
  }>
}

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

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 'N/A'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'N/A'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
              'id, name, template_id, started_at, ended_at, status, minutes_available, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, sets(id, reps, weight, rpe, rir, completed, performed_at, weight_unit, failure, set_type, rest_seconds_actual))'
            )
            .eq('user_id', user.id)
            .order('started_at', { ascending: false })
            .limit(24),
          supabase
            .from('workout_templates')
            .select('id, title, focus, style, experience_level, intensity, template_inputs, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(6)
        ])

      if (sessionError) {
        console.error('Failed to load sessions', sessionError)
        setError('Unable to load today overview. Please try again.')
      }
      if (templateError) {
        console.error('Failed to load templates', templateError)
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

      if (error) {
        console.error('Failed to refresh active session', error)
        return
      }
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
        exercise.sets
          .filter((set) => set.completed !== false)
          .map((set) => ({
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            failure: set.failure ?? null,
            setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
            performedAt: set.performed_at ?? null,
            restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
          }))
      )
    }))
    return summarizeTrainingLoad(mappedSessions)
  }, [sessions])

  const loadReadiness = useMemo(() => getLoadBasedReadiness(trainingLoadSummary), [trainingLoadSummary])

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

  const activeSessionLink = activeSession?.templateId
    ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=dashboard`
    : '/dashboard'

  const greetingName = user?.email?.split('@')[0] || 'there'
  const recentSessions = sessions.slice(0, 3)
  const recommendedTemplate = templates.find((template) => template.id === recommendedTemplateId) ?? templates[0]

  const weeklyVolume = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    let tonnage = 0
    let hardSets = 0
    let workload = 0
    sessions.forEach((session) => {
      const completedAt = session.ended_at ?? session.started_at
      const completedTime = completedAt ? new Date(completedAt).getTime() : 0
      if (!completedTime || completedTime < cutoff) return
      session.session_exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          if (set.completed === false) return
          tonnage += computeSetTonnage({
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
          })
          workload += computeSetLoad({
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            failure: set.failure ?? null,
            setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
            restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
          })
          hardSets += aggregateHardSets([
            {
              reps: set.reps ?? null,
              weight: set.weight ?? null,
              weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
              rpe: typeof set.rpe === 'number' ? set.rpe : null,
              rir: typeof set.rir === 'number' ? set.rir : null,
              failure: set.failure ?? null,
              setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
              restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
            }
          ])
        })
      })
    })
    return {
      tonnage: Math.round(tonnage),
      hardSets,
      workload: Math.round(workload)
    }
  }, [sessions])

  const coachInsight = useMemo(() => {
    if (!sessions.length) {
      return 'Start your first session to unlock personalized coaching insights.'
    }
    if (trainingLoadSummary.status === 'overreaching') {
      return 'Training load is trending high. Prioritize a lighter session or extra recovery.'
    }
    if (trainingLoadSummary.status === 'undertraining') {
      return 'Load is lighter than usual. Consider a stronger session to drive progress.'
    }
    if (weeklyVolume.hardSets === 0) {
      return 'Log at least one working set this week to keep momentum.'
    }
    if (weeklyVolume.hardSets < 8) {
      return `You are at ${weeklyVolume.hardSets} hard sets. Aim for 10-14 to drive progress.`
    }
    if (weeklyVolume.hardSets > 20) {
      return 'High training load this week. Consider a lighter recovery session next.'
    }
    return 'Strong week so far. Keep your next session focused and controlled.'
  }, [sessions.length, trainingLoadSummary.status, weeklyVolume.hardSets])

  if (userLoading || loading) {
    return <div className="page-shell p-10 text-center text-muted">Loading today...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to view your dashboard.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-subtle">Today</p>
            <h1 className="font-display text-3xl font-semibold text-strong">Welcome back, {greetingName}</h1>
            <p className="mt-2 text-sm text-muted">Ready to train? We have a smart session queued up.</p>
          </div>
          <Link href="/workouts">
            <Button variant="secondary" size="sm">
              Browse workouts
            </Button>
          </Link>
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-strong">Recommended session</h2>
            </div>
            {recommendedTemplate ? (
              <div className="mt-4 rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-strong">
                      {buildWorkoutDisplayName({
                        focus: recommendedTemplate.focus,
                        style: recommendedTemplate.style,
                        intensity: recommendedTemplate.intensity,
                        minutes: recommendedTemplate.template_inputs?.time?.minutesPerSession ?? null,
                        fallback: recommendedTemplate.title
                      })}
                    </p>
                    <p className="text-xs text-subtle">
                      Created {formatDateTime(recommendedTemplate.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/workouts/${recommendedTemplate.id}/start`}>
                      <Button size="sm">Start</Button>
                    </Link>
                    <Link href={`/workout/${recommendedTemplate.id}`}>
                      <Button variant="secondary" size="sm">Preview</Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-5 text-sm text-muted">
                Build your first plan to unlock recommendations.
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-subtle">Weekly volume</p>
                <p className="mt-2 text-2xl font-semibold text-strong">{weeklyVolume.tonnage}</p>
                <p className="text-xs text-subtle">{weeklyVolume.hardSets} hard sets · {weeklyVolume.workload} workload</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-subtle">Recent sessions</p>
                <p className="mt-2 text-2xl font-semibold text-strong">{sessions.length}</p>
                <p className="text-xs text-subtle">sessions logged recently</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs text-subtle">Training load</p>
                <p className="mt-2 text-2xl font-semibold text-strong">{trainingLoadSummary.acuteLoad}</p>
                <p className="text-xs text-subtle">
                  ACR {trainingLoadSummary.loadRatio} · {trainingLoadSummary.status.replace('_', ' ')}
                </p>
                <p className="text-xs text-subtle">Readiness: {loadReadiness}</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm text-muted">
              <p className="text-xs uppercase tracking-[0.2em] text-subtle">Coach insight</p>
              <p className="mt-2 text-sm text-strong">{coachInsight}</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-strong">Quick actions</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <Link href="/generate" className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
                <span>Build a new plan</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/progress" className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
                <span>Review progress</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/profile" className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
                <span>Update profile</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold text-strong">Recent sessions</h2>
            </div>
            <div className="mt-4 space-y-3">
              {recentSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm text-muted">
                  No sessions logged yet. Start a workout to begin tracking.
                </div>
              ) : (
                recentSessions.map((session) => {
                  const template = session.template_id ? templateById.get(session.template_id) : null
                  const sessionTitle = buildWorkoutDisplayName({
                    focus: template?.focus ?? null,
                    style: template?.style ?? null,
                    intensity: template?.intensity ?? null,
                    minutes: session.minutes_available ?? template?.template_inputs?.time?.minutesPerSession ?? null,
                    fallback: session.name
                  })
                  return (
                    <div key={session.id} className="rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-strong">{sessionTitle}</p>
                          <p className="text-xs text-subtle">
                            {formatDateTime(session.started_at)} · {formatDuration(session.started_at, session.ended_at)}
                          </p>
                        </div>
                        <Link href={`/sessions/${session.id}/edit`}>
                          <Button size="sm" variant="secondary">Review</Button>
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-strong">Next up</h2>
            <p className="mt-2 text-sm text-muted">
              Your next best session is ready. Aim to train within the next 24-48 hours for momentum.
            </p>
            {recommendedTemplate ? (
              <Link href={`/workouts/${recommendedTemplate.id}/start`} className="mt-4 inline-flex text-sm font-semibold text-accent">
                Start {buildWorkoutDisplayName({
                  focus: recommendedTemplate.focus,
                  style: recommendedTemplate.style,
                  intensity: recommendedTemplate.intensity,
                  minutes: recommendedTemplate.template_inputs?.time?.minutesPerSession ?? null,
                  fallback: recommendedTemplate.title
                })}
              </Link>
            ) : (
              <Link href="/generate" className="mt-4 inline-flex text-sm font-semibold text-accent">
                Build a plan
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
