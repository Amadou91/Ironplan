'use server'

import { CHRONIC_LOAD_WINDOW_DAYS, MS_PER_DAY } from '@/constants/training'
import { createClient } from '@/lib/supabase/server'
import { summarizeTrainingLoad, type TrainingLoadSummary } from '@/lib/training-metrics'
import type { LoadType, MetricProfile, WeightUnit } from '@/types/domain'

const EMPTY_TRAINING_LOAD_SUMMARY: TrainingLoadSummary = {
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

type TrainingLoadSetRow = {
  reps: number | null
  weight: number | null
  implement_count: number | null
  load_type: string | null
  weight_unit: string | null
  rpe: number | null
  rir: number | null
  completed: boolean | null
  performed_at: string | null
  duration_seconds: number | null
  rest_seconds_actual: number | null
}

type TrainingLoadExerciseRow = {
  metric_profile: string | null
  sets: TrainingLoadSetRow[] | null
}

type TrainingLoadSessionRow = {
  started_at: string
  ended_at: string | null
  session_exercises: TrainingLoadExerciseRow[] | null
}

type TrainingLoadActionResult =
  | { success: true; data: TrainingLoadSummary }
  | { success: false; error: string }

export async function getTrainingLoadSummaryAction(): Promise<TrainingLoadActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - CHRONIC_LOAD_WINDOW_DAYS * MS_PER_DAY)

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'started_at, ended_at, session_exercises(metric_profile, sets(reps, weight, implement_count, load_type, weight_unit, rpe, rir, completed, performed_at, duration_seconds, rest_seconds_actual))'
    )
    .eq('user_id', user.id)
    .gte('started_at', windowStart.toISOString())
    .order('started_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const sessions = (data ?? []) as TrainingLoadSessionRow[]
  if (sessions.length === 0) {
    return { success: true, data: EMPTY_TRAINING_LOAD_SUMMARY }
  }

  const mappedSessions = sessions.map((session) => ({
    startedAt: session.started_at,
    endedAt: session.ended_at,
    sets: (session.session_exercises ?? []).flatMap((exercise) =>
      (exercise.sets ?? [])
        .filter((set) => set.completed !== false)
        .map((set) => ({
          metricProfile: (exercise.metric_profile as MetricProfile) ?? null,
          reps: set.reps ?? null,
          weight: set.weight ?? null,
          implementCount: set.implement_count ?? null,
          loadType: (set.load_type as LoadType) ?? null,
          weightUnit: (set.weight_unit as WeightUnit) ?? null,
          rpe: typeof set.rpe === 'number' ? set.rpe : null,
          rir: typeof set.rir === 'number' ? set.rir : null,
          performedAt: set.performed_at ?? null,
          durationSeconds: set.duration_seconds ?? null,
          restSecondsActual: set.rest_seconds_actual ?? null
        }))
    )
  }))

  return { success: true, data: summarizeTrainingLoad(mappedSessions, now) }
}
