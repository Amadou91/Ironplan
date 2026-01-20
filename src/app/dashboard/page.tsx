'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { normalizePlanInput } from '@/lib/generator'
import { createWorkoutSession } from '@/lib/session-creation'
import { fetchTemplateHistory } from '@/lib/session-history'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { promptForSessionMinutes } from '@/lib/session-time'
import type { FocusArea, PlanInput } from '@/types/domain'

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '—'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

const getWeekKey = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${week}`
}

type SessionRow = {
  id: string
  name: string
  template_id: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    order_index: number | null
    sets: Array<{
      id: string
      set_number: number | null
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      notes: string | null
      completed: boolean | null
      performed_at: string | null
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

const chartColors = ['#6366f1', '#22c55e', '#0ea5e9', '#f59e0b', '#ec4899']
const SESSION_PAGE_SIZE = 20

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const startSession = useWorkoutStore((state) => state.startSession)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const endSession = useWorkoutStore((state) => state.endSession)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startSessionError, setStartSessionError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedExercise, setSelectedExercise] = useState('all')
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [startingSessionKey, setStartingSessionKey] = useState<string | null>(null)
  const [deletingWorkoutIds, setDeletingWorkoutIds] = useState<Record<string, boolean>>({})
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)
  const hasActiveSession = Boolean(activeSession)
  const activeSessionLink = activeSession?.templateId
    ? `/workout/${activeSession.templateId}?session=active&sessionId=${activeSession.id}&from=dashboard`
    : '/dashboard'

  const ensureSession = async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !data.session) {
      setUser(null)
      setError('Your session has expired. Please sign in again.')
      return null
    }
    return data.session
  }

  useEffect(() => {
    if (userLoading) return
    if (user) return

    const hydrateUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? null })
      }
    }

    hydrateUser()
  }, [supabase, user, userLoading, setUser])

  useEffect(() => {
    if (userLoading) return
    if (!user) return

    setSessions([])
    setSessionPage(0)
    setHasMoreSessions(true)

    const loadSessions = async () => {
      setLoading(true)
      setSessionsLoaded(false)
      const session = await ensureSession()
      if (!session) {
        setLoading(false)
        return
      }
      const startIndex = 0
      const endIndex = SESSION_PAGE_SIZE - 1
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(
          'id, name, template_id, started_at, ended_at, status, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, notes, completed, performed_at))'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .range(startIndex, endIndex)

      if (fetchError) {
        console.error('Failed to load sessions', fetchError)
        if (fetchError.status === 401 || fetchError.status === 403) {
          setUser(null)
          setError('Your session has expired. Please sign in again.')
        } else {
          setError('Unable to load sessions. Please try again.')
        }
      } else {
        const nextSessions = (data as SessionRow[]) ?? []
        setSessions(nextSessions)
        setHasMoreSessions(nextSessions.length === SESSION_PAGE_SIZE)
        setSessionsLoaded(true)
      }
      setLoading(false)
    }

    loadSessions()
  }, [supabase, user, userLoading, setUser])

  useEffect(() => {
    if (userLoading) return
    if (!user) return
    if (sessionPage === 0) return

    const loadMoreSessions = async () => {
      setLoading(true)
      const session = await ensureSession()
      if (!session) {
        setLoading(false)
        return
      }
      const startIndex = sessionPage * SESSION_PAGE_SIZE
      const endIndex = startIndex + SESSION_PAGE_SIZE - 1
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(
          'id, name, template_id, started_at, ended_at, status, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, notes, completed, performed_at))'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .range(startIndex, endIndex)

      if (fetchError) {
        console.error('Failed to load more sessions', fetchError)
        if (fetchError.status === 401 || fetchError.status === 403) {
          setUser(null)
          setError('Your session has expired. Please sign in again.')
        } else {
          setError('Unable to load more sessions. Please try again.')
        }
      } else {
        const nextSessions = (data as SessionRow[]) ?? []
        setSessions((prev) => [...prev, ...nextSessions])
        setHasMoreSessions(nextSessions.length === SESSION_PAGE_SIZE)
      }
      setLoading(false)
    }

    loadMoreSessions()
  }, [sessionPage, supabase, user, userLoading, setUser])

  useEffect(() => {
    if (!sessionsLoaded || !activeSession) return

    const matchedSession = sessions.find((session) => session.id === activeSession.id)
    const isSessionActive = matchedSession
      ? matchedSession.status === 'in_progress' || (!matchedSession.status && !matchedSession.ended_at)
      : false

    if (!isSessionActive) {
      if (!matchedSession) {
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
      } else {
        endSession()
      }
    }
  }, [activeSession, endSession, sessions, sessionsLoaded, supabase])

  useEffect(() => {
    if (userLoading) return
    if (!user) return

    const loadTemplates = async () => {
      const session = await ensureSession()
      if (!session) return
      const { data, error: fetchError } = await supabase
        .from('workout_templates')
        .select('id, title, focus, style, experience_level, intensity, template_inputs, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6)

      if (fetchError) {
        console.error('Failed to load templates', fetchError)
        if (fetchError.status === 401 || fetchError.status === 403) {
          setUser(null)
          setError('Your session has expired. Please sign in again.')
        }
        return
      }
      setTemplates((data as TemplateRow[]) ?? [])
    }

    loadTemplates()
  }, [supabase, user, userLoading, setUser])

  const isLoading = userLoading || loading

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
        const sessionSets = session.session_exercises.reduce((sum, exercise) => sum + (exercise.sets?.length ?? 0), 0)
        entry.sets += sessionSets
      }
      totals.set(focus, entry)
    })

    return totals
  }, [focusByTemplateId, sessions])

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
      const firstTimeBoost = templateSessions.length === 0 ? 8 : 0
      const score = balanceScore + recoveryScore + firstTimeBoost - loadPenalty

      if (score > bestScore) {
        bestScore = score
        bestId = template.id
      }
    })

    return bestId
  }, [focusByTemplateId, focusStats, templates, sessions])

  const handleStartTemplate = async (template: TemplateRow, sessionKey: string) => {
    if (!user) return
    if (hasActiveSession) {
      setStartSessionError('Finish your current session before starting a new one.')
      router.push(activeSessionLink)
      return
    }
    const durationMinutes = promptForSessionMinutes()
    if (!durationMinutes) return
    setStartSessionError(null)
    setStartingSessionKey(sessionKey)
    try {
      const normalizedInputs = normalizePlanInput(template.template_inputs ?? {})
      const history = await fetchTemplateHistory(supabase, template.id)
      const nameSuffix = `${toMuscleLabel(template.focus)} ${template.style.replace('_', ' ')}`
      const { sessionId, startedAt, sessionName, exercises: sessionExercises, impact: sessionImpact } =
        await createWorkoutSession({
          supabase,
          userId: user.id,
          templateId: template.id,
          templateTitle: template.title,
          focus: template.focus,
          goal: template.style,
          input: normalizedInputs,
          minutesAvailable: durationMinutes,
          history,
          nameSuffix
        })
      startSession({
        id: sessionId,
        userId: user.id,
        templateId: template.id,
        name: sessionName,
        startedAt,
        status: 'in_progress',
        impact: sessionImpact,
        exercises: sessionExercises
      })
      router.push(`/workout/${template.id}?session=active&sessionId=${sessionId}&from=dashboard`)
    } catch (startError) {
      console.error('Failed to start scheduled session', startError)
      setStartSessionError('Unable to start the session. Please try again.')
    } finally {
      setStartingSessionKey(null)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return
    if (!confirm('Delete this session and all of its logged sets? This cannot be undone.')) return
    setError(null)
    setDeletingSessionIds(prev => ({ ...prev, [sessionId]: true }))

    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete session', deleteError)
      setError('Unable to delete session. Please try again.')
    } else {
      setSessions(prev => prev.filter(session => session.id !== sessionId))
    }

    setDeletingSessionIds(prev => ({ ...prev, [sessionId]: false }))
  }

  const handleToggleSession = (sessionId: string) => {
    setExpandedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  const handleDeleteTemplate = async (template: TemplateRow) => {
    if (!user) return
    if (!confirm(`Delete "${template.title}"? This will remove the template.`)) return
    setError(null)
    setDeletingWorkoutIds(prev => ({ ...prev, [template.id]: true }))

    try {
      const { error: templateDeleteError } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', template.id)
        .eq('user_id', user.id)

      if (templateDeleteError) {
        throw templateDeleteError
      }

      setTemplates(prev => prev.filter(item => item.id !== template.id))
    } catch (deleteError) {
      console.error('Failed to delete template', deleteError)
      setError('Unable to delete this template. Please try again.')
    } finally {
      setDeletingWorkoutIds(prev => ({ ...prev, [template.id]: false }))
    }
  }

  const muscleOptions = useMemo(() => {
    const muscles = new Set<string>()
    sessions.forEach((session) => {
      session.session_exercises.forEach((exercise) => {
        if (exercise.primary_muscle) muscles.add(exercise.primary_muscle)
        exercise.secondary_muscles?.forEach((muscle) => muscles.add(muscle))
      })
    })
    return Array.from(muscles).sort()
  }, [sessions])

  const exerciseOptions = useMemo(() => {
    const names = new Set<string>()
    sessions.forEach((session) => {
      session.session_exercises.forEach((exercise) => {
        names.add(exercise.exercise_name)
      })
    })
    return Array.from(names).sort()
  }, [sessions])

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const date = new Date(session.started_at)
      if (startDate) {
        const start = new Date(startDate)
        if (!Number.isNaN(start.getTime()) && date < start) return false
      }
      if (endDate) {
        const end = new Date(endDate)
        if (!Number.isNaN(end.getTime()) && date > new Date(end.getTime() + 86400000)) return false
      }
      if (selectedExercise !== 'all') {
        const hasExercise = session.session_exercises.some((exercise) => exercise.exercise_name === selectedExercise)
        if (!hasExercise) return false
      }
      if (selectedMuscle !== 'all') {
        const hasMuscle = session.session_exercises.some((exercise) =>
          exercise.primary_muscle === selectedMuscle || exercise.secondary_muscles?.includes(selectedMuscle)
        )
        if (!hasMuscle) return false
      }
      return true
    })
  }, [sessions, startDate, endDate, selectedExercise, selectedMuscle])

  const allSets = useMemo(() => {
    return filteredSessions.flatMap((session) =>
      session.session_exercises.flatMap((exercise) =>
        (exercise.sets ?? []).map((set) => ({
          sessionId: session.id,
          sessionName: session.name,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          exerciseName: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles ?? [],
          ...set
        }))
      )
    )
  }, [filteredSessions])

  const volumeTrend = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      const key = getWeekKey(set.performed_at ?? set.startedAt)
      totals.set(key, (totals.get(key) ?? 0) + reps * weight)
    })
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
  }, [allSets])

  const effortTrend = useMemo(() => {
    const daily = new Map<string, { total: number; count: number }>()
    allSets.forEach((set) => {
      const raw = typeof set.rpe === 'number' ? set.rpe : typeof set.rir === 'number' ? 10 - set.rir : null
      if (raw === null) return
      const key = formatDate(set.performed_at ?? set.startedAt)
      const current = daily.get(key) ?? { total: 0, count: 0 }
      daily.set(key, { total: current.total + raw, count: current.count + 1 })
    })
    return Array.from(daily.entries()).map(([day, value]) => ({
      day,
      effort: Number((value.total / value.count).toFixed(1))
    }))
  }, [allSets])

  const exerciseTrend = useMemo(() => {
    if (selectedExercise === 'all') return []
    const daily = new Map<string, number>()
    allSets
      .filter((set) => set.exerciseName === selectedExercise)
      .forEach((set) => {
        const reps = set.reps ?? 0
        const weight = set.weight ?? 0
        if (!reps || !weight) return
        const e1rm = weight * (1 + reps / 30)
        const key = formatDate(set.performed_at ?? set.startedAt)
        const current = daily.get(key)
        daily.set(key, Math.max(current ?? 0, e1rm))
      })
    return Array.from(daily.entries()).map(([day, e1rm]) => ({ day, e1rm: Math.round(e1rm) }))
  }, [allSets, selectedExercise])

  const muscleBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      const muscle = set.primaryMuscle ?? 'unknown'
      totals.set(muscle, (totals.get(muscle) ?? 0) + reps * weight)
    })
    return Array.from(totals.entries()).map(([muscle, volume]) => ({ muscle: toMuscleLabel(muscle), volume: Math.round(volume) }))
  }, [allSets])

  const prMetrics = useMemo(() => {
    let maxWeight = 0
    let bestE1rm = 0
    let bestReps = 0
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      maxWeight = Math.max(maxWeight, weight)
      bestReps = Math.max(bestReps, reps)
      const e1rm = weight * (1 + reps / 30)
      bestE1rm = Math.max(bestE1rm, e1rm)
    })
    return {
      maxWeight,
      bestReps,
      bestE1rm: Math.round(bestE1rm)
    }
  }, [allSets])

  const sessionsPerWeek = useMemo(() => {
    const weeks = new Set<string>()
    filteredSessions.forEach((session) => {
      weeks.add(getWeekKey(session.started_at))
    })
    return weeks.size ? Number((filteredSessions.length / weeks.size).toFixed(1)) : 0
  }, [filteredSessions])

  const sessionTotals = (session: SessionRow) => {
    const totals = {
      exercises: session.session_exercises.length,
      sets: 0,
      reps: 0,
      volume: 0
    }
    session.session_exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        totals.sets += 1
        const reps = set.reps ?? 0
        const weight = set.weight ?? 0
        totals.reps += reps
        totals.volume += reps && weight ? reps * weight : 0
      })
    })
    return totals
  }

  if (isLoading) {
    return <div className="page-shell p-10 text-center text-muted">Loading dashboard...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to view your dashboard.</p>
        <Button onClick={() => router.push('/auth/login')}>Go to Login</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-strong">Dashboard</h1>
            <p className="text-sm text-muted">Track your sessions, volume, and progress over time.</p>
          </div>
          <Link href="/generate">
            <Button>Generate New Plan</Button>
          </Link>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}
        {startSessionError && <div className="alert-error p-4 text-sm">{startSessionError}</div>}

        <div className="grid grid-cols-1 gap-6">
          {hasActiveSession && (
            <Card className="p-6 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Session in progress</p>
                  <p className="text-xs text-subtle">Finish your active session before starting another.</p>
                </div>
                <Link href={activeSessionLink}>
                  <Button variant="secondary" size="sm">Resume session</Button>
                </Link>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-strong">Templates</h2>
                <p className="text-sm text-muted">Pick a template and start a new session when you're ready.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-sm text-muted">
                  No templates yet. Generate one to get started.
                </div>
              ) : (
                templates.map((template) => {
                  const sessionKey = `${template.id}-0`
                  const focus = focusByTemplateId.get(template.id)
                  const isRecommended = recommendedTemplateId === template.id
                  return (
                    <div key={template.id} className="rounded-lg border border-[var(--color-border)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-strong">{template.title}</p>
                            {isRecommended && <span className="badge-accent">Best for Today</span>}
                          </div>
                          <p className="text-xs text-subtle">
                            {focus ? `${toMuscleLabel(focus)} focus` : 'Focus not set'} ·{' '}
                            {template.style ? template.style.replace('_', ' ') : 'Goal not set'} · Created {formatDate(template.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStartTemplate(template, sessionKey)}
                            disabled={startingSessionKey === sessionKey || hasActiveSession}
                          >
                            {hasActiveSession
                              ? 'Session Active'
                              : startingSessionKey === sessionKey
                                ? 'Starting...'
                                : 'Start Session'}
                          </Button>
                          <Link href={`/workout/${template.id}?from=dashboard`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600"
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
        </div>

        <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-strong">Filters</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="flex flex-col">
              <label className="text-xs text-subtle">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="input-base mt-1"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-subtle">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="input-base mt-1"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-subtle">Muscle group</label>
              <select
                value={selectedMuscle}
                onChange={(event) => setSelectedMuscle(event.target.value)}
                className="input-base mt-1"
              >
                <option value="all">All</option>
                {muscleOptions.map((muscle) => (
                  <option key={muscle} value={muscle}>
                    {toMuscleLabel(muscle)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-subtle">Exercise</label>
              <select
                value={selectedExercise}
                onChange={(event) => setSelectedExercise(event.target.value)}
                className="input-base mt-1"
              >
                <option value="all">All</option>
                {exerciseOptions.map((exercise) => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Consistency</h3>
            <p className="mt-3 text-3xl font-semibold text-strong">{sessionsPerWeek}</p>
            <p className="text-xs text-subtle">sessions per week</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">PR Snapshot</h3>
            <div className="mt-3 space-y-1 text-sm text-muted">
              <p>Max weight: <span className="text-strong">{prMetrics.maxWeight}</span></p>
              <p>Best reps: <span className="text-strong">{prMetrics.bestReps}</span></p>
              <p>Best e1RM: <span className="text-strong">{prMetrics.bestE1rm}</span></p>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Total Sessions</h3>
            <p className="mt-3 text-3xl font-semibold text-strong">{filteredSessions.length}</p>
            <p className="text-xs text-subtle">in selected range</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Volume by week</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
              <LineChart data={volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" stroke="var(--color-text-subtle)" />
                  <YAxis stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Line type="monotone" dataKey="volume" stroke="var(--color-primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Effort trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
              <LineChart data={effortTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Line type="monotone" dataKey="effort" stroke="var(--color-success)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">e1RM trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
              <LineChart data={exerciseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Line type="monotone" dataKey="e1rm" stroke="var(--color-warning)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
            {selectedExercise === 'all' && (
              <p className="mt-3 text-xs text-subtle">Select an exercise to see e1RM trends.</p>
            )}
          </Card>
          <Card className="p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Muscle group volume</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <PieChart>
                  <Pie data={muscleBreakdown} dataKey="volume" nameKey="muscle" outerRadius={90}>
                    {muscleBreakdown.map((entry, index) => (
                      <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-strong">Previous Sessions</h2>
              <p className="text-xs text-subtle">Review and adjust your most recent training logs.</p>
            </div>
            <span className="text-xs text-subtle">{filteredSessions.length} session(s)</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {filteredSessions.length === 0 ? (
              <div className="p-6 text-sm text-muted">No sessions logged for this range yet.</div>
            ) : (
              filteredSessions.map((session) => {
                const totals = sessionTotals(session)
                const isExpanded = Boolean(expandedSessions[session.id])
                return (
                  <div key={session.id} className="space-y-4 p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-strong">{session.name}</p>
                        <p className="text-xs text-subtle">{formatDateTime(session.started_at)} · {formatDuration(session.started_at, session.ended_at)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="badge-neutral px-3 py-1">{totals.exercises} exercises</span>
                        <span className="badge-neutral px-3 py-1">{totals.sets} sets</span>
                        <span className="badge-neutral px-3 py-1">{totals.reps} reps</span>
                        <span className="badge-neutral px-3 py-1">{Math.round(totals.volume)} volume</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/sessions/${session.id}/edit`}>
                          <Button variant="outline" className="h-8 px-3 text-xs">Edit</Button>
                        </Link>
                        <Button
                          type="button"
                          onClick={() => handleToggleSession(session.id)}
                          className="h-8 px-3 text-xs"
                          variant="secondary"
                        >
                          {isExpanded ? 'Hide details' : 'View details'}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDeleteSession(session.id)}
                          className="h-8 px-3 text-xs border border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                          variant="outline"
                          disabled={Boolean(deletingSessionIds[session.id])}
                        >
                          {deletingSessionIds[session.id] ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {session.session_exercises.map((exercise) => (
                          <div key={exercise.id} className="surface-card-muted p-4 text-xs text-muted">
                            <p className="text-sm font-semibold text-strong">{exercise.exercise_name}</p>
                            <p className="text-subtle">Primary: {exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : '—'}</p>
                            <p className="text-subtle">Secondary: {exercise.secondary_muscles?.length ? exercise.secondary_muscles.map((muscle) => toMuscleLabel(muscle)).join(', ') : '—'}</p>
                            <div className="mt-3 space-y-1">
                              {(exercise.sets ?? []).map((set) => (
                                <div key={set.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-border)] px-2 py-1">
                                  <span>Set {set.set_number ?? '—'}</span>
                                  <span>
                                    {set.weight ?? '—'} lb × {set.reps ?? '—'} reps
                                    {typeof set.rpe === 'number' ? ` · RPE ${set.rpe}` : ''}
                                    {typeof set.rir === 'number' ? ` · RIR ${set.rir}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
          {hasMoreSessions && (
            <div className="border-t border-[var(--color-border)] px-6 py-4">
              <Button
                variant="secondary"
                onClick={() => setSessionPage((prev) => prev + 1)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load more sessions'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
