'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clock, Dumbbell, Plus, Sparkles, Trash2 } from 'lucide-react'
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
              'id, name, template_id, started_at, ended_at, status, minutes_available, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, sets(id, reps, weight, rpe, rir, completed, performed_at, weight_unit))'
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
            metricProfile: (exercise as any).metric_profile,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            performedAt: set.performed_at ?? null,
            durationSeconds: (set as any).duration_seconds ?? null
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

  const handleDeleteTemplate = async (template: TemplateRow) => {
    if (!user) return
    const displayTitle = buildWorkoutDisplayName({
      focus: template.focus,
      style: template.style,
      intensity: template.intensity,
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

  const activeSessionLink = activeSession?.templateId
    ? `/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=dashboard`
    : activeSession?.id 
      ? `/workouts/active?sessionId=${activeSession.id}&from=dashboard`
      : '/dashboard'
      
  const latestActiveSession = useMemo(() => {
     if (activeSession) return activeSession;
     const found = sessions.find(s => s.status === 'in_progress');
     if (found) {
        return {
           id: found.id,
           name: found.name,
           templateId: found.template_id,
           startedAt: found.started_at
        };
     }
     return null;
  }, [activeSession, sessions]);

  const resumeLink = latestActiveSession?.templateId
    ? `/workouts/${latestActiveSession.templateId}/active?sessionId=${latestActiveSession.id}&from=dashboard`
    : latestActiveSession?.id
      ? `/workouts/active?sessionId=${latestActiveSession.id}&from=dashboard`
      : '/dashboard';

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
          const metricProfile = (exercise as any).metric_profile
          tonnage += computeSetTonnage({
            metricProfile,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
          })
          workload += computeSetLoad({
            metricProfile,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null
          })
          hardSets += aggregateHardSets([
            {
              metricProfile,
              reps: set.reps ?? null,
              weight: set.weight ?? null,
              weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
              rpe: typeof set.rpe === 'number' ? set.rpe : null,
              rir: typeof set.rir === 'number' ? set.rir : null
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
          <Link href="/generate">
            <Button variant="secondary" size="sm">
              <Sparkles className="h-4 w-4 mr-2" /> New Plan
            </Button>
          </Link>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        {latestActiveSession && (
          <Card className="p-6 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-primary-strong)]">Session in progress</p>
                <p className="text-xs text-subtle">Finish your active session before starting another.</p>
              </div>
              <Link href={resumeLink}>
                <Button variant="secondary" size="sm">Resume session</Button>
              </Link>
            </div>
          </Card>
        )}

                        <div className="grid grid-cols-1 gap-8">

                          {/* 1. Recommended Session (Primary Action) */}

                          <Card className={`overflow-hidden border-t-4 ${

                            trainingLoadSummary.status === 'balanced' ? 'border-t-[var(--color-success)]' :

                            trainingLoadSummary.status === 'overreaching' ? 'border-t-[var(--color-danger)]' :

                            'border-t-[var(--color-warning)]'

                          }`}>

                            <div className="p-6 md:p-8">

                      <div className="flex items-center gap-3 mb-6">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-sm">

                          <Sparkles className="h-5 w-5" />

                        </div>

                        <div>

                          <h2 className="text-lg font-bold text-strong uppercase tracking-wider">Recommended for you</h2>

                          <p className="text-xs text-muted">Intelligent suggestion based on your training history.</p>

                        </div>

                      </div>

        

                      {recommendedTemplate ? (

                        <div className="group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface)] hover:shadow-md">

                          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

                            <div className="space-y-2">

                              <div className="flex items-center gap-2">

                                <span className="badge-success text-[10px]">Best for Today</span>

                                <p className="text-xl font-bold text-strong">

                                  {buildWorkoutDisplayName({

                                    focus: recommendedTemplate.focus,

                                    style: recommendedTemplate.style,

                                    intensity: recommendedTemplate.intensity,

                                    fallback: recommendedTemplate.title

                                  })}

                                </p>

                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted">

                                <span className="flex items-center gap-1.5">

                                  <Clock className="h-3.5 w-3.5" />

                                  {recommendedTemplate.template_inputs?.time?.minutesPerSession ?? 45} min

                                </span>

                                <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />

                                <span>Created {formatDateTime(recommendedTemplate.created_at)}</span>

                              </div>

                            </div>

                            <div className="flex flex-wrap gap-3">

                              <Link href={`/workout/${recommendedTemplate.id}`}>

                                <Button variant="secondary" className="h-11 px-6">Preview</Button>

                              </Link>

                              <Link href={`/workouts/${recommendedTemplate.id}/start`}>

                                <Button className="h-11 px-8 shadow-lg shadow-[var(--color-primary-soft)]">Start Workout</Button>

                              </Link>

                            </div>

                          </div>

                        </div>

                      ) : (

                        <div className="rounded-2xl border-2 border-dashed border-[var(--color-border)] p-10 text-center">

                          <p className="text-sm text-muted">Build your first plan to unlock daily recommendations.</p>

                          <Link href="/generate" className="mt-4 inline-block">

                            <Button variant="outline" size="sm">Create Plan</Button>

                          </Link>

                        </div>

                      )}

                    </div>

                  </Card>

        

                  {/* 2. Templates (Inventory) */}

                  <Card className="p-6 md:p-8">

                    <div className="flex items-center justify-between mb-8">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-strong">

                          <Dumbbell className="h-5 w-5" />

                        </div>

                        <div>

                          <h2 className="text-lg font-bold text-strong uppercase tracking-wider">Your Templates</h2>

                          <p className="text-xs text-muted">Saved workout structures for quick starts.</p>

                        </div>

                      </div>

                      <Link href="/generate">

                        <Button variant="ghost" size="sm" className="text-accent font-bold">

                          <Plus className="h-4 w-4 mr-1.5" /> New Template

                        </Button>

                      </Link>

                    </div>

        

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                      {templates.length === 0 ? (

                        <div className="col-span-full rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-muted">

                          No templates found.

                        </div>

                      ) : (

                        templates.map((template) => {

                          const isRecommended = recommendedTemplateId === template.id

                          const displayTitle = buildWorkoutDisplayName({

                            focus: template.focus,

                            style: template.style,

                            intensity: template.intensity,

                            fallback: template.title

                          })

                          return (

                            <div key={template.id} className="flex flex-col rounded-xl border border-[var(--color-border)] p-5 transition-all hover:border-[var(--color-primary-border)] hover:bg-[var(--color-surface-subtle)]">

                              <div className="flex-1">

                                <div className="flex items-start justify-between gap-2">

                                  <p className="font-bold text-strong truncate">{displayTitle}</p>

                                  {isRecommended && (

                                    <span className="flex-shrink-0 rounded bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--color-success)] border border-[var(--color-success-border)]">Best</span>

                                  )}

                                </div>

                                <p className="mt-1 text-[10px] text-subtle uppercase font-bold tracking-widest">

                                  {template.style.replace('_', ' ')} · {template.focus}

                                </p>

                              </div>

                              

                              <div className="mt-6 flex items-center justify-between pt-4 border-t border-[var(--color-border)]/50">

                                <div className="flex gap-1.5">

                                  <Link href={`/workouts/${template.id}/start`}>

                                    <Button size="sm" className="h-8 px-3 text-[11px] font-bold">Start</Button>

                                  </Link>

                                  <Link href={`/workout/${template.id}?from=dashboard`}>

                                    <Button variant="secondary" size="sm" className="h-8 px-3 text-[11px] font-bold">Preview</Button>

                                  </Link>

                                </div>

                                <Button

                                  variant="ghost"

                                  size="sm"

                                  className="h-8 w-8 p-0 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"

                                  onClick={() => handleDeleteTemplate(template)}

                                  disabled={Boolean(deletingWorkoutIds[template.id])}

                                >

                                  <Trash2 className="h-3.5 w-3.5" />

                                </Button>

                              </div>

                            </div>

                          )

                        })

                      )}

                    </div>

                  </Card>

        

                  {/* 3. Recent History */}

                  <Card className="p-6 md:p-8">

                    <div className="flex items-center gap-3 mb-8">

                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-strong">

                        <Clock className="h-5 w-5" />

                      </div>

                      <div>

                        <h2 className="text-lg font-bold text-strong uppercase tracking-wider">Recent Activity</h2>

                        <p className="text-xs text-muted">Review your most recent completed sessions.</p>

                      </div>

                    </div>

        

                    <div className="space-y-3">

                      {recentSessions.length === 0 ? (

                        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-muted">

                          No activity history yet.

                        </div>

                      ) : (

                        recentSessions.map((session) => {

                          const template = session.template_id ? templateById.get(session.template_id) : null

                          const sessionTitle = (template && session.name === template.title) 

                            ? buildWorkoutDisplayName({

                                focus: template.focus,

                                style: template.style,

                                intensity: template.intensity,

                                minutes: typeof session.minutes_available === 'number' ? session.minutes_available : null,

                                fallback: session.name,

                                cardioExerciseName: template.style === 'cardio' && session.session_exercises?.[0]?.exercise_name ? session.session_exercises[0].exercise_name : null

                              })

                            : session.name;

                          return (

                            <div key={session.id} className="group flex flex-col gap-4 rounded-xl border border-[var(--color-border)] p-5 transition-all hover:bg-[var(--color-surface-subtle)] md:flex-row md:items-center md:justify-between">

                              <div className="space-y-1">

                                <p className="font-bold text-strong">{sessionTitle}</p>

                                <div className="flex items-center gap-3 text-xs text-subtle">

                                  <span className="font-medium">{formatDateTime(session.started_at)}</span>

                                  <span className="h-1 w-1 rounded-full bg-[var(--color-border)]" />

                                  <span>{formatDuration(session.started_at, session.ended_at)}</span>

                                </div>

                              </div>

                              <Link href={`/sessions/${session.id}/edit`}>

                                <Button size="sm" variant="secondary" className="font-bold group-hover:bg-[var(--color-surface)] group-hover:shadow-sm">Review Logs</Button>

                              </Link>

                            </div>

                          )

                        })

                      )}

                    </div>

                    

                    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">

                      <Link href="/progress" className="text-sm font-bold text-accent hover:underline flex items-center gap-2">

                        View all training history <ArrowRight className="h-4 w-4" />

                      </Link>

                    </div>

                  </Card>

                </div>
      </div>
    </div>
  )
}