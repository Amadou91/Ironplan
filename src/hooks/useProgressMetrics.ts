'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { 
  transformSessionsToEffortTrend,
  transformSessionsToExerciseTrend,
  transformSetsToMuscleBreakdown,
  transformSessionsToBodyWeightTrend,
  transformSessionsToReadinessTrend,
  formatDateForInput
} from '@/lib/transformers/chart-data'
import { 
  calculateTrainingStatus, 
  processWeeklyData,
  type SessionRow 
} from '@/lib/transformers/progress-data'
import { isMuscleMatch } from '@/lib/muscle-utils'
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

export const createPastRange = (days: number) => {
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(today.getDate() - (days - 1))
  return { start, end: today }
}

export type TemplateRow = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
}

export type ReadinessRow = {
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

export function useProgressMetrics() {
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
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)
  const [bodyWeightHistory, setBodyWeightHistory] = useState<Array<{ recorded_at: string; weight_lb: number; source: string }>>([])

  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates])
  const exerciseLibraryByName = useMemo(
    () =>
      new Map(
        EXERCISE_LIBRARY.filter((e) => e.name).map((exercise) => [exercise.name.toLowerCase(), exercise])
      ),
    []
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
        setError('Unable to load sessions. Please try again.')
      } else {
        const nextSessions = (sessionData as SessionRow[]) ?? []
        setSessions(nextSessions)
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
  }, [ensureSession, supabase, user, userLoading, startDate, endDate])

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
      
      if (startDate) {
        const start = new Date(startDate)
        start.setDate(start.getDate() - 1)
        query = query.gte('recorded_at', start.toISOString())
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 2)
        query = query.lt('recorded_at', end.toISOString())
      }

      const { data } = await query
      if (data) setBodyWeightHistory(data)
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
      sleep: 0, soreness: 0, stress: 0, motivation: 0, score: 0, scoreCount: 0, count: 0
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
    return { maxWeight, bestReps, bestE1rm: Math.round(bestE1rm) }
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

  return {
    user,
    userLoading,
    loading,
    error,
    setError,
    sessions,
    setSessions,
    filteredSessions,
    templates,
    templateById,
    exerciseOptions,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedMuscle,
    setSelectedMuscle,
    selectedExercise,
    setSelectedExercise,
    hasMoreSessions,
    setSessionPage,
    trainingLoadSummary,
    aggregateMetrics,
    prMetrics,
    readinessAverages,
    readinessSeries,
    readinessComponents,
    readinessCorrelation,
    readinessTrendLine,
    volumeTrend,
    effortTrend,
    exerciseTrend,
    muscleBreakdown,
    bodyWeightData,
    sessionsPerWeek,
    getSessionTitle,
    exerciseLibraryByName,
    ensureSession
  }
}
