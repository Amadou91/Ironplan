import { summarizeTrainingLoad } from '@/lib/training-metrics'
import { 
  transformSessionsToVolumeTrend,
  type AnalyzedSet
} from '@/lib/transformers/chart-data'
import type { MetricProfile } from '@/types/domain'

export type SessionRow = {
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

export function calculateTrainingStatus(sessions: SessionRow[]) {
  const mappedSessions = sessions.map((session) => ({
    startedAt: session.started_at,
    endedAt: session.ended_at,
    sets: session.session_exercises.flatMap((exercise) => {
      return (exercise.sets ?? [])
        .filter((set) => set.completed !== false)
        .map((set) => ({
          metricProfile: (exercise.metric_profile as MetricProfile) ?? null,
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
}

export function processWeeklyData(
  allSets: AnalyzedSet[], 
  filteredSessions: SessionRow[], 
  dateRange: { startDate?: string; endDate?: string }
) {
  return transformSessionsToVolumeTrend(allSets, filteredSessions, dateRange)
}
