import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { 
  transformSessionsToEffortTrend,
  transformSessionsToExerciseTrend,
  transformSetsToMuscleBreakdown,
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
  getEffortScore,
  getWeekKey,
  toWeightInPounds
} from '@/lib/session-metrics'
import type { FocusArea, PlanInput, WeightUnit, MetricProfile } from '@/types/domain'

const SESSION_PAGE_SIZE = 50

export type TemplateRow = {
  id: string
  title: string
  focus: FocusArea
  style: PlanInput['goals']['primary']
  intensity: PlanInput['intensity']
  template_inputs: PlanInput | null
}

export function useStrengthMetrics(options: { 
  startDate?: string; 
  endDate?: string; 
  selectedMuscle?: string; 
  selectedExercise?: string 
} = {}) {
  const { startDate, endDate, selectedMuscle = 'all', selectedExercise = 'all' } = options
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionPage, setSessionPage] = useState(0)
  const [hasMoreSessions, setHasMoreSessions] = useState(true)

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

      if (startDate) {
        const start = new Date(startDate)
        if (!Number.isNaN(start.getTime())) {
          const chronicStart = new Date(start.getTime() - 28 * 86400000)
          query = query.gte('started_at', chronicStart.toISOString())
        }
      } else {
        const from = sessionPage * SESSION_PAGE_SIZE
        const to = from + SESSION_PAGE_SIZE - 1
        query = query.range(from, to)
      }

      const [{ data: sessionData, error: fetchError }, { data: templateData }] =
        await Promise.all([
          query,
          supabase
            .from('workout_templates')
            .select('id, title, focus, style, intensity, template_inputs')
            .eq('user_id', user.id)
        ])

      if (fetchError) {
        setError('Unable to load sessions. Please try again.')
      } else {
        const nextSessions = (sessionData as SessionRow[]) ?? []
        if (sessionPage > 0) {
          setSessions(prev => [...prev, ...nextSessions])
        } else {
          setSessions(nextSessions)
        }
        setHasMoreSessions(!startDate && nextSessions.length === SESSION_PAGE_SIZE)
      }
      if (templateData) {
        setTemplates((templateData as TemplateRow[]) ?? [])
      }
      setLoading(false)
    }

    loadSessions()
  }, [ensureSession, supabase, user, userLoading, startDate, sessionPage])

  const filteredSessions = useMemo(() => {
    const seenIds = new Set<string>()
    return sessions.filter((session) => {
      if (seenIds.has(session.id)) return false
      seenIds.add(session.id)
      const date = new Date(session.started_at)
      const localDay = formatDateForInput(date)
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
  }, [filteredSessions, getSessionTitle, selectedMuscle, exerciseLibraryByName])

  const aggregateMetrics = useMemo(() => {
    const metricSets = allSets.map(set => ({
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: (set.weight_unit as WeightUnit) ?? null,
      rpe: typeof set.rpe === 'number' ? set.rpe : null,
      rir: typeof set.rir === 'number' ? set.rir : null
    }))
    const effortTotals = metricSets.reduce((acc, set) => {
      const effort = getEffortScore({ rpe: set.rpe, rir: set.rir })
      if (typeof effort === 'number') { acc.total += effort; acc.count += 1 }
      return acc
    }, { total: 0, count: 0 })

    let bestE1rmValue = 0, bestE1rmExercise = ''
    allSets.forEach(set => {
      const template = sessions.find(s => s.id === set.sessionId)?.template_id ? templateById.get(sessions.find(s => s.id === set.sessionId)!.template_id!) : null
      const e1rm = computeSetE1rm(set, template?.style, exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible)
      if (e1rm && e1rm > bestE1rmValue) { bestE1rmValue = e1rm; bestE1rmExercise = set.exerciseName }
    })

    const tonnage = Math.round(aggregateTonnage(metricSets))
    const workload = Math.round(metricSets.reduce((sum, set) => {
      return sum + computeSetLoad({
        ...set,
        metricProfile: undefined // We don't have it easily here, computeSetLoad defaults to strength
      })
    }, 0))
    const avgWorkload = effortTotals.count ? Math.round(workload / effortTotals.count) : 0

    return {
      tonnage,
      hardSets: aggregateHardSets(metricSets),
      bestE1rm: Math.round(bestE1rmValue),
      bestE1rmExercise,
      workload,
      avgWorkload,
      avgEffort: effortTotals.count ? Number((effortTotals.total / effortTotals.count).toFixed(1)) : null
    }
  }, [allSets, sessions, templateById, exerciseLibraryByName])

  const prMetrics = useMemo(() => {
    let maxWeight = 0, bestE1rm = 0, bestReps = 0
    allSets.forEach(set => {
      const reps = set.reps ?? 0, weight = set.weight ?? 0
      if (!reps || !weight) return
      const normalizedWeight = toWeightInPounds(weight, (set.weight_unit as WeightUnit) ?? null)
      maxWeight = Math.max(maxWeight, normalizedWeight)
      bestReps = Math.max(bestReps, reps)
      const e1rm = computeSetE1rm(set, undefined, exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible)
      if (e1rm) bestE1rm = Math.max(bestE1rm, e1rm)
    })
    return { maxWeight, bestReps, bestE1rm: Math.round(bestE1rm) }
  }, [allSets, exerciseLibraryByName])

  const trainingLoadSummary = useMemo(() => calculateTrainingStatus(sessions), [sessions])
  
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

  return {
    user, userLoading,
    loading, error, setError, sessions, setSessions, filteredSessions, aggregateMetrics, prMetrics,
    trainingLoadSummary, sessionsPerWeek, templateById, exerciseOptions,
    sessionPage, setSessionPage, getSessionTitle, ensureSession, exerciseLibraryByName,
    volumeTrend: useMemo(() => processWeeklyData(allSets, filteredSessions, { startDate, endDate }), [allSets, filteredSessions, startDate, endDate]),
    effortTrend: useMemo(() => transformSessionsToEffortTrend(allSets), [allSets]),
    exerciseTrend: useMemo(() => transformSessionsToExerciseTrend(allSets, sessions, templateById, exerciseLibraryByName, selectedExercise), [allSets, selectedExercise, sessions, templateById, exerciseLibraryByName]),
    muscleBreakdown: useMemo(() => transformSetsToMuscleBreakdown(allSets, selectedMuscle), [allSets, selectedMuscle]),
    hasMoreSessions
  }
}
