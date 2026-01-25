'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  Label
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { WeeklyVolumeChart } from '@/components/progress/WeeklyVolumeChart'
import { toMuscleLabel, PRESET_MAPPINGS, isMuscleMatch, toMuscleSlug } from '@/lib/muscle-utils'
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
const SESSION_PAGE_SIZE = 50

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
  if (Number.isNaN(date.getTime())) return value
  // If it's a date-only string (YYYY-MM-DD) or UTC midnight, avoid UTC shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString()
  }
  return date.toLocaleDateString()
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString([], { dateStyle: 'medium' })
  }
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
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

const formatChartDate = (value: string | number) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const getStatusDescription = (status: string, ratio: number, insufficientData?: boolean, isInitialPhase?: boolean) => {
  if (insufficientData) {
    return "Log your first session to begin tracking your systemic training load."
  }
  if (isInitialPhase) {
    return "You're in the 'Baseline Building' phase. We're establishing your normal work capacity. Keep logging sessions to unlock advanced recovery insights."
  }
  const percentage = Math.round(Math.abs(1 - ratio) * 100)
  if (status === 'undertraining') {
    return `Your recent load is ${percentage}% lower than your baseline. This reduces fatigue but may stall progress if maintained.`
  }
  if (status === 'overreaching') {
    return `You've increased volume by ${percentage}% abruptly. Short periods here can drive growth, but long periods increase injury risk.`
  }
  return "Your current training stress is well-matched to your fitness level, keeping you in the 'sweet spot' for progressive overload."
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
    metric_profile?: string | null
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
      duration_seconds?: number | null
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
  const [bodyWeightHistory, setBodyWeightHistory] = useState<Array<{ recorded_at: string; weight_lb: number; source: string }>>([])

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
    if (userLoading || !user) return

    const loadSessions = async () => {
      setSessionsLoaded(false)
      const session = await ensureSession()
      if (!session) return
      setLoading(true)
      setError(null)

      let query = supabase
        .from('sessions')
        .select(
          'id, name, template_id, started_at, ended_at, status, minutes_available, body_weight_lb, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, duration_seconds))'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      // Systemic Training Status needs the last 28 days of data from TODAY.
      // If a startDate filter is active, we also need 28 days before THAT for historical chronic load.
      const now = new Date()
      const acrChronicStart = new Date(now.getTime() - 28 * 86400000)
      let effectiveStart = acrChronicStart

      if (startDate) {
        const start = new Date(startDate)
        if (!Number.isNaN(start.getTime())) {
          const chronicStart = new Date(start.getTime() - 28 * 86400000)
          if (chronicStart < effectiveStart) effectiveStart = chronicStart
        }
      }

      query = query.gte('started_at', effectiveStart.toISOString())

      // If no explicit date range is set, ensure we load a decent amount of sessions (first page)
      // to populate the charts meaningfully.
      if (!startDate) {
        query = query.limit(SESSION_PAGE_SIZE)
      }

      const [{ data: sessionData, error: fetchError }, { data: templateData, error: templateError }] =
        await Promise.all([
          query,
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
        // If we filtered by date, we might have loaded everything requested
        setHasMoreSessions(!startDate && nextSessions.length === SESSION_PAGE_SIZE)
        setSessionsLoaded(true)
        setSessionPage(0)

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
  }, [ensureSession, supabase, user, userLoading, setUser, startDate, endDate])

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
          'id, name, template_id, started_at, ended_at, status, minutes_available, body_weight_lb, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, duration_seconds))'
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
            .select('recorded_at, weight_lb, source')
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
            console.log('Fetched body weight history:', data);
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
    const seenIds = new Set<string>()
    
    // Default to Last 90 Days if no explicit range is set for consistent chart viewing
    const effectiveStartDate = startDate || formatDateForInput(createPastRange(90).start)
    
    return sessions.filter((session) => {
      if (seenIds.has(session.id)) return false
      seenIds.add(session.id)

      const date = new Date(session.started_at)
      const localDay = formatDateForInput(date)

      if (effectiveStartDate && localDay < effectiveStartDate) return false
      if (endDate && localDay > endDate) return false
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
        const dayKey = formatDateForInput(new Date(session.started_at))
        return {
          day: formatChartDate(dayKey),
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
      { metric: 'Sleep', value: Number(readinessAverages.sleep.toFixed(1)), ideal: 4.0 },
      { metric: 'Soreness', value: Number(readinessAverages.soreness.toFixed(1)), ideal: 2.0 },
      { metric: 'Stress', value: Number(readinessAverages.stress.toFixed(1)), ideal: 2.0 },
      { metric: 'Motivation', value: Number(readinessAverages.motivation.toFixed(1)), ideal: 4.0 }
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
                  metricProfile: (exercise as any).metric_profile,
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
    
    // Determine if we should aggregate by day or week
    let useDaily = false
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays < 14) useDaily = true
    } else if (startDate || endDate) {
      // If only one date is set, check vs filtered sessions span
      const dates = filteredSessions.map(s => new Date(s.started_at).getTime())
      if (dates.length > 0) {
        const min = Math.min(...dates)
        const max = Math.max(...dates)
        const diffDays = (max - min) / (1000 * 60 * 60 * 24)
        if (diffDays < 14) useDaily = true
      }
    } else if (filteredSessions.length > 0) {
      // Default view: check actual span of loaded sessions
      const dates = filteredSessions.map(s => new Date(s.started_at).getTime())
      const min = Math.min(...dates)
      const max = Math.max(...dates)
      const diffDays = (max - min) / (1000 * 60 * 60 * 24)
      if (diffDays < 14) useDaily = true
    }

    allSets.forEach((set) => {
      const date = set.performed_at ?? set.startedAt
      const key = useDaily ? formatDate(date) : getWeekKey(date)
      
      const tonnage = computeSetTonnage({
        metricProfile: (set as any).metricProfile,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
      })
      const load = computeSetLoad({
        metricProfile: (set as any).metricProfile,
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
      .sort(([a], [b]) => {
        if (useDaily) return new Date(a).getTime() - new Date(b).getTime()
        return a.localeCompare(b)
      })
      .map(([label, values]) => ({ 
        label: useDaily ? formatChartDate(label) : label, 
        volume: Math.round(values.volume), 
        load: Math.round(values.load),
        isDaily: useDaily
      }))
  }, [allSets, startDate, endDate, filteredSessions])

  const effortTrend = useMemo(() => {
    const daily = new Map<string, { total: number; count: number }>()
    allSets.forEach((set) => {
      const raw = getEffortScore({
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null
      })
      if (raw === null) return
      const key = formatDateForInput(new Date(set.performed_at ?? set.startedAt))
      const current = daily.get(key) ?? { total: 0, count: 0 }
      daily.set(key, { total: current.total + raw, count: current.count + 1 })
    })
    return Array.from(daily.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({
        day: formatChartDate(day),
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
      const key = formatDateForInput(new Date(set.performed_at ?? set.startedAt))
      const current = daily.get(key)
      daily.set(key, Math.max(current ?? 0, e1rm))
    })

    const sortedDaily = Array.from(daily.entries())
      .map(([day, e1rm]) => ({ 
        day: formatChartDate(day), 
        e1rm: Math.round(e1rm), 
        timestamp: new Date(day).getTime(), 
        trend: null as number | null 
      }))
      .sort((a, b) => a.timestamp - b.timestamp)

    // Calculate a simple 7-day rolling average for the trend line if we have enough data
    if (sortedDaily.length >= 3) {
      sortedDaily.forEach((point, idx) => {
        const windowSize = 7 * 86400000 // 7 days in ms
        const window = sortedDaily.filter(p => p.timestamp <= point.timestamp && p.timestamp > point.timestamp - windowSize)
        if (window.length > 0) {
          const sum = window.reduce((acc, p) => acc + p.e1rm, 0)
          point.trend = Math.round(sum / window.length)
        }
      })
    }

    return sortedDaily
  }, [allSets, selectedExercise, sessions, templateById, exerciseLibraryByName])

  const muscleBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const tonnage = computeSetTonnage({
        metricProfile: (set as any).metricProfile,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
      })
      if (!tonnage) return
      
            // Use slug for consistent aggregation keys
            const primary = toMuscleSlug(set.primaryMuscle ?? 'unknown')

            if (primary) {
              totals.set(primary, (totals.get(primary) ?? 0) + tonnage)
            }

            // Secondary muscles get 50% credit
            if (set.secondaryMuscles && Array.isArray(set.secondaryMuscles)) {
              set.secondaryMuscles.forEach(secondary => {
                if (secondary) {
                  const secondarySlug = toMuscleSlug(secondary)
                  if (secondarySlug) {
                    totals.set(secondarySlug, (totals.get(secondarySlug) ?? 0) + (tonnage * 0.5))
                  }
                }
              })
            }
      
          })
      
      
      
          const data = Array.from(totals.entries())
      
            .map(([muscleSlug, volume]) => ({
      
              slug: muscleSlug,
      
              muscle: toMuscleLabel(muscleSlug),
      
              volume: Math.round(volume)
      
            }))
      .filter((item) => {
        if (selectedMuscle === 'all') return true
        const targetMuscles = PRESET_MAPPINGS[selectedMuscle] || [selectedMuscle]
        return targetMuscles.includes(item.slug.toLowerCase())
      })

    const totalVolume = data.reduce((sum, item) => sum + item.volume, 0)
    
    // Calculate total target percentage for the currently visible muscles
    const totalTargetPct = data.reduce((sum, item) => sum + (MUSCLE_TARGET_DISTRIBUTION[item.slug] || 0), 0)

    return data.map(item => {
      const relativePct = totalVolume > 0 ? (item.volume / totalVolume) * 100 : 0
      const rawTarget = MUSCLE_TARGET_DISTRIBUTION[item.slug] || 0
      
      // Normalize target: if we are only looking at Arms (e.g. 10% total target), 
      // but they make up 100% of the current view, their new target should be scaled up.
      const normalizedTarget = totalTargetPct > 0 ? (rawTarget / totalTargetPct) * 100 : 0
      
      const imbalanceIndex = normalizedTarget > 0 ? (relativePct / normalizedTarget) * 100 : null

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
    let bestE1rmExercise = ''
    allSets.forEach((set) => {
      const session = sessions.find((s) => s.id === set.sessionId)
      const template = session?.template_id ? templateById.get(session.template_id) : null
      const sessionGoal = template?.style as Goal | undefined
      const isEligible = exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible

      const e1rm = computeSetE1rm(set, sessionGoal, isEligible)
      if (e1rm && e1rm > bestE1rmValue) {
        bestE1rmValue = e1rm
        bestE1rmExercise = set.exerciseName
      }
    })

    const workload = Math.round(metricSets.reduce((sum, set) => sum + computeSetLoad(set), 0))
    const sessionCount = filteredSessions.length

    return {
      tonnage: Math.round(aggregateTonnage(metricSets)),
      hardSets: aggregateHardSets(metricSets),
      bestE1rm: Math.round(bestE1rmValue),
      bestE1rmExercise,
      workload,
      avgWorkload: sessionCount > 0 ? Math.round(workload / sessionCount) : 0,
      avgEffort: effortTotals.count ? Number((effortTotals.total / effortTotals.count).toFixed(1)) : null
    }
  }, [allSets, sessions, templateById, exerciseLibraryByName, filteredSessions.length])

  const relativeMetrics = useMemo(() => {
    if (!profileWeightLb || profileWeightLb <= 0) return null
    return {
      tonnagePerBodyweight: aggregateMetrics.tonnage / profileWeightLb,
      bestE1rmRatio: aggregateMetrics.bestE1rm / profileWeightLb,
      maxWeightRatio: prMetrics.maxWeight / profileWeightLb
    }
  }, [aggregateMetrics, prMetrics, profileWeightLb])

  const bodyWeightData = useMemo(() => {
    const rawPoints: Array<{ dayKey: string; timestamp: number; weight: number; source: string }> = []
    
    // 1. Collect points from sessions
    filteredSessions.forEach(session => {
      if (session.body_weight_lb) {
        const date = new Date(session.started_at)
        rawPoints.push({
          dayKey: formatDateForInput(date),
          timestamp: date.getTime(),
          weight: Number(session.body_weight_lb),
          source: 'session'
        })
      }
    })

    // 2. Collect points from history (including user and dev_seed)
    bodyWeightHistory.forEach(entry => {
      // Fix UTC shift for literal YYYY-MM-DD strings or UTC midnight entries
      const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(entry.recorded_at) 
        ? entry.recorded_at.split('T')[0]
        : (entry.recorded_at.endsWith('T00:00:00.000Z') || entry.recorded_at.endsWith('T00:00:00Z'))
          ? entry.recorded_at.split('T')[0]
          : formatDateForInput(new Date(entry.recorded_at))

      const [year, month, day] = dayKey.split('-').map(Number)
      const date = new Date(year, month - 1, day)

      rawPoints.push({
        dayKey,
        timestamp: date.getTime(),
        weight: Number(entry.weight_lb),
        source: entry.source || 'history'
      })
    })

    if (rawPoints.length === 0) return []

    // 3. Consolidate by dayKey to prevent duplicates on the same day
    const consolidated = new Map<string, typeof rawPoints[0]>()
    rawPoints.sort((a, b) => a.timestamp - b.timestamp).forEach(p => {
      const existing = consolidated.get(p.dayKey)
      
      // Consolidation Priority:
      // 1. 'user' (manual log) - Top priority
      // 2. 'session' (workout entry)
      // 3. 'dev_seed' or others - Bottom priority
      
      const getPriority = (source: string) => {
        if (source === 'user') return 10
        if (source === 'session') return 5
        return 1
      }

      if (!existing || getPriority(p.source) > getPriority(existing.source) || (p.source === existing.source && p.timestamp >= existing.timestamp)) {
        consolidated.set(p.dayKey, p)
      }
    })

    const sortedUniqueMeasurements = Array.from(consolidated.values()).sort((a, b) => a.timestamp - b.timestamp)

    // 4. Fill in gaps for sessions without weight using last known weight
    const allPointsByDay = new Map<string, { day: string; dayKey: string; timestamp: number; weight: number }>()
    
    // Add consolidated measurements first
    sortedUniqueMeasurements.forEach(p => {
      if (startDate && p.dayKey < startDate) return
      if (endDate && p.dayKey > endDate) return

      const [year, month, day] = p.dayKey.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      allPointsByDay.set(p.dayKey, {
        day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        dayKey: p.dayKey,
        timestamp: p.timestamp,
        weight: p.weight
      })
    })

    // Fill in sessions without recorded weight
    filteredSessions.forEach(session => {
      const date = new Date(session.started_at)
      const dayKey = formatDateForInput(date)
      if (allPointsByDay.has(dayKey)) return
      if (startDate && dayKey < startDate) return
      if (endDate && dayKey > endDate) return

      const last = sortedUniqueMeasurements.filter(p => p.timestamp <= date.getTime()).pop()
      if (last) {
        allPointsByDay.set(dayKey, {
          day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          dayKey: dayKey,
          timestamp: date.getTime(),
          weight: last.weight
        })
      }
    })

    const combined = Array.from(allPointsByDay.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(p => ({ ...p, trend: null as number | null }))

    if (combined.length >= 2) {
      const n = combined.length
      const sumX = combined.reduce((acc, p) => acc + p.timestamp, 0)
      const sumY = combined.reduce((acc, p) => acc + p.weight, 0)
      const sumXY = combined.reduce((acc, p) => acc + p.timestamp * p.weight, 0)
      const sumXX = combined.reduce((acc, p) => acc + p.timestamp * p.timestamp, 0)

      const denominator = (n * sumXX - sumX * sumX)
      if (denominator !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denominator
        const intercept = (sumY - slope * sumX) / n
        combined.forEach(p => {
          p.trend = slope * p.timestamp + intercept
        })
      }
    }

    return combined
  }, [bodyWeightHistory, filteredSessions, startDate, endDate])

  const trainingLoadSummary = useMemo(() => {
    // ACR represents "Systemic Load" (total body stress).
    // We always calculate this relative to TODAY so the dashboard shows your current recovery state,
    // regardless of which historical range you are currently reviewing in the charts below.
    const mappedSessions = sessions.map((session) => ({
      startedAt: session.started_at,
      endedAt: session.ended_at,
      sets: session.session_exercises.flatMap((exercise) => {
        return (exercise.sets ?? [])
          .filter((set) => set.completed !== false)
          .map((set) => ({
            metricProfile: (exercise as any).metric_profile,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null,
            performedAt: set.performed_at ?? null,
            durationSeconds: set.duration_seconds ?? null
          }))
      })
    }))
    
    const calculationDate = new Date()
    const summary = summarizeTrainingLoad(mappedSessions, calculationDate)
    
    return {
      ...summary,
      calculationDate
    }
  }, [sessions])

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
          metricProfile: (exercise as any).metric_profile,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
        totals.volume += tonnage
        totals.hardSets += aggregateHardSets([
          {
            metricProfile: (exercise as any).metric_profile,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null
          }
        ])
        totals.workload += computeSetLoad({
          metricProfile: (exercise as any).metric_profile,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null,
          durationSeconds: set.duration_seconds ?? null
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
    return (
      <div className="page-shell">
        <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <div className="h-3 w-20 rounded bg-[var(--color-surface-muted)]" />
              <div className="h-8 w-48 rounded bg-[var(--color-surface-muted)]" />
              <div className="h-4 w-64 rounded bg-[var(--color-surface-muted)]" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-32 rounded-lg bg-[var(--color-surface-muted)]" />
              <div className="h-9 w-24 rounded-lg bg-[var(--color-surface-muted)]" />
            </div>
          </div>

          {/* Training Status Card Skeleton */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-8 h-[300px]" />

          {/* Controls Card Skeleton */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-8 h-[250px]" />

          {/* Key Metrics Grid Skeleton */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
            ))}
          </div>

          {/* Charts Grid Skeleton */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
            ))}
          </div>
        </div>
      </div>
    )
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

        <TrainingStatusCard 
          status={trainingLoadSummary.status}
          loadRatio={trainingLoadSummary.loadRatio}
          weeklyLoad={trainingLoadSummary.acuteLoad}
          chronicWeeklyAvg={trainingLoadSummary.chronicWeeklyAvg}
          insufficientData={trainingLoadSummary.insufficientData}
          isInitialPhase={trainingLoadSummary.isInitialPhase}
        />

                {/* 1. Training Status (Full Width Top) */}
                <Card className={`relative z-10 border-t-4 ${
                  trainingLoadSummary.insufficientData || trainingLoadSummary.isInitialPhase ? 'border-t-[var(--color-border)]' :
                  trainingLoadSummary.status === 'balanced' ? 'border-t-[var(--color-success)]' :
                  trainingLoadSummary.status === 'overreaching' ? 'border-t-[var(--color-danger)]' :
                  'border-t-[var(--color-warning)]'
                }`}>
                  <div className="p-6 md:p-8">
                    <div className="flex flex-col gap-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-strong">Systemic Training Status</h3>
                            <ChartInfoTooltip 
                              description="The ratio between your Acute Load (Last 7 days) and Chronic Load (Last 28 days). It indicates if you are ramping up too fast or doing too little."
                              goal="Stay in the Green (Balanced) zone most of the time to get stronger without getting hurt."
                            />
                          </div>
                          <p className="text-[9px] text-muted italic mt-0.5">Based on total body workload (ignores filters)</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${
                            trainingLoadSummary.insufficientData || trainingLoadSummary.isInitialPhase ? 'bg-[var(--color-surface-muted)] text-subtle border-[var(--color-border)]' :
                            trainingLoadSummary.status === 'balanced' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-border)]' :
                            trainingLoadSummary.status === 'overreaching' ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger-border)]' :
                            trainingLoadSummary.status === 'undertraining' ? 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a] dark:bg-[#92400e]/20 dark:text-[#fcd34d] dark:border-[#92400e]/40' :
                            'bg-[var(--color-surface-muted)] text-subtle border border-[var(--color-border)]'
                          }`}>
                            {trainingLoadSummary.insufficientData ? 'Insufficient Data' :
                             trainingLoadSummary.isInitialPhase ? 'Building Baseline' :
                             trainingLoadSummary.status === 'overreaching' ? 'overtraining' : trainingLoadSummary.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-10 lg:grid-cols-4 lg:items-center">
                        <div className="space-y-2">
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold tracking-tighter text-strong">
                              {trainingLoadSummary.insufficientData || trainingLoadSummary.isInitialPhase ? '--' : trainingLoadSummary.loadRatio}
                            </span>
                            <span className="text-xs font-bold text-subtle uppercase tracking-widest">ACR</span>
                          </div>
                          <p className="text-[10px] uppercase font-bold tracking-widest text-subtle/70">Acute:Chronic Ratio</p>
                        </div>
        
                        <div className="lg:col-span-2 space-y-4">
                          <div className="relative pt-2">
                            <div className="h-3 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden flex shadow-inner">
                              <div className="h-full bg-[var(--color-warning)] opacity-30" style={{ width: '40%' }} />
                              <div className="h-full bg-[var(--color-success)] opacity-40" style={{ width: '25%' }} />
                              <div className="h-full bg-[var(--color-danger)] opacity-30" style={{ width: '35%' }} />
                            </div>
                            {!trainingLoadSummary.insufficientData && !trainingLoadSummary.isInitialPhase && (
                              <div 
                                className={`absolute top-1.5 h-5 w-1.5 rounded-full transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) shadow-lg border border-white dark:border-gray-900 ${
                                  trainingLoadSummary.status === 'balanced' ? 'bg-[var(--color-success)]' :
                                  trainingLoadSummary.status === 'overreaching' ? 'bg-[var(--color-danger)]' :
                                  'bg-[#92400e]'
                                }`}
                                style={{
                                  left: `${Math.min(100, (trainingLoadSummary.loadRatio / 2.0) * 100)}%`,
                                  transform: 'translateX(-50%)'
                                }}
                              />
                            )}
                          </div>
                          <div className="flex justify-between px-1">
                            <div className="text-center">
                              <span className="block text-[9px] font-bold text-subtle/40 uppercase">Low</span>
                              <span className="text-[10px] font-bold text-subtle">0.0</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[9px] font-bold text-[var(--color-success)]/60 uppercase">Sweet Spot</span>
                              <span className="text-[10px] font-bold text-subtle">1.0</span>
                            </div>
                            <div className="text-center">
                              <span className="block text-[9px] font-bold text-[var(--color-danger)]/60 uppercase">High</span>
                              <span className="text-[10px] font-bold text-subtle">2.0+</span>
                            </div>
                          </div>
                        </div>
        
                        <div className="grid grid-cols-2 gap-4 lg:border-l lg:border-[var(--color-border)] lg:pl-10">
                          <div className="space-y-1">
                            <p className="text-[10px] text-subtle uppercase font-bold tracking-widest">Load (7d)</p>
                            <p className="text-2xl font-bold text-strong tracking-tight">{trainingLoadSummary.insufficientData && trainingLoadSummary.acuteLoad === 0 ? '--' : trainingLoadSummary.acuteLoad.toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-subtle uppercase font-bold tracking-widest">Baseline</p>
                            <p className="text-2xl font-bold text-strong tracking-tight">
                              {trainingLoadSummary.insufficientData || trainingLoadSummary.isInitialPhase ? '--' : trainingLoadSummary.chronicWeeklyAvg.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-[var(--color-border)]/50">
                        <p className="text-sm text-muted leading-relaxed">
                          <span className="font-semibold text-strong">Coach Insight:</span> {
                            getStatusDescription(trainingLoadSummary.status, trainingLoadSummary.loadRatio, trainingLoadSummary.insufficientData, trainingLoadSummary.isInitialPhase)
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-10">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-subtle">Data Insights Control</h2>
                <div className="h-px flex-1 bg-[var(--color-border)] opacity-50" />
              </div>
              
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
                {/* Left Controls Stack */}
                <div className="lg:col-span-5 space-y-10">
                  {/* Date Selection */}
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-strong mb-3">Time Horizon</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase font-bold text-subtle mb-1 ml-1">From</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(event) => {
                              setStartDate(event.target.value)
                              setActiveDatePreset(null)
                            }}
                            className="input-base text-sm"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase font-bold text-subtle mb-1 ml-1">To</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(event) => {
                              setEndDate(event.target.value)
                              setActiveDatePreset(null)
                            }}
                            className="input-base text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] uppercase font-bold text-subtle mb-2.5 ml-1">Quick Ranges</p>
                      <div className="flex flex-wrap gap-2">
                        {DATE_RANGE_PRESETS.map((preset) => (
                          <Button
                            key={preset.label}
                            variant={activeDatePreset === preset.label ? 'primary' : 'outline'}
                            size="sm"
                            type="button"
                            onClick={() => handlePresetClick(preset)}
                            className={`h-8 px-3 text-[11px] font-bold transition-all ${activeDatePreset === preset.label ? 'shadow-md' : 'bg-transparent text-muted border-[var(--color-border)] hover:border-strong'}`}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Focus Selection */}
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-strong mb-3">Muscle Group Focus</p>
                      <div className="flex flex-wrap gap-2">
                        {MUSCLE_PRESETS.map((preset) => (
                          <Button
                            key={preset.value}
                            variant={selectedMuscle === preset.value ? 'primary' : 'outline'}
                            size="sm"
                            type="button"
                            onClick={() => {
                              if (selectedMuscle === preset.value) {
                                setSelectedMuscle('all')
                              } else {
                                setSelectedMuscle(preset.value)
                              }
                            }}
                            className={`h-8 px-4 text-[11px] font-bold transition-all ${selectedMuscle === preset.value ? 'shadow-md scale-105' : 'bg-transparent text-muted border-[var(--color-border)] hover:border-strong'}`}
                          >
                            {preset.label}
                          </Button>
                        ))}
                        <Button
                          variant={selectedMuscle === 'all' ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedMuscle('all')}
                          className={`h-8 px-4 text-[11px] font-bold transition-all ${selectedMuscle === 'all' ? 'shadow-md' : 'bg-transparent text-muted border-[var(--color-border)] hover:border-strong'}`}
                        >
                          All Groups
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-strong mb-3">Specific Movement</label>
                      <select
                        value={selectedExercise}
                        onChange={(event) => setSelectedExercise(event.target.value)}
                        className="input-base text-sm font-semibold"
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

                {/* Analysis Perspective Column */}
                <div className="lg:col-span-7 lg:border-l lg:border-[var(--color-border)] lg:pl-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-strong">Muscle group volume</h3>
                      <ChartInfoTooltip 
                        description="Shows how much work each muscle group did. The bigger the slice, the more work that muscle did."
                        goal="Try to keep things even so you don't over-train one spot and under-train another."
                      />
                    </div>
                    <div className="flex gap-1 bg-[var(--color-surface-muted)] p-1 rounded-lg">
                      <button 
                        onClick={() => setMuscleVizMode('absolute')}
                        className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${muscleVizMode === 'absolute' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-muted'}`}
                      >
                        ABS
                      </button>
                      <button 
                        onClick={() => setMuscleVizMode('relative')}
                        className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${muscleVizMode === 'relative' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-muted'}`}
                      >
                        %
                      </button>
                      {muscleBreakdown.some(m => m.imbalanceIndex !== null) && (
                        <button 
                          onClick={() => setMuscleVizMode('index')}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${muscleVizMode === 'index' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-muted'}`}
                        >
                          INDEX
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col xl:flex-row items-center gap-8">
                    <div className="h-[280px] w-full xl:w-1/2">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                          <Pie 
                            data={muscleBreakdown.map(m => ({
                              ...m,
                              value: muscleVizMode === 'absolute' ? m.volume : muscleVizMode === 'relative' ? m.relativePct : (m.imbalanceIndex ?? 0)
                            })).filter(m => m.value > 0)} 
                            dataKey="value" 
                            nameKey="muscle" 
                            outerRadius={100}
                            innerRadius={70}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {muscleBreakdown.map((entry, index) => (
                              <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number | undefined) => {
                              if (typeof value !== 'number') return []
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
                    
                    <div className="w-full xl:w-1/2 space-y-2 pr-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-subtle border-b border-[var(--color-border)] pb-2 mb-3">
                        {muscleVizMode === 'absolute' ? 'Volume (lb)' : muscleVizMode === 'relative' ? 'Distribution (%)' : 'Target Index (100=target)'}
                      </p>
                      {muscleBreakdown.length === 0 ? (
                        <p className="text-xs text-subtle italic">No data available.</p>
                      ) : (
                        muscleBreakdown
                          .sort((a, b) => {
                            const valA = muscleVizMode === 'absolute' ? a.volume : muscleVizMode === 'relative' ? a.relativePct : (a.imbalanceIndex ?? 0)
                            const valB = muscleVizMode === 'absolute' ? b.volume : muscleVizMode === 'relative' ? b.relativePct : (b.imbalanceIndex ?? 0)
                            return valB - valA
                          })
                          .map((entry, idx) => {
                            const displayVal = muscleVizMode === 'absolute' 
                              ? `${entry.volume.toLocaleString()} lb`
                              : muscleVizMode === 'relative' 
                                ? `${entry.relativePct}%` 
                                : entry.imbalanceIndex !== null ? entry.imbalanceIndex : 'N/A'
                            
                            return (
                              <div key={entry.muscle} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--color-border)]/30 last:border-0">
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-2.5 h-2.5 rounded-full" 
                                    style={{ background: chartColors[idx % chartColors.length] }} 
                                  />
                                  <span className="text-muted font-bold uppercase text-[10px] tracking-tight">{entry.muscle}</span>
                                </div>
                                <span className="text-strong font-black tabular-nums text-[11px]">{displayVal}</span>
                              </div>
                            )
                          })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 1. Performance Snapshot */}
          <Card className="p-6">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Performance PRs</h3>
              <ChartInfoTooltip 
                description="Shows the heaviest weights you've lifted. Your 'Peak' is an estimate of your 1-rep max strength."
                goal="Try to see these numbers slowly go up every few months. It's proof you're getting stronger!"
              />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-semibold text-strong">{aggregateMetrics.bestE1rm || prMetrics.maxWeight || 0}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">Peak e1RM / Max (lb)</p>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Best reps</span>
                <span className="text-strong font-semibold">{prMetrics.bestReps} reps</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Max weight</span>
                <span className="text-strong font-semibold">{prMetrics.maxWeight} lb</span>
              </div>
            </div>
          </Card>

          {/* 2. Workload & Volume */}
          <Card className="p-6">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Workload & Volume</h3>
              <ChartInfoTooltip 
                description="Tonnage is the total amount of weight you moved (sets x reps x weight). Workload is tonnage adjusted for how hard you worked."
                goal="Higher total work over time usually leads to more muscle growth, as long as you can recover from it."
              />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-semibold text-strong">{aggregateMetrics.tonnage.toLocaleString()}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">Total Tonnage (lb)</p>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex justify-between items-center text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-tighter">Total Workload</span>
                  <span className="text-strong font-semibold">{aggregateMetrics.workload.toLocaleString()}</span>
                </div>
                <div className="h-8 w-px bg-[var(--color-border)] mx-2" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-tighter">Avg Load</span>
                  <span className="text-strong font-semibold">{aggregateMetrics.avgWorkload.toLocaleString()}</span>
                </div>
                <div className="h-8 w-px bg-[var(--color-border)] mx-2" />
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-bold text-subtle tracking-tighter">Hard Sets</span>
                  <span className="text-strong font-semibold">{aggregateMetrics.hardSets}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 3. Activity & Recovery */}
          <Card className="p-6">
            <div className="flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Activity & Recovery</h3>
              <ChartInfoTooltip 
                description="Consistency is how often you show up. Readiness is how good your body feels. Effort is how hard you push when you're there."
                goal="The goal is to show up consistently and push hard when your readiness score is high."
              />
            </div>
            <div className="mt-4">
              <p className="text-3xl font-semibold text-strong">
                {typeof readinessAverages?.score === 'number' ? Math.round(readinessAverages.score) : 'N/A'}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-subtle">Readiness Avg</p>
              
              {typeof readinessAverages?.score === 'number' && (
                <div className="mt-4">
                  <div className="h-1.5 w-full bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        readinessAverages.score >= 70 ? 'bg-[var(--color-success)]' :
                        readinessAverages.score >= 40 ? 'bg-[var(--color-warning)]' :
                        'bg-[var(--color-danger)]'
                      }`}
                      style={{ width: `${readinessAverages.score}%` }} 
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Sessions</span>
                <span className="text-strong font-semibold">{filteredSessions.length} total</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Consistency</span>
                <span className="text-strong font-semibold">{sessionsPerWeek} / week</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-subtle">Avg Effort</span>
                <span className="text-strong font-semibold">{aggregateMetrics.avgEffort ?? 'N/A'}/10</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
                Volume & load {volumeTrend[0]?.isDaily ? 'by day' : 'by week'}
              </h3>
              <ChartInfoTooltip 
                description="Volume is total weight moved. Load is volume adjusted by how hard it felt. It's your 'total effort' for the period."
                goal="Look for a slow and steady crawl upward over time. This is how you get stronger!"
              />
            </div>
            <WeeklyVolumeChart data={volumeTrend} />
            <p className="mt-3 text-xs text-subtle">
              Latest load: {trainingLoadSummary.weeklyLoadTrend.at(-1)?.load ?? 'N/A'}
            </p>
          </Card>

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Effort trend</h3>
              <ChartInfoTooltip 
                description="Average effort (RPE or 10-RIR) per session. Shows how hard you are pushing on average."
                goal="Maintain intensity appropriate for your program; avoid consistent 10/10 effort to prevent burnout."
              />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <LineChart data={effortTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis stroke="var(--color-text-subtle)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: 'var(--color-text)' }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
                  <Line type="monotone" dataKey="effort" stroke="var(--color-success)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {exerciseTrend.length > 0 && (
            <Card className="p-6 min-w-0">
              <div className="mb-4 flex items-center">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">e1RM trend</h3>
                <ChartInfoTooltip 
                  description="Estimated 1-Rep Max based on your best sets. A proxy for absolute strength levels."
                  goal="A steady upward trend over months indicates successful strength adaptation."
                />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                  <LineChart data={exerciseTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                    <YAxis stroke="var(--color-text-subtle)" />
                    <Tooltip 
                    contentStyle={{ 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: 'var(--color-text)' }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
                    <Line 
                      type="monotone" 
                      dataKey="e1rm" 
                      stroke="var(--color-warning)" 
                      strokeWidth={2} 
                      dot={{ r: 4, fill: 'var(--color-surface)', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="trend" 
                      stroke="var(--color-text-subtle)" 
                      strokeWidth={2} 
                      strokeDasharray="5 5" 
                      dot={false} 
                      activeDot={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {selectedExercise === 'all' && (
                <p className="mt-3 text-xs text-subtle">Showing best e1RM recorded per day across all exercises.</p>
              )}
            </Card>
          )}

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Bodyweight trend</h3>
              <ChartInfoTooltip 
                description="Your recorded body weight over time. The dashed line shows the overall trend."
                goal="Align weight changes with your caloric and training goals (bulking, cutting, or maintenance)."
              />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <LineChart data={bodyWeightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis domain={['auto', 'auto']} stroke="var(--color-text-subtle)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: 'var(--color-text)' }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="var(--color-primary)" 
                    strokeWidth={2} 
                    dot={{ r: 4, fill: 'var(--color-surface)', strokeWidth: 2 }} 
                    activeDot={{ r: 6 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="trend" 
                    stroke="var(--color-text-subtle)" 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                    dot={false} 
                    activeDot={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness score trend</h3>
              <ChartInfoTooltip 
                description="Daily readiness scores calculated from sleep, soreness, stress, and motivation."
                goal="Aim for higher readiness scores by prioritizing recovery and managing lifestyle stress."
              />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <LineChart data={readinessSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                  <YAxis domain={[0, 100]} stroke="var(--color-text-subtle)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: 'var(--color-text)' }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-subtle">
              {readinessSeries.length ? 'Higher scores signal stronger recovery capacity.' : 'No readiness data yet.'}
            </p>
          </Card>

          <Card className="p-6 min-w-0">
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness components</h3>
              <ChartInfoTooltip 
                description="Breakdown of specific recovery metrics. Bar colors indicate health levels."
                goal="Identify which factors (e.g. sleep vs stress) are limiting your training capacity."
              />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <ComposedChart data={readinessComponents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="metric" stroke="var(--color-text-subtle)" />
                  <YAxis domain={[1, 5]} stroke="var(--color-text-subtle)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: 'var(--color-text)' }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
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
            <div className="mb-4 flex items-center">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness vs session effort</h3>
              <ChartInfoTooltip 
                description="Correlation between your pre-session readiness and your actual training effort. Quadrants show if you are over-reaching or under-taxing."
                goal="Look for dots in the 'Optimal' quadrant. Consistent 'Risk Zone' dots suggest a need for a deload."
              />
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                <ComposedChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="readiness" type="number" name="Readiness" domain={[0, 100]} stroke="var(--color-text-subtle)" fontSize={10} />
                  <YAxis dataKey="effort" type="number" name="Avg effort" domain={[0, 10]} stroke="var(--color-text-subtle)" fontSize={10} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ 
                      background: 'var(--color-surface)', 
                      border: '1px solid var(--color-border)', 
                      color: 'var(--color-text)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                    itemStyle={{ color: 'var(--color-text)' }}
                    labelStyle={{ color: 'var(--color-text)' }}
                  />
                  
                  {/* Quadrants */}
                  <ReferenceArea x1={0} x2={50} y1={5} y2={10} fill="var(--color-danger)" fillOpacity={0.03} label={{ value: 'Risk Zone', position: 'insideTopLeft', fontSize: 9, fill: 'var(--color-text-subtle)', offset: 10 }} />
                  <ReferenceArea x1={50} x2={100} y1={5} y2={10} fill="var(--color-success)" fillOpacity={0.03} label={{ value: 'Optimal', position: 'insideTopRight', fontSize: 9, fill: 'var(--color-text-subtle)', offset: 10 }} />
                  <ReferenceArea x1={0} x2={50} y1={0} y2={5} fill="var(--color-warning)" fillOpacity={0.03} label={{ value: 'Recovery', position: 'insideBottomLeft', fontSize: 9, fill: 'var(--color-text-subtle)', offset: 10 }} />
                  <ReferenceArea x1={50} x2={100} y1={0} y2={5} fill="var(--color-primary)" fillOpacity={0.03} label={{ value: 'Under-taxing', position: 'insideBottomRight', fontSize: 9, fill: 'var(--color-text-subtle)', offset: 10 }} />
                  
                  <ReferenceLine x={50} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />
                  <ReferenceLine y={5} stroke="var(--color-border)" strokeWidth={1} strokeDasharray="3 3" />

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