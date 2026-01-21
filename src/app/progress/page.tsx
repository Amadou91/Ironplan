'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import {
  aggregateBestE1rm,
  aggregateHardSets,
  aggregateTonnage,
  computeSetE1rm,
  computeSetLoad,
  computeSetTonnage,
  computeWeeklyVolumeByMuscleGroup,
  E1RM_FORMULA_VERSION,
  getEffortScore,
  getWeekKey,
  toWeightInPounds
} from '@/lib/session-metrics'
import { getLoadBasedReadiness, summarizeTrainingLoad } from '@/lib/training-metrics'
import type { FocusArea, PlanInput } from '@/types/domain'

const chartColors = ['#f05a28', '#1f9d55', '#0ea5e9', '#f59e0b', '#ec4899']
const SESSION_PAGE_SIZE = 20

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
  if (!start || !end) return 'N/A'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'N/A'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

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
    order_index: number | null
    sets: Array<{
      id: string
      set_number: number | null
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
      pain_score: number | null
      pain_area: string | null
    }>
  }>
}

type TemplateRow = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
}

export default function ProgressPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedExercise, setSelectedExercise] = useState('all')
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)
  const [creatingManualSession, setCreatingManualSession] = useState(false)

  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates])

  const getSessionTitle = useCallback(
    (session: SessionRow) => {
      const template = session.template_id ? templateById.get(session.template_id) : null
      return buildWorkoutDisplayName({
        focus: template?.focus ?? null,
        style: template?.style ?? null,
        intensity: template?.intensity ?? null,
        minutes: session.minutes_available ?? template?.template_inputs?.time?.minutesPerSession ?? null,
        fallback: session.name
      })
    },
    [templateById]
  )

  const ensureSession = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !data.session) {
      setUser(null)
      setError('Your session has expired. Please sign in again.')
      return null
    }
    return data.session
  }, [setUser, supabase])

  const handleCreateManualSession = useCallback(async () => {
    setCreatingManualSession(true)
    setError(null)
    const session = await ensureSession()
    if (!session) {
      setCreatingManualSession(false)
      return
    }

    try {
      const now = new Date()
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({
          user_id: session.user.id,
          name: 'Manual workout',
          status: 'completed',
          started_at: now.toISOString(),
          ended_at: now.toISOString(),
          timezone
        })
        .select('id')
        .single()

      if (insertError || !data) {
        throw insertError ?? new Error('Failed to create manual session.')
      }

      router.push(`/sessions/${data.id}/edit`)
    } catch (error) {
      console.error('Failed to create manual session', error)
      setError('Unable to create a manual session. Please try again.')
    } finally {
      setCreatingManualSession(false)
    }
  }, [ensureSession, router, supabase])

  useEffect(() => {
    if (userLoading) return
    if (!user) return

    setSessions([])
    setSessionPage(0)
    setHasMoreSessions(true)

    const loadSessions = async () => {
      setSessionsLoaded(false)
      const session = await ensureSession()
      if (!session) return
      setLoading(true)
      setError(null)

      const [{ data: sessionData, error: fetchError }, { data: templateData, error: templateError }] =
        await Promise.all([
          supabase
            .from('sessions')
            .select(
              'id, name, template_id, started_at, ended_at, status, minutes_available, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, failure, set_type, rest_seconds_actual, pain_score, pain_area))'
            )
            .eq('user_id', user.id)
            .order('started_at', { ascending: false })
            .range(0, SESSION_PAGE_SIZE - 1),
          supabase
            .from('workout_templates')
            .select('id, title, focus, style, intensity, template_inputs')
            .eq('user_id', user.id)
        ])

      if (fetchError) {
        console.error('Failed to load sessions', fetchError)
        if (fetchError.status === 401 || fetchError.status === 403) {
          setUser(null)
          setError('Your session has expired. Please sign in again.')
        } else {
          setError('Unable to load sessions. Please try again.')
        }
      } else {
        const nextSessions = (sessionData as SessionRow[]) ?? []
        setSessions(nextSessions)
        setHasMoreSessions(nextSessions.length === SESSION_PAGE_SIZE)
        setSessionsLoaded(true)
      }
      if (templateError) {
        console.error('Failed to load templates', templateError)
      } else {
        setTemplates((templateData as TemplateRow[]) ?? [])
      }
      setLoading(false)
    }

    loadSessions()
  }, [ensureSession, supabase, user, userLoading, setUser])

  useEffect(() => {
    if (userLoading || !user) return
    if (!sessionsLoaded || sessionPage === 0) return

    const loadMoreSessions = async () => {
      const session = await ensureSession()
      if (!session) return
      setLoading(true)
      setError(null)
      const start = sessionPage * SESSION_PAGE_SIZE
      const end = start + SESSION_PAGE_SIZE - 1

      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(
          'id, name, template_id, started_at, ended_at, status, minutes_available, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, failure, set_type, rest_seconds_actual, pain_score, pain_area))'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .range(start, end)

      if (fetchError) {
        console.error('Failed to load more sessions', fetchError)
        setError('Unable to load more sessions. Please try again.')
      } else {
        const nextSessions = (data as SessionRow[]) ?? []
        setSessions((prev) => [...prev, ...nextSessions])
        setHasMoreSessions(nextSessions.length === SESSION_PAGE_SIZE)
      }
      setLoading(false)
    }

    loadMoreSessions()
  }, [ensureSession, sessionPage, sessionsLoaded, supabase, user, userLoading])

  useEffect(() => {
    if (userLoading || !user) return

    const loadProfileWeight = async () => {
      const session = await ensureSession()
      if (!session) return
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('weight_lb')
        .eq('id', session.user.id)
        .maybeSingle()
      if (profileError) {
        console.error('Failed to load profile weight', profileError)
        return
      }
      setProfileWeightLb(typeof data?.weight_lb === 'number' ? data.weight_lb : null)
    }

    loadProfileWeight()
  }, [ensureSession, supabase, user, userLoading])

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
        (exercise.sets ?? []).flatMap((set) =>
          set.completed === false
            ? []
            : [
                {
                  sessionId: session.id,
                  sessionName: getSessionTitle(session),
                  startedAt: session.started_at,
                  endedAt: session.ended_at,
                  exerciseName: exercise.exercise_name,
                  primaryMuscle: exercise.primary_muscle,
                  secondaryMuscles: exercise.secondary_muscles ?? [],
                  ...set
                }
              ]
        )
      )
    )
  }, [filteredSessions, getSessionTitle])

  const volumeTrend = useMemo(() => {
    const totals = new Map<string, { volume: number; load: number }>()
    allSets.forEach((set) => {
      const key = getWeekKey(set.performed_at ?? set.startedAt)
      const tonnage = computeSetTonnage({
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
      })
      const load = computeSetLoad({
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null,
        failure: set.failure ?? null,
        setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
        restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
      })
      if (!tonnage && !load) return
      const entry = totals.get(key) ?? { volume: 0, load: 0 }
      entry.volume += tonnage
      entry.load += load
      totals.set(key, entry)
    })
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, values]) => ({ week, volume: Math.round(values.volume), load: Math.round(values.load) }))
  }, [allSets])

  const effortTrend = useMemo(() => {
    const daily = new Map<string, { total: number; count: number }>()
    allSets.forEach((set) => {
      const raw = getEffortScore({
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null
      })
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
        const e1rm = computeSetE1rm({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
        if (!e1rm) return
        const key = formatDate(set.performed_at ?? set.startedAt)
        const current = daily.get(key)
        daily.set(key, Math.max(current ?? 0, e1rm))
      })
    return Array.from(daily.entries()).map(([day, e1rm]) => ({ day, e1rm: Math.round(e1rm) }))
  }, [allSets, selectedExercise])

  const muscleBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const tonnage = computeSetTonnage({
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
      })
      if (!tonnage) return
      const muscle = set.primaryMuscle ?? 'unknown'
      totals.set(muscle, (totals.get(muscle) ?? 0) + tonnage)
    })
    return Array.from(totals.entries()).map(([muscle, volume]) => ({
      muscle: toMuscleLabel(muscle),
      volume: Math.round(volume)
    }))
  }, [allSets])

  const prMetrics = useMemo(() => {
    let maxWeight = 0
    let bestE1rm = 0
    let bestReps = 0
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      const normalizedWeight = toWeightInPounds(weight, (set.weight_unit as 'lb' | 'kg' | null) ?? null)
      maxWeight = Math.max(maxWeight, normalizedWeight)
      bestReps = Math.max(bestReps, reps)
      const e1rm = computeSetE1rm({
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
      })
      bestE1rm = Math.max(bestE1rm, e1rm)
    })
    return {
      maxWeight,
      bestReps,
      bestE1rm: Math.round(bestE1rm)
    }
  }, [allSets])

  const aggregateMetrics = useMemo(() => {
    const metricSets = allSets.map((set) => ({
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
      rpe: typeof set.rpe === 'number' ? set.rpe : null,
      rir: typeof set.rir === 'number' ? set.rir : null,
      failure: set.failure ?? null,
      setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
      restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
    }))
    const effortTotals = metricSets.reduce(
      (acc, set) => {
        const effort = getEffortScore({ rpe: set.rpe, rir: set.rir })
        if (typeof effort !== 'number') return acc
        acc.total += effort
        acc.count += 1
        return acc
      },
      { total: 0, count: 0 }
    )
    return {
      tonnage: Math.round(aggregateTonnage(metricSets)),
      hardSets: aggregateHardSets(metricSets),
      bestE1rm: Math.round(aggregateBestE1rm(metricSets)),
      workload: Math.round(metricSets.reduce((sum, set) => sum + computeSetLoad(set), 0)),
      avgEffort: effortTotals.count ? Number((effortTotals.total / effortTotals.count).toFixed(1)) : null
    }
  }, [allSets])

  const relativeMetrics = useMemo(() => {
    if (!profileWeightLb || profileWeightLb <= 0) return null
    return {
      tonnagePerBodyweight: aggregateMetrics.tonnage / profileWeightLb,
      bestE1rmRatio: aggregateMetrics.bestE1rm / profileWeightLb,
      maxWeightRatio: prMetrics.maxWeight / profileWeightLb
    }
  }, [aggregateMetrics, prMetrics, profileWeightLb])

  const trainingLoadSummary = useMemo(() => {
    const mappedSessions = filteredSessions.map((session) => ({
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
            performedAt: set.performed_at ?? null,
            restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
          }))
      )
    }))
    return summarizeTrainingLoad(mappedSessions)
  }, [filteredSessions])

  const loadReadiness = useMemo(() => getLoadBasedReadiness(trainingLoadSummary), [trainingLoadSummary])

  const weeklyVolumeByMuscle = useMemo(() => {
    const mappedSessions = filteredSessions.map((session) => ({
      startedAt: session.started_at,
      exercises: session.session_exercises.map((exercise) => ({
        primaryMuscle: exercise.primary_muscle,
        secondaryMuscles: exercise.secondary_muscles ?? [],
        sets: (exercise.sets ?? []).map((set) => ({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        }))
      }))
    }))
    const volumeMap = computeWeeklyVolumeByMuscleGroup(mappedSessions)
    const weeks = Array.from(volumeMap.keys()).sort()
    const latestWeek = weeks[weeks.length - 1]
    const latestMap = latestWeek ? volumeMap.get(latestWeek) : undefined
    const entries = latestMap
      ? Array.from(latestMap.entries()).sort(([, a], [, b]) => b - a)
      : []
    return {
      week: latestWeek ?? 'N/A',
      entries
    }
  }, [filteredSessions])

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
      volume: 0,
      hardSets: 0,
      bestE1rm: 0,
      workload: 0
    }
    session.session_exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.completed === false) return
        totals.sets += 1
        const reps = set.reps ?? 0
        totals.reps += reps
        const tonnage = computeSetTonnage({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
        totals.volume += tonnage
        totals.hardSets += aggregateHardSets([
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
        totals.workload += computeSetLoad({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null,
          failure: set.failure ?? null,
          setType: (set.set_type as 'working' | 'backoff' | 'drop' | 'amrap' | null) ?? null,
          restSecondsActual: typeof set.rest_seconds_actual === 'number' ? set.rest_seconds_actual : null
        })
        totals.bestE1rm = Math.max(
          totals.bestE1rm,
          computeSetE1rm({
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
          })
        )
      })
    })
    return totals
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return
    setDeletingSessionIds((prev) => ({ ...prev, [sessionId]: true }))
    try {
      const { error: deleteError } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)
      if (deleteError) throw deleteError
      setSessions((prev) => prev.filter((session) => session.id !== sessionId))
    } catch (deleteError) {
      console.error('Failed to delete session', deleteError)
      setError('Unable to delete the session. Please try again.')
    } finally {
      setDeletingSessionIds((prev) => ({ ...prev, [sessionId]: false }))
    }
  }

  const handleToggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  const handleResetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedMuscle('all')
    setSelectedExercise('all')
  }

  if (userLoading || loading) {
    return <div className="page-shell p-10 text-center text-muted">Loading progress...</div>
  }

  if (!user) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Sign in to view your progress.</p>
        <Button onClick={() => router.push('/auth/login')}>Sign in</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-subtle">Progress</p>
            <h1 className="font-display text-3xl font-semibold text-strong">Progress and insights</h1>
            <p className="mt-2 text-sm text-muted">
              Monitor training volume, intensity, and patterns across sessions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCreateManualSession} disabled={creatingManualSession}>
              {creatingManualSession ? 'Creating...' : 'Log past workout'}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Reset filters
            </Button>
          </div>
        </div>

        {error && <div className="alert-error p-4 text-sm">{error}</div>}

        <Card className="p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Filters</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
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
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Consistency</h3>
            <p className="mt-3 text-3xl font-semibold text-strong">{sessionsPerWeek}</p>
            <p className="text-xs text-subtle">sessions per week</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">PR Snapshot</h3>
            <div className="mt-3 space-y-1 text-sm text-muted">
              <p>Max weight (lb): <span className="text-strong">{prMetrics.maxWeight}</span></p>
              <p>Best reps: <span className="text-strong">{prMetrics.bestReps}</span></p>
              <p>Best e1RM ({E1RM_FORMULA_VERSION}): <span className="text-strong">{prMetrics.bestE1rm}</span></p>
              {relativeMetrics && (
                <>
                  <p>Max / bodyweight: <span className="text-strong">{relativeMetrics.maxWeightRatio.toFixed(2)}x</span></p>
                  <p>e1RM / bodyweight: <span className="text-strong">{relativeMetrics.bestE1rmRatio.toFixed(2)}x</span></p>
                </>
              )}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Volume Summary</h3>
            <div className="mt-3 space-y-1 text-sm text-muted">
              <p>Total tonnage: <span className="text-strong">{aggregateMetrics.tonnage}</span></p>
              <p>Hard sets: <span className="text-strong">{aggregateMetrics.hardSets}</span></p>
              <p>Best e1RM: <span className="text-strong">{aggregateMetrics.bestE1rm}</span></p>
              <p>Workload: <span className="text-strong">{aggregateMetrics.workload}</span></p>
              <p>Avg effort: <span className="text-strong">{aggregateMetrics.avgEffort ?? 'N/A'}</span></p>
              {relativeMetrics && (
                <p>Tonnage / bodyweight: <span className="text-strong">{relativeMetrics.tonnagePerBodyweight.toFixed(1)}</span></p>
              )}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Training Load</h3>
            <p className="mt-3 text-3xl font-semibold text-strong">{trainingLoadSummary.acuteLoad}</p>
            <p className="text-xs text-subtle">
              ACR {trainingLoadSummary.loadRatio} · {trainingLoadSummary.status.replace('_', ' ')}
            </p>
            <p className="text-xs text-subtle">Readiness: {loadReadiness}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Total Sessions</h3>
            <p className="mt-3 text-3xl font-semibold text-strong">{filteredSessions.length}</p>
            <p className="text-xs text-subtle">in selected range</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Volume & load by week</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <LineChart data={volumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" stroke="var(--color-text-subtle)" />
                  <YAxis stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Legend />
                  <Line type="monotone" dataKey="volume" stroke="var(--color-primary)" strokeWidth={2} />
                  <Line type="monotone" dataKey="load" stroke="var(--color-warning)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-subtle">
              Latest load: {trainingLoadSummary.weeklyLoadTrend.at(-1)?.load ?? 'N/A'}
            </p>
          </Card>

          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Effort trend</h3>
            <div className="h-64 w-full">
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
          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">e1RM trend</h3>
            <div className="h-64 w-full">
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

          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Muscle group volume</h3>
            <div className="h-64 w-full">
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
            <div className="mt-4 space-y-1 text-xs text-muted">
              <p className="text-[10px] uppercase tracking-wider text-subtle">Latest week ({weeklyVolumeByMuscle.week})</p>
              {weeklyVolumeByMuscle.entries.length === 0 ? (
                <p className="text-subtle">No tonnage logged this week yet.</p>
              ) : (
                weeklyVolumeByMuscle.entries.slice(0, 5).map(([muscle, volume]) => (
                  <div key={muscle} className="flex items-center justify-between">
                    <span>{toMuscleLabel(muscle)}</span>
                    <span className="text-strong">{Math.round(volume)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-strong">Previous Sessions</h2>
              <p className="text-xs text-subtle">Review and adjust your training logs.</p>
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
                        <p className="text-sm font-semibold text-strong">{getSessionTitle(session)}</p>
                        <p className="text-xs text-subtle">
                          {formatDateTime(session.started_at)} · {formatDuration(session.started_at, session.ended_at)}
                          {session.timezone ? ` · ${session.timezone}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="badge-neutral px-3 py-1">{totals.exercises} exercises</span>
                        <span className="badge-neutral px-3 py-1">{totals.sets} sets</span>
                        <span className="badge-neutral px-3 py-1">{totals.reps} reps</span>
                        <span className="badge-neutral px-3 py-1">{Math.round(totals.volume)} tonnage</span>
                        <span className="badge-neutral px-3 py-1">{Math.round(totals.workload)} workload</span>
                        <span className="badge-neutral px-3 py-1">{totals.hardSets} hard sets</span>
                        <span className="badge-neutral px-3 py-1">{Math.round(totals.bestE1rm)} e1RM</span>
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
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          {session.session_exercises.map((exercise) => (
                            <div key={exercise.id} className="surface-card-muted p-4 text-xs text-muted">
                              <p className="text-sm font-semibold text-strong">{exercise.exercise_name}</p>
                              <p className="text-subtle">Primary: {exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'N/A'}</p>
                              <p className="text-subtle">Secondary: {exercise.secondary_muscles?.length ? exercise.secondary_muscles.map((muscle) => toMuscleLabel(muscle)).join(', ') : 'N/A'}</p>
                              <div className="mt-3 space-y-2">
                                {(exercise.sets ?? []).map((set) => (
                                  <div key={set.id} className="rounded border border-[var(--color-border)] px-2 py-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span>Set {set.set_number ?? 'N/A'}</span>
                                      <span>
                                        {set.weight ?? 'N/A'} {set.weight_unit ?? 'lb'} × {set.reps ?? 'N/A'} reps
                                        {typeof set.rpe === 'number' ? ` · RPE ${set.rpe}` : ''}
                                        {typeof set.rir === 'number' ? ` · RIR ${set.rir}` : ''}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid gap-2 text-[10px] text-subtle sm:grid-cols-2">
                                      <span>Completed: {set.completed ? 'Yes' : 'No'}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
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
