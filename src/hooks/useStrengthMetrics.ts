import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { 
  transformSessionsToEffortTrend,
  transformSessionsToExerciseTrend,
  transformSetsToMuscleBreakdown
} from '@/lib/transformers/chart-data'
import { 
  processWeeklyData,
  type SessionRow 
} from '@/lib/transformers/progress-data'
import { isMuscleMatch } from '@/lib/muscle-utils'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import {
  computeLoadComposition,
  mapSetLikeToMetricsSet
} from '@/lib/transformers/metric-set'
import {
  aggregateHardSets,
  aggregateTonnage,
  computeSetE1rm,
  computeRelativeStrength,
  getEffortScore,
  getWeekKey,
  toWeightInPounds,
  getTotalWeight
} from '@/lib/session-metrics'
import { SESSION_PAGE_SIZE, CHRONIC_LOAD_WINDOW_DAYS, MS_PER_DAY } from '@/constants/training'
import { safeParseArray, sessionRowSchema } from '@/lib/validation/schemas'
import type { WeightUnit, MetricProfile } from '@/types/domain'
import { formatDateInET, getUTCDateRangeFromET } from '@/lib/date-utils'
import { getTrainingLoadSummaryAction } from '@/app/progress/training-load-actions'
import type { TrainingLoadSummary } from '@/lib/training-metrics'

const DEFAULT_TRAINING_LOAD_SUMMARY: TrainingLoadSummary = {
  acuteLoad: 0,
  chronicLoad: 0,
  chronicWeeklyAvg: 0,
  loadRatio: 0,
  status: 'balanced',
  daysSinceLast: null,
  insufficientData: true,
  isInitialPhase: true,
  weeklyLoadTrend: []
}

export function useStrengthMetrics(options: { 
  startDate?: string; 
  endDate?: string; 
  selectedMuscle?: string; 
  selectedExercise?: string 
} = {}) {
  const { startDate, endDate, selectedMuscle = 'all', selectedExercise = 'all' } = options
  const supabase = useSupabase()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)
  const [trainingLoadSummary, setTrainingLoadSummary] = useState<TrainingLoadSummary>(DEFAULT_TRAINING_LOAD_SUMMARY)

  const { catalog } = useExerciseCatalog()
  const exerciseLibraryByName = useMemo(
    () =>
      new Map(
        catalog.filter((e) => e.name).map((exercise) => [exercise.name.toLowerCase(), exercise])
      ),
    [catalog]
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

  const getSessionTitle = useCallback((session: SessionRow) => session.name, [])

  useEffect(() => {
    if (userLoading || !user) return

    const loadSessions = async () => {
      const session = await ensureSession()
      if (!session) return
      setLoading(true)
      setError(null)

      let query = supabase
        .from('sessions')
        .select(
          'id, name, template_id, started_at, ended_at, status, minutes_available, body_weight_lb, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, implement_count, load_type, rpe, rir, completed, performed_at, weight_unit, duration_seconds, rest_seconds_actual))'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      // Apply date filters at the database level for efficiency.
      // We convert the ET date strings to UTC ranges to ensure full ET day coverage.
      if (startDate) {
        const { start: utcStart } = getUTCDateRangeFromET(startDate)
        // Include extra days for chronic load calculation
        const startDateObj = new Date(utcStart)
        const chronicStart = new Date(startDateObj.getTime() - CHRONIC_LOAD_WINDOW_DAYS * MS_PER_DAY)
        query = query.gte('started_at', chronicStart.toISOString())
      }
      
      if (endDate) {
        const { end: utcEnd } = getUTCDateRangeFromET(endDate)
        query = query.lte('started_at', utcEnd)
      }
      
      // When date filters are active, fetch everything and treat as page 0.
      // Pagination only applies when no date filters are set.
      const effectivePage = startDate || endDate ? 0 : sessionPage
      if (!startDate && !endDate) {
        const from = effectivePage * SESSION_PAGE_SIZE
        const to = from + SESSION_PAGE_SIZE - 1
        query = query.range(from, to)
      }

      const { data: sessionData, error: fetchError } = await query

      if (fetchError) {
        setError('Unable to load sessions. Please try again.')
      } else {
        // Validate response data with Zod schema
        const validatedSessions = safeParseArray(sessionRowSchema, sessionData ?? [], 'useStrengthMetrics.sessions')
        const nextSessions = validatedSessions as SessionRow[]
        if (effectivePage > 0) {
          setSessions(prev => [...prev, ...nextSessions])
        } else {
          setSessions(nextSessions)
        }
        // Only show "load more" when using pagination (no date filters)
        setHasMoreSessions(!startDate && !endDate && nextSessions.length === SESSION_PAGE_SIZE)
      }
      setLoading(false)
    }

    loadSessions()
  }, [ensureSession, supabase, user, userLoading, startDate, endDate, sessionPage])

  useEffect(() => {
    if (!userLoading && !user) {
      setTrainingLoadSummary(DEFAULT_TRAINING_LOAD_SUMMARY)
    }
  }, [user, userLoading])

  useEffect(() => {
    if (userLoading || !user) return
    let cancelled = false

    const loadTrainingSummary = async () => {
      const result = await getTrainingLoadSummaryAction()
      if (cancelled) return
      if (result.success && result.data) {
        setTrainingLoadSummary(result.data)
      } else {
        setTrainingLoadSummary(DEFAULT_TRAINING_LOAD_SUMMARY)
      }
    }

    void loadTrainingSummary()
    return () => {
      cancelled = true
    }
  }, [user, userLoading, sessions.length])

  const filteredSessions = useMemo(() => {
    const seenIds = new Set<string>()
    return sessions.filter((session) => {
      if (seenIds.has(session.id)) return false
      seenIds.add(session.id)
      const date = new Date(session.started_at)
      const localDay = formatDateInET(date)
      if (startDate && localDay < startDate) return false
      if (endDate && localDay > endDate) return false
      if (selectedExercise !== 'all' && !session.session_exercises.some(e => e.exercise_name === selectedExercise)) return false
      if (selectedMuscle !== 'all' && !session.session_exercises.some(exercise => {
        const libEntry = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())
        return isMuscleMatch(selectedMuscle, libEntry?.primaryMuscle || exercise.primary_muscle, libEntry?.secondaryMuscles || exercise.secondary_muscles || [])
      })) return false
      return true
    }).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  }, [sessions, startDate, endDate, selectedExercise, selectedMuscle, exerciseLibraryByName])

  const allSets = useMemo(() => {
    const sets = filteredSessions.flatMap((session) =>
      session.session_exercises.flatMap((exercise) => {
        if (selectedExercise !== 'all' && exercise.exercise_name !== selectedExercise) return []
        const libEntry = exerciseLibraryByName.get(exercise.exercise_name.toLowerCase())
        return (exercise.sets ?? []).flatMap((set) =>
          set.completed === false ? [] : [{
            sessionId: session.id,
            sessionName: getSessionTitle(session),
            startedAt: session.started_at,
            exerciseName: exercise.exercise_name,
            primaryMuscle: libEntry?.primaryMuscle || exercise.primary_muscle,
            secondaryMuscles: libEntry?.secondaryMuscles || exercise.secondary_muscles || [],
            metricProfile: exercise.metric_profile ? (exercise.metric_profile as MetricProfile) : undefined,
            ...set
          }]
        )
      })
    )
    return selectedMuscle === 'all' ? sets : sets.filter(set => isMuscleMatch(selectedMuscle, set.primaryMuscle, set.secondaryMuscles))
  }, [filteredSessions, getSessionTitle, selectedMuscle, selectedExercise, exerciseLibraryByName])

  const aggregateMetrics = useMemo(() => {
    const metricSets = allSets.map((set) => mapSetLikeToMetricsSet(set))
    const effortTotals = metricSets.reduce((acc, set) => {
      const effort = getEffortScore({ rpe: set.rpe, rir: set.rir })
      if (typeof effort === 'number') { acc.total += effort; acc.count += 1 }
      return acc
    }, { total: 0, count: 0 })

    const sessionMap = new Map(filteredSessions.map(s => [s.id, s.body_weight_lb]))
    let bestE1rmValue = 0
    let bestE1rmExercise = ''
    let bestRelativeStrength = 0
    allSets.forEach(set => {
      const libEntry = exerciseLibraryByName.get(set.exerciseName.toLowerCase())
      const e1rm = computeSetE1rm({
        metricProfile: set.metricProfile ?? undefined,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        implementCount: set.implement_count ?? null,
        loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
        weightUnit: (set.weight_unit as WeightUnit) ?? null,
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null,
        completed: true
      }, null, libEntry?.e1rmEligible, libEntry?.movementPattern)
      
      if (!e1rm) return

      if (e1rm > bestE1rmValue) {
        bestE1rmValue = e1rm
        bestE1rmExercise = set.exerciseName
      }

      const bodyWeight = sessionMap.get(set.sessionId)
      const relativeStrength = computeRelativeStrength(e1rm, bodyWeight ?? null)
      if (typeof relativeStrength === 'number' && relativeStrength > bestRelativeStrength) {
        bestRelativeStrength = relativeStrength
      }
    })

    const tonnage = Math.round(aggregateTonnage(metricSets))
    const loadComposition = computeLoadComposition(metricSets)
    const workload = Math.round(loadComposition.totalLoad)
    const strengthLoad = Math.round(loadComposition.strengthLoad)
    const recoveryLoad = Math.round(loadComposition.recoveryLoad)
    const strengthLoadPct = workload > 0 ? Math.round((strengthLoad / workload) * 100) : 0
    const recoveryLoadPct = workload > 0 ? Math.round((recoveryLoad / workload) * 100) : 0
    const avgWorkload = effortTotals.count ? Math.round(workload / effortTotals.count) : 0

    return {
      tonnage,
      hardSets: aggregateHardSets(metricSets),
      bestE1rm: Math.round(bestE1rmValue),
      bestE1rmExercise,
      bestRelativeStrength: Number(bestRelativeStrength.toFixed(2)),
      workload,
      strengthLoad,
      recoveryLoad,
      strengthLoadPct,
      recoveryLoadPct,
      avgWorkload,
      avgEffort: effortTotals.count ? Number((effortTotals.total / effortTotals.count).toFixed(1)) : null
    }
  }, [allSets, exerciseLibraryByName, filteredSessions])

  const prMetrics = useMemo(() => {
    let maxWeight = 0, bestE1rm = 0, bestReps = 0
    allSets.forEach(set => {
      const reps = set.reps ?? 0, weight = set.weight ?? 0
      if (!reps || !weight) return
      const totalWeight = getTotalWeight(weight, (set.load_type as 'total' | 'per_implement' | null) ?? null, set.implement_count ?? null)
      const normalizedWeight = toWeightInPounds(totalWeight, (set.weight_unit as WeightUnit) ?? null)
      maxWeight = Math.max(maxWeight, normalizedWeight)
      bestReps = Math.max(bestReps, reps)
      const libEntry = exerciseLibraryByName.get(set.exerciseName.toLowerCase())
      const e1rm = computeSetE1rm({
        metricProfile: set.metricProfile ?? undefined,
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        implementCount: set.implement_count ?? null,
        loadType: (set.load_type as 'total' | 'per_implement' | null) ?? null,
        weightUnit: (set.weight_unit as WeightUnit) ?? null,
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null,
        completed: true
      }, undefined, libEntry?.e1rmEligible, libEntry?.movementPattern)
      if (e1rm) bestE1rm = Math.max(bestE1rm, e1rm)
    })
    return { maxWeight, bestReps, bestE1rm: Math.round(bestE1rm) }
  }, [allSets, exerciseLibraryByName])

  const sessionsPerWeek = useMemo(() => {
    const weeks = new Set<string>()
    filteredSessions.forEach(s => weeks.add(getWeekKey(s.started_at)))
    return weeks.size ? Number((filteredSessions.length / weeks.size).toFixed(1)) : 0
  }, [filteredSessions])

  const exerciseOptions = useMemo(() => {
    const names = new Set<string>()
    sessions.forEach((session) => {
      session.session_exercises.forEach((exercise) => {
        names.add(exercise.exercise_name)
      })
    })
    return Array.from(names).sort()
  }, [sessions])

  const bodyWeightBySessionId = useMemo(() => {
    const map = new Map<string, number>()
    sessions.forEach(s => {
      if (s.body_weight_lb) map.set(s.id, s.body_weight_lb)
    })
    return map
  }, [sessions])

  return {
    user, userLoading,
    loading, error, setError, sessions, setSessions, filteredSessions, aggregateMetrics, prMetrics,
    trainingLoadSummary, sessionsPerWeek, exerciseOptions,
    sessionPage, setSessionPage, getSessionTitle, ensureSession, exerciseLibraryByName,
    volumeTrend: useMemo(() => processWeeklyData(allSets, filteredSessions, { startDate, endDate }), [allSets, filteredSessions, startDate, endDate]),
    effortTrend: useMemo(() => transformSessionsToEffortTrend(allSets), [allSets]),
    exerciseTrend: useMemo(() => transformSessionsToExerciseTrend(allSets, exerciseLibraryByName, selectedExercise, bodyWeightBySessionId), [allSets, selectedExercise, exerciseLibraryByName, bodyWeightBySessionId]),
    muscleBreakdown: useMemo(() => transformSetsToMuscleBreakdown(allSets, selectedMuscle, { startDate, endDate }), [allSets, selectedMuscle, startDate, endDate]),
    hasMoreSessions
  }
}
