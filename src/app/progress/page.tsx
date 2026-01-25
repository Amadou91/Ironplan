'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
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
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { TrainingStatusCard } from '@/components/progress/TrainingStatusCard'
import { WeeklyVolumeChart } from '@/components/progress/WeeklyVolumeChart'
import { MuscleSplitChart } from '@/components/progress/MuscleSplitChart'
import { 
  transformSessionsToEffortTrend,
  transformSessionsToExerciseTrend,
  transformSetsToMuscleBreakdown,
  transformSessionsToBodyWeightTrend,
  transformSessionsToReadinessTrend,
  formatDateTime,
  formatDuration,
  formatDateForInput
} from '@/lib/transformers/chart-data'
import { 
  calculateTrainingStatus, 
  processWeeklyData,
  type SessionRow 
} from '@/lib/transformers/progress-data'
import { toMuscleLabel, isMuscleMatch } from '@/lib/muscle-utils'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import {
  aggregateHardSets,
  aggregateTonnage,
  computeSetE1rm,
  computeSetLoad,
  computeSetTonnage,
  getEffortScore,
  getWeekKey,
  toWeightInPounds
} from '@/lib/session-metrics'
import { computeSessionMetrics } from '@/lib/training-metrics'
import type { FocusArea, Goal, PlanInput } from '@/types/domain'

const SESSION_PAGE_SIZE = 50

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate())

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

const MUSCLE_PRESETS = [
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Legs', value: 'legs' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' }
]

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
  const [activeDatePreset, setActiveDatePreset] = useState<string | null>(null)
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({})
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)
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
    return transformSessionsToReadinessTrend(readinessSessions)
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
                                    metricProfile: exercise.metric_profile,
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
    return processWeeklyData(allSets, filteredSessions, { startDate, endDate })
  }, [allSets, startDate, endDate, filteredSessions])

  const effortTrend = useMemo(() => {
    return transformSessionsToEffortTrend(allSets)
  }, [allSets])

  const exerciseTrend = useMemo(() => {
    return transformSessionsToExerciseTrend(allSets, sessions, templateById, exerciseLibraryByName, selectedExercise)
  }, [allSets, selectedExercise, sessions, templateById, exerciseLibraryByName])

  const muscleBreakdown = useMemo(() => {
    return transformSetsToMuscleBreakdown(allSets, selectedMuscle)
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

  const bodyWeightData = useMemo(() => {
    return transformSessionsToBodyWeightTrend(filteredSessions, bodyWeightHistory, { startDate, endDate })
  }, [bodyWeightHistory, filteredSessions, startDate, endDate])

  const trainingLoadSummary = useMemo(() => {
    return calculateTrainingStatus(sessions)
  }, [sessions])

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
                            metricProfile: exercise.metric_profile,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null
        })
        totals.volume += tonnage
        totals.hardSets += aggregateHardSets([
          {
                              metricProfile: exercise.metric_profile,
            reps: set.reps ?? null,
            weight: set.weight ?? null,
            weightUnit: (set.weight_unit as 'lb' | 'kg' | null) ?? null,
            rpe: typeof set.rpe === 'number' ? set.rpe : null,
            rir: typeof set.rir === 'number' ? set.rir : null
          }
        ])
        totals.workload += computeSetLoad({
                            metricProfile: exercise.metric_profile,
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
                  <MuscleSplitChart data={muscleBreakdown} />
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