'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel, PRESET_MAPPINGS, isMuscleMatch } from '@/lib/muscle-utils'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import {
  aggregateHardSets,
  aggregateTonnage,
  computeSetE1rm,
  computeSetLoad,
  computeSetTonnage,
  E1RM_FORMULA_VERSION,
  getEffortScore,
  getWeekKey,
  toWeightInPounds
} from '@/lib/session-metrics'
import { computeSessionMetrics, getLoadBasedReadiness, summarizeTrainingLoad } from '@/lib/training-metrics'
import type { FocusArea, Goal, PlanInput } from '@/types/domain'

const chartColors = ['#f05a28', '#1f9d55', '#0ea5e9', '#f59e0b', '#ec4899']
const SESSION_PAGE_SIZE = 20

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate())

const formatDateForInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createPastRange = (days: number) => {
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(today.getDate() - (days - 1))
  return { start, end: today }
}

type DateRangePreset = {
  label: string
  getRange: () => { start: Date; end: Date }
}

const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    getRange: () => {
      const today = startOfDay(new Date())
      return { start: today, end: today }
    }
  },
  {
    label: 'Last 7 days',
    getRange: () => createPastRange(7)
  },
  {
    label: 'Last 30 days',
    getRange: () => createPastRange(30)
  },
  {
    label: 'Last 90 days',
    getRange: () => createPastRange(90)
  },
  {
    label: 'This month',
    getRange: () => {
      const today = startOfDay(new Date())
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start, end: today }
    }
  }
]

const MUSCLE_TARGET_DISTRIBUTION: Record<string, number> = {
  chest: 12,
  back: 18,
  shoulders: 8,
  quads: 20,
  hamstrings: 15,
  glutes: 12,
  biceps: 4,
  triceps: 4,
  core: 5,
  calves: 2
}

const MUSCLE_PRESETS = [
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Legs', value: 'legs' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' }
]

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
  body_weight_lb?: number | null
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

type ReadinessRow = {
  id: string
  session_id: string
  recorded_at: string
  sleep_quality: number
  muscle_soreness: number
  stress_level: number
  motivation: number
  readiness_score: number | null
  readiness_level: 'low' | 'steady' | 'high' | null
}

export default function ProgressPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [readinessEntries, setReadinessEntries] = useState<ReadinessRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedExercise, setSelectedExercise] = useState('all')
  const [muscleVizMode, setMuscleVizMode] = useState<'absolute' | 'relative' | 'index'>('absolute')
  const [activeDatePreset, setActiveDatePreset] = useState<string | null>(null)
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)
  const [creatingManualSession, setCreatingManualSession] = useState(false)
  const [bodyWeightHistory, setBodyWeightHistory] = useState<Array<{ recorded_at: string; weight_lb: number }>>([])

  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates])
  const exerciseLibraryByName = useMemo(
    () =>
      new Map(
        EXERCISE_LIBRARY.filter((e) => e.name).map((exercise) => [exercise.name.toLowerCase(), exercise])
      ),
    []
  )

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
              'id, name, template_id, started_at, ended_at, status, minutes_available, body_weight_lb, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit))'
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err = fetchError as any
        if (err.status === 401 || err.status === 403) {
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

        const sessionIds = nextSessions.map((session) => session.id)
        if (sessionIds.length) {
          const { data: readinessData, error: readinessError } = await supabase
            .from('session_readiness')
            .select(
              'id, session_id, recorded_at, sleep_quality, muscle_soreness, stress_level, motivation, readiness_score, readiness_level'
            )
            .in('session_id', sessionIds)
            .order('recorded_at', { ascending: false })
          if (readinessError) {
            console.error('Failed to load readiness entries', readinessError)
          } else {
            setReadinessEntries((readinessData as ReadinessRow[]) ?? [])
          }
        } else {
          setReadinessEntries([])
        }
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
          'id, name, template_id, started_at, ended_at, status, minutes_available, body_weight_lb, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit))'
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

        const sessionIds = nextSessions.map((session) => session.id)
        if (sessionIds.length) {
          const { data: readinessData, error: readinessError } = await supabase
            .from('session_readiness')
            .select(
              'id, session_id, recorded_at, sleep_quality, muscle_soreness, stress_level, motivation, readiness_score, readiness_level'
            )
            .in('session_id', sessionIds)
            .order('recorded_at', { ascending: false })
          if (readinessError) {
            console.error('Failed to load readiness entries', readinessError)
          } else if (readinessData?.length) {
            setReadinessEntries((prev) => {
              const merged = new Map(prev.map((entry) => [entry.session_id, entry]))
              ;(readinessData as ReadinessRow[]).forEach((entry) => {
                merged.set(entry.session_id, entry)
              })
              return Array.from(merged.values())
            })
          }
        }
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

  useEffect(() => {
    if (userLoading || !user) return

        const loadBodyWeightHistory = async () => {
          let query = supabase
            .from('body_measurements')
            .select('recorded_at, weight_lb')
            .eq('user_id', user.id)
            .order('recorded_at', { ascending: true })
          
          // Use a wider range for fetching to ensure we cover the local date range,
          // or just load everything if no range is too large.
          // For simplicity and correctness with local time filtering,
          // we'll fetch everything if no range, or a safe buffer.
          if (startDate) {
            // Buffer by 1 day to be safe with timezones
            const start = new Date(startDate)
            start.setDate(start.getDate() - 1)
            query = query.gte('recorded_at', start.toISOString())
          }
          if (endDate) {
            // Buffer by 1 day to be safe with timezones
            const end = new Date(endDate)
            end.setDate(end.getDate() + 2)
            query = query.lt('recorded_at', end.toISOString())
          }
    
          const { data } = await query
          
          if (data) {
            setBodyWeightHistory(data)
          }
        }
    
        loadBodyWeightHistory()
      }, [user, userLoading, supabase, startDate, endDate])
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
        const hasMuscle = session.session_exercises.some((exercise) => {
          const libEntry = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())
          const primary = libEntry?.primaryMuscle || exercise.primary_muscle
          const secondary = libEntry?.secondaryMuscles || exercise.secondary_muscles || []
          return isMuscleMatch(selectedMuscle, primary, secondary)
        })
        if (!hasMuscle) return false
      }
      return true
    }).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  }, [sessions, startDate, endDate, selectedExercise, selectedMuscle, exerciseLibraryByName])

  const readinessBySessionId = useMemo(
    () => new Map(readinessEntries.map((entry) => [entry.session_id, entry])),
    [readinessEntries]
  )

  const readinessSessions = useMemo(() => {
    return filteredSessions
      .map((session) => {
        const entry = readinessBySessionId.get(session.id)
        if (!entry) return null
        return { session, entry }
      })
      .filter((value): value is { session: SessionRow; entry: ReadinessRow } => Boolean(value))
  }, [filteredSessions, readinessBySessionId])

  const readinessSeries = useMemo(() => {
    return readinessSessions
      .map(({ session, entry }) => {
        const timestamp = new Date(entry.recorded_at || session.started_at).getTime()
        return {
          day: formatDate(session.started_at),
          timestamp,
          score: entry.readiness_score,
          sleep: entry.sleep_quality,
          soreness: entry.muscle_soreness,
          stress: entry.stress_level,
          motivation: entry.motivation
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [readinessSessions])

  const readinessAverages = useMemo(() => {
    if (!readinessSessions.length) return null
    const totals = {
      sleep: 0,
      soreness: 0,
      stress: 0,
      motivation: 0,
      score: 0,
      scoreCount: 0,
      count: 0
    }
    readinessSessions.forEach(({ entry }) => {
      totals.sleep += entry.sleep_quality
      totals.soreness += entry.muscle_soreness
      totals.stress += entry.stress_level
      totals.motivation += entry.motivation
      totals.count += 1
      if (typeof entry.readiness_score === 'number') {
        totals.score += entry.readiness_score
        totals.scoreCount += 1
      }
    })
    const divisor = totals.count || 1
    return {
      sleep: totals.sleep / divisor,
      soreness: totals.soreness / divisor,
      stress: totals.stress / divisor,
      motivation: totals.motivation / divisor,
      score: totals.scoreCount ? totals.score / totals.scoreCount : null,
      count: totals.count
    }
  }, [readinessSessions])

  const readinessComponents = useMemo(() => {
    if (!readinessAverages) return []
    return [
      { metric: 'Sleep', value: Number(readinessAverages.sleep.toFixed(1)), ideal: 4.5 },
      { metric: 'Soreness', value: Number(readinessAverages.soreness.toFixed(1)), ideal: 1.5 },
      { metric: 'Stress', value: Number(readinessAverages.stress.toFixed(1)), ideal: 1.5 },
      { metric: 'Motivation', value: Number(readinessAverages.motivation.toFixed(1)), ideal: 4.5 }
    ]
  }, [readinessAverages])

  const readinessCorrelation = useMemo(() => {
    return readinessSessions
      .map(({ session, entry }) => {
        const metricSets = session.session_exercises.flatMap((exercise) =>
          exercise.sets
            .filter((set) => set.completed !== false)
            .map((set) => ({
              reps: set.reps ?? null,
              weight: set.weight ?? null,
              weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
              rpe: typeof set.rpe === 'number' ? set.rpe : null,
              rir: typeof set.rir === 'number' ? set.rir : null,
              performedAt: set.performed_at ?? null
            }))
        )
        const metrics = computeSessionMetrics({
          startedAt: session.started_at,
          endedAt: session.ended_at,
          sets: metricSets
        })
        return {
          readiness: entry.readiness_score,
          effort: metrics.avgEffort,
          workload: metrics.workload
        }
      })
      .filter(
        (point): point is { readiness: number; effort: number; workload: number } =>
          typeof point.readiness === 'number' && typeof point.effort === 'number'
      )
  }, [readinessSessions])

  const readinessTrendLine = useMemo(() => {
    if (readinessCorrelation.length < 2) return []
    const n = readinessCorrelation.length
    const sumX = readinessCorrelation.reduce((acc, p) => acc + p.readiness, 0)
    const sumY = readinessCorrelation.reduce((acc, p) => acc + p.effort, 0)
    const sumXY = readinessCorrelation.reduce((acc, p) => acc + p.readiness * p.effort, 0)
    const sumXX = readinessCorrelation.reduce((acc, p) => acc + p.readiness * p.readiness, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const minX = Math.min(...readinessCorrelation.map((p) => p.readiness))
    const maxX = Math.max(...readinessCorrelation.map((p) => p.readiness))

    return [
      { readiness: minX, effort: slope * minX + intercept },
      { readiness: maxX, effort: slope * maxX + intercept }
    ]
  }, [readinessCorrelation])

  const allSets = useMemo(() => {
    const sets = filteredSessions.flatMap((session) =>
      session.session_exercises.flatMap((exercise) => {
        const libEntry = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())
        const primary = libEntry?.primaryMuscle || exercise.primary_muscle
        const secondary = libEntry?.secondaryMuscles || exercise.secondary_muscles || []

        return (exercise.sets ?? []).flatMap((set) =>
          set.completed === false
            ? []
            : [
                {
                  sessionId: session.id,
                  sessionName: getSessionTitle(session),
                  startedAt: session.started_at,
                  endedAt: session.ended_at,
                  exerciseName: exercise.exercise_name,
                  primaryMuscle: primary,
                  secondaryMuscles: secondary,
                  ...set
                }
              ]
        )
      })
    )

    if (selectedMuscle === 'all') return sets

    return sets.filter((set) => isMuscleMatch(selectedMuscle, set.primaryMuscle, set.secondaryMuscles))
  }, [filteredSessions, getSessionTitle, selectedMuscle, exerciseLibraryByName])

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
        rir: typeof set.rir === 'number' ? set.rir : null
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
    const daily = new Map<string, number>()
    allSets.forEach((set) => {
      if (selectedExercise !== 'all' && set.exerciseName !== selectedExercise) return

      const session = sessions.find((s) => s.id === set.sessionId)
      const template = session?.template_id ? templateById.get(session.template_id) : null
      const sessionGoal = template?.style as Goal | undefined
      const isEligible = exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible

      const e1rm = computeSetE1rm(set, sessionGoal, isEligible)
      if (!e1rm) return
      const key = formatDate(set.performed_at ?? set.startedAt)
      const current = daily.get(key)
      daily.set(key, Math.max(current ?? 0, e1rm))
    })
    return Array.from(daily.entries())
      .map(([day, e1rm]) => ({ day, e1rm: Math.round(e1rm) }))
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())
  }, [allSets, selectedExercise, sessions, templateById, exerciseLibraryByName])

  const muscleBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const tonnage = computeSetTonnage({
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
      })
      if (!tonnage) return
      
      // Primary muscle gets 100% credit
      const primary = set.primaryMuscle ?? 'unknown'
      totals.set(primary, (totals.get(primary) ?? 0) + tonnage)

      // Secondary muscles get 50% credit
      if (set.secondaryMuscles && Array.isArray(set.secondaryMuscles)) {
        set.secondaryMuscles.forEach(secondary => {
          if (secondary) {
            totals.set(secondary, (totals.get(secondary) ?? 0) + (tonnage * 0.5))
          }
        })
      }
    })

    const data = Array.from(totals.entries())
      .map(([muscle, volume]) => ({
        slug: muscle,
        muscle: toMuscleLabel(muscle),
        volume: Math.round(volume)
      }))
      .filter((item) => {
        if (selectedMuscle === 'all') return true
        const targetMuscles = PRESET_MAPPINGS[selectedMuscle] || [selectedMuscle]
        return targetMuscles.includes(item.slug.toLowerCase())
      })

    const totalVolume = data.reduce((sum, item) => sum + item.volume, 0)

    return data.map(item => {
      const relativePct = totalVolume > 0 ? (item.volume / totalVolume) * 100 : 0
      const targetPct = MUSCLE_TARGET_DISTRIBUTION[item.slug] || 0
      const imbalanceIndex = targetPct > 0 ? (relativePct / targetPct) * 100 : null

      return {
        ...item,
        relativePct: Number(relativePct.toFixed(1)),
        imbalanceIndex: imbalanceIndex !== null ? Math.round(imbalanceIndex) : null,
      }
    })
  }, [allSets, selectedMuscle])

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

      const session = sessions.find((s) => s.id === set.sessionId)
      const template = session?.template_id ? templateById.get(session.template_id) : null
      const sessionGoal = template?.style as Goal | undefined
      const isEligible = exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible

      const e1rm = computeSetE1rm(set, sessionGoal, isEligible)
      if (e1rm) bestE1rm = Math.max(bestE1rm, e1rm)
    })
    return {
      maxWeight,
      bestReps,
      bestE1rm: Math.round(bestE1rm)
    }
  }, [allSets, sessions, templateById, exerciseLibraryByName])

  const aggregateMetrics = useMemo(() => {
    const metricSets = allSets.map((set) => ({
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
      rpe: typeof set.rpe === 'number' ? set.rpe : null,
      rir: typeof set.rir === 'number' ? set.rir : null,
      failure: null,
      setType: null,
      restSecondsActual: null
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

    let bestE1rmValue = 0
    allSets.forEach((set) => {
      const session = sessions.find((s) => s.id === set.sessionId)
      const template = session?.template_id ? templateById.get(session.template_id) : null
      const sessionGoal = template?.style as Goal | undefined
      const isEligible = exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible

      const e1rm = computeSetE1rm(set, sessionGoal, isEligible)
      if (e1rm) bestE1rmValue = Math.max(bestE1rmValue, e1rm)
    })

    return {
      tonnage: Math.round(aggregateTonnage(metricSets)),
      hardSets: aggregateHardSets(metricSets),
      bestE1rm: Math.round(bestE1rmValue),
      workload: Math.round(metricSets.reduce((sum, set) => sum + computeSetLoad(set), 0)),
      avgEffort: effortTotals.count ? Number((effortTotals.total / effortTotals.count).toFixed(1)) : null
    }
  }, [allSets, sessions, templateById, exerciseLibraryByName])

  const relativeMetrics = useMemo(() => {
    if (!profileWeightLb || profileWeightLb <= 0) return null
    return {
      tonnagePerBodyweight: aggregateMetrics.tonnage / profileWeightLb,
      bestE1rmRatio: aggregateMetrics.bestE1rm / profileWeightLb,
      maxWeightRatio: prMetrics.maxWeight / profileWeightLb
    }
  }, [aggregateMetrics, prMetrics, profileWeightLb])

  const bodyWeightTrend = useMemo(() => {
    const points: Array<{ day: string; timestamp: number; weight: number; source: 'session' | 'history' }> = []
    
    filteredSessions.forEach(session => {
      if (session.body_weight_lb) {
        points.push({
          day: formatDate(session.started_at),
          timestamp: new Date(session.started_at).getTime(),
          weight: Number(session.body_weight_lb),
          source: 'session'
        })
      }
    })

    bodyWeightHistory.forEach(entry => {
      const date = new Date(entry.recorded_at)
      if (startDate) {
        const start = new Date(startDate)
        if (!Number.isNaN(start.getTime()) && date < start) return
      }
      if (endDate) {
        const end = new Date(endDate)
        if (!Number.isNaN(end.getTime()) && date > new Date(end.getTime() + 86400000)) return
      }

      points.push({
        day: formatDate(entry.recorded_at),
        timestamp: date.getTime(),
        weight: Number(entry.weight_lb),
        source: 'history'
      })
    })

    if (points.length === 0) return []

    const sortedUniquePoints = points
      .sort((a, b) => {
        if (a.day === b.day) {
          // Prioritize session source over history if on same day
          if (a.source === 'session' && b.source !== 'session') return -1
          if (b.source === 'session' && a.source !== 'session') return 1
        }
        return a.timestamp - b.timestamp
      })
      .filter((point, index, self) => 
        index === self.findIndex((p) => p.day === point.day)
      )

    // Fill in sessions that don't have weight by using the last known weight
    const sessionTrend = [...filteredSessions]
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
      .map(session => {
        const sessionTime = new Date(session.started_at).getTime()
        // Find the weight at or before this session
        const lastWeight = [...sortedUniquePoints]
          .reverse()
          .find(p => p.timestamp <= sessionTime)
        
        return {
          day: formatDate(session.started_at),
          timestamp: sessionTime,
          weight: lastWeight ? lastWeight.weight : (sortedUniquePoints[0]?.weight ?? 0)
        }
      })

    // Combine history and session points, again unique by day
    const combined = [...sortedUniquePoints, ...sessionTrend]
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((point, index, self) => 
        index === self.findIndex((p) => p.day === point.day)
      )

    return combined
  }, [bodyWeightHistory, filteredSessions, startDate, endDate])

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
            performedAt: set.performed_at ?? null
          }))
      )
    }))
    return summarizeTrainingLoad(mappedSessions)
  }, [filteredSessions])

  const loadReadiness = useMemo(() => getLoadBasedReadiness(trainingLoadSummary), [trainingLoadSummary])

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
    const template = session.template_id ? templateById.get(session.template_id) : null
    const sessionGoal = template?.style as Goal | undefined

    session.session_exercises.forEach((exercise) => {
      const isEligible = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())?.e1rmEligible

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
            rir: typeof set.rir === 'number' ? set.rir : null
          }
        ])
        totals.workload += computeSetLoad({
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null
        })

        const e1rm = computeSetE1rm(
          {
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            completed: set.completed
          },
          sessionGoal,
          isEligible
        )
        if (e1rm) totals.bestE1rm = Math.max(totals.bestE1rm, e1rm)
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
    setActiveDatePreset(null)
  }

  const handlePresetClick = (preset: DateRangePreset) => {
    if (activeDatePreset === preset.label) {
      setStartDate('')
      setEndDate('')
      setActiveDatePreset(null)
    } else {
      const { start, end } = preset.getRange()
      setStartDate(formatDateForInput(start))
      setEndDate(formatDateForInput(end))
      setActiveDatePreset(preset.label)
    }
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
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
            <div className="flex-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Filters</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col">
                  <label className="text-xs text-subtle">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value)
                      setActiveDatePreset(null)
                    }}
                    className="input-base mt-1"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-subtle">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setEndDate(event.target.value)
                      setActiveDatePreset(null)
                    }}
                    className="input-base mt-1"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-2.5">Date range presets</p>
                  <div className="flex flex-wrap gap-2">
                    {DATE_RANGE_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant={activeDatePreset === preset.label ? 'secondary' : 'outline'}
                        size="sm"
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className="h-8 px-3 text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-2.5">Muscle group presets</p>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLE_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={selectedMuscle === preset.value ? 'secondary' : 'outline'}
                        size="sm"
                        type="button"
                        onClick={() => {
                          if (selectedMuscle === preset.value) {
                            setSelectedMuscle('all')
                          } else {
                            setSelectedMuscle(preset.value)
                          }
                        }}
                        className="h-8 px-3 text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col max-w-sm">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-subtle mb-2.5">Specific Exercise</label>
                  <select
                    value={selectedExercise}
                    onChange={(event) => setSelectedExercise(event.target.value)}
                    className="input-base"
                  >
                    <option value="all">All Exercises</option>
                    {exerciseOptions.map((exercise) => (
                      <option key={exercise} value={exercise}>
                        {exercise}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[600px] lg:border-l lg:border-[var(--color-border)] lg:pl-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Muscle group volume</h3>
                <div className="flex gap-1 bg-[var(--color-surface-muted)] p-1 rounded-lg">
                  <button 
                    onClick={() => setMuscleVizMode('absolute')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${muscleVizMode === 'absolute' ? 'bg-[var(--color-surface)] text-[var(--color-primary-strong)] shadow-sm' : 'text-subtle hover:text-muted'}`}
                  >
                    ABS
                  </button>
                  <button 
                    onClick={() => setMuscleVizMode('relative')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${muscleVizMode === 'relative' ? 'bg-[var(--color-surface)] text-[var(--color-primary-strong)] shadow-sm' : 'text-subtle hover:text-muted'}`}
                  >
                    %
                  </button>
                  {muscleBreakdown.some(m => m.imbalanceIndex !== null) && (
                    <button 
                      onClick={() => setMuscleVizMode('index')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${muscleVizMode === 'index' ? 'bg-[var(--color-surface)] text-[var(--color-primary-strong)] shadow-sm' : 'text-subtle hover:text-muted'}`}
                    >
                      INDEX
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
                <div className="h-64 w-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={muscleBreakdown.map(m => ({
                          ...m,
                          value: muscleVizMode === 'absolute' ? m.volume : muscleVizMode === 'relative' ? m.relativePct : (m.imbalanceIndex ?? 0)
                        })).filter(m => m.value > 0)} 
                        dataKey="value" 
                        nameKey="muscle" 
                        outerRadius={90}
                        innerRadius={60}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {muscleBreakdown.map((entry, index) => (
                          <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => {
                          if (muscleVizMode === 'absolute') return [`${value.toLocaleString()} lb`, 'Volume']
                          if (muscleVizMode === 'relative') return [`${value}%`, 'Relative %']
                          return [value, 'Imbalance Index']
                        }}
                        contentStyle={{ 
                          background: 'var(--color-surface)', 
                          border: '1px solid var(--color-border)', 
                          color: 'var(--color-text)', 
                          fontSize: '12px',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-md)'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-subtle border-b border-[var(--color-border)] pb-1.5 mb-3">
                    {muscleVizMode === 'absolute' ? 'Volume breakdown (lb)' : muscleVizMode === 'relative' ? 'Relative distribution (%)' : 'Imbalance index (100 = target)'}
                  </p>
                  {muscleBreakdown.length === 0 ? (
                    <p className="text-xs text-subtle italic">No data for selected range.</p>
                  ) : (
                    muscleBreakdown
                      .sort((a, b) => {
                        const valA = muscleVizMode === 'absolute' ? a.volume : muscleVizMode === 'relative' ? a.relativePct : (a.imbalanceIndex ?? 0)
                        const valB = muscleVizMode === 'absolute' ? b.volume : muscleVizMode === 'relative' ? b.relativePct : (b.imbalanceIndex ?? 0)
                        return valB - valA
                      })
                      .slice(0, 6)
                      .map((entry, idx) => {
                        const displayVal = muscleVizMode === 'absolute' 
                          ? entry.volume.toLocaleString() 
                          : muscleVizMode === 'relative' 
                            ? `${entry.relativePct}%` 
                            : entry.imbalanceIndex !== null ? entry.imbalanceIndex : 'N/A'
                        
                        return (
                          <div key={entry.muscle} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <div 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ background: chartColors[idx % chartColors.length] }} 
                              />
                              <span className="text-muted font-medium">{entry.muscle}</span>
                            </div>
                            <span className="text-strong font-semibold">{displayVal}</span>
                          </div>
                        )
                      })
                  )}
                  {muscleBreakdown.length > 6 && (
                    <p className="text-[10px] text-subtle text-right pt-1">+ {muscleBreakdown.length - 6} more groups</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-6">
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
              {prMetrics.bestE1rm > 0 && (
                <p>Best e1RM ({E1RM_FORMULA_VERSION}): <span className="text-strong">{prMetrics.bestE1rm}</span></p>
              )}
              {relativeMetrics && (
                <>
                  <p>Max / bodyweight: <span className="text-strong">{relativeMetrics.maxWeightRatio.toFixed(2)}x</span></p>
                  {prMetrics.bestE1rm > 0 && (
                    <p>e1RM / bodyweight: <span className="text-strong">{relativeMetrics.bestE1rmRatio.toFixed(2)}x</span></p>
                  )}
                </>
              )}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Volume Summary</h3>
            <div className="mt-3 space-y-1 text-sm text-muted">
              <p>Total tonnage: <span className="text-strong">{aggregateMetrics.tonnage}</span></p>
              <p>Hard sets: <span className="text-strong">{aggregateMetrics.hardSets}</span></p>
              {aggregateMetrics.bestE1rm > 0 && (
                <p>Best e1RM: <span className="text-strong">{aggregateMetrics.bestE1rm}</span></p>
              )}
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
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness Avg</h3>
            <p className="mt-3 text-3xl font-semibold text-strong">
              {typeof readinessAverages?.score === 'number' ? Math.round(readinessAverages.score) : 'N/A'}
            </p>
            <p className="text-xs text-subtle">
              {readinessAverages ? `${readinessAverages.count} check(s)` : 'No readiness data yet'}
            </p>
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

          {exerciseTrend.length > 0 && (
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
                <p className="mt-3 text-xs text-subtle">Showing best e1RM recorded per day across all exercises.</p>
              )}
            </Card>
          )}

          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Bodyweight trend</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <LineChart data={bodyWeightTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis domain={['auto', 'auto']} stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Line type="monotone" dataKey="weight" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-accent)' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness score trend</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <LineChart data={readinessSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis domain={[0, 100]} stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-subtle">
              {readinessSeries.length ? 'Higher scores signal stronger recovery capacity.' : 'No readiness data yet.'}
            </p>
          </Card>

          <Card className="p-6 min-w-0">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness components</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <ComposedChart data={readinessComponents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="metric" stroke="var(--color-text-subtle)" />
                  <YAxis domain={[1, 5]} stroke="var(--color-text-subtle)" />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                  <Bar dataKey="value">
                    {readinessComponents.map((entry) => {
                      let color = '#0ea5e9' // Default blue
                      if (entry.metric === 'Sleep' || entry.metric === 'Motivation') {
                        if (entry.value >= 4) color = '#1f9d55' // Green
                        else if (entry.value >= 3) color = '#f59e0b' // Yellow
                        else color = '#f05a28' // Red
                      } else {
                        // Soreness, Stress - lower is better
                        if (entry.value <= 2) color = '#1f9d55' // Green
                        else if (entry.value <= 3) color = '#f59e0b' // Yellow
                        else color = '#f05a28' // Red
                      }
                      return <Cell key={entry.metric} fill={color} />
                    })}
                  </Bar>
                  <Scatter
                    dataKey="ideal"
                    shape={(props: { cx?: number; cy?: number }) => {
                      const { cx, cy } = props
                      if (typeof cx !== 'number' || typeof cy !== 'number') return null
                      return (
                        <line
                          x1={cx - 20}
                          y1={cy}
                          x2={cx + 20}
                          y2={cy}
                          stroke="var(--color-text-subtle)"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                        />
                      )
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-subtle">
              Averages over selected range. Dashed lines indicate ideal levels.
            </p>
          </Card>

          <Card className={`p-6 min-w-0 ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness vs session effort</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <ComposedChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="readiness" type="number" name="Readiness" domain={['auto', 'auto']} stroke="var(--color-text-subtle)" />
                  <YAxis dataKey="effort" type="number" name="Avg effort" domain={[0, 10]} stroke="var(--color-text-subtle)" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  />
                  <Scatter data={readinessCorrelation} fill="var(--color-primary)" />
                  <Line data={readinessTrendLine} dataKey="effort" stroke="var(--color-text-subtle)" strokeDasharray="5 5" dot={false} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-subtle">
              Track how readiness aligns with perceived effort across completed sessions.
            </p>
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
                          {session.body_weight_lb ? ` · ${session.body_weight_lb} lb` : ''}
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