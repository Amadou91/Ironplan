/**
 * Maps raw Supabase session query payloads to the domain WorkoutSession model.
 * Shared between useSessionData and page-level session loaders.
 */

import { toMuscleLabel } from '@/lib/muscle-utils'
import { getPrimaryFocusArea, resolveSessionFocusAreas } from '@/lib/session-focus'
import type {
  WeightUnit, WorkoutSession, WorkoutSet,
  MetricProfile, LoadType, SessionExercise
} from '@/types/domain'

export type SessionPayload = {
  id: string
  user_id: string | null
  name: string
  template_id: string | null
  session_focus?: string | null
  session_goal?: string | null
  session_intensity?: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  timezone?: string | null
  body_weight_lb?: number | null
  session_notes?: string | null
  weight_unit?: string | null
  session_focus_areas?: Array<{ focus_area: string | null }>
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    metric_profile: string | null
    order_index: number | null
    sets: Array<{
      id: string
      set_number: number | null
      reps: number | null
      weight: number | null
      implement_count: number | null
      load_type: string | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      performed_at: string | null
      weight_unit: string | null
      duration_seconds: number | null
      distance: number | null
      distance_unit: string | null
      rest_seconds_actual: number | null
      extras: Record<string, unknown> | null
      extra_metrics: Record<string, unknown> | null
    }>
  }>
}

/** Maps a raw Supabase session payload to the domain WorkoutSession model. */
export function mapSessionPayload(payload: SessionPayload): WorkoutSession {
  const rawExercises = payload.session_exercises
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((exercise, idx) => ({
      id: exercise.id, sessionId: payload.id,
      name: exercise.exercise_name,
      primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
      secondaryMuscles: (exercise.secondary_muscles ?? []).map((m) => toMuscleLabel(m)),
      metricProfile: (exercise.metric_profile as MetricProfile) ?? undefined,
      orderIndex: exercise.order_index ?? idx,
      sets: (exercise.sets ?? [])
        .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
        .map((set, setIdx) => ({
          id: set.id, setNumber: set.set_number ?? setIdx + 1,
          reps: set.reps ?? '', weight: set.weight ?? '',
          implementCount: set.implement_count ?? '',
          loadType: (set.load_type as LoadType | null) ?? '',
          rpe: set.rpe ?? '', rir: set.rir ?? '',
          performedAt: set.performed_at ?? undefined,
          completed: set.completed ?? false,
          weightUnit: (set.weight_unit as WeightUnit) ?? 'lb',
          durationSeconds: set.duration_seconds ?? undefined,
          distance: set.distance ?? undefined,
          distanceUnit: set.distance_unit ?? undefined,
          restSecondsActual: set.rest_seconds_actual ?? undefined,
          extras: set.extras as Record<string, string | null> ?? undefined,
          extraMetrics: set.extra_metrics ?? undefined
        })) as WorkoutSet[]
    })) as SessionExercise[]

  // Deduplicate exercises by name
  const exerciseMap = new Map<string, typeof rawExercises[0]>()
  for (const ex of rawExercises) {
    const key = ex.name.toLowerCase()
    if (exerciseMap.has(key)) {
      const existing = exerciseMap.get(key)!
      const setMap = new Map(existing.sets.map(s => [s.id, s]))
      ex.sets.forEach(s => setMap.set(s.id, s))
      const combinedSets = Array.from(setMap.values())
      combinedSets.sort((a, b) => a.setNumber - b.setNumber)
      combinedSets.forEach((s, i) => s.setNumber = i + 1)
      existing.sets = combinedSets
    } else {
      exerciseMap.set(key, ex)
    }
  }

  return {
    id: payload.id,
    userId: payload.user_id ?? '',
    templateId: payload.template_id ?? undefined,
    name: payload.name,
    sessionFocus: getPrimaryFocusArea(
      payload.session_focus_areas?.map((row) => row.focus_area),
      (payload.session_focus as WorkoutSession['sessionFocus']) ?? 'full_body'
    ),
    sessionFocusAreas: resolveSessionFocusAreas(
      payload.session_focus_areas?.map((row) => row.focus_area),
      (payload.session_focus as WorkoutSession['sessionFocus']) ?? 'full_body'
    ),
    sessionGoal: (payload.session_goal as WorkoutSession['sessionGoal']) ?? null,
    sessionIntensity: (payload.session_intensity as WorkoutSession['sessionIntensity']) ?? null,
    startedAt: payload.started_at,
    endedAt: payload.ended_at ?? undefined,
    status: (payload.status as WorkoutSession['status']) ?? 'in_progress',
    timezone: payload.timezone ?? null,
    sessionNotes: payload.session_notes ?? undefined,
    bodyWeightLb: payload.body_weight_lb ?? null,
    weightUnit: (payload.weight_unit as WeightUnit) ?? undefined,
    exercises: Array.from(exerciseMap.values()).sort((a, b) => a.orderIndex - b.orderIndex)
  }
}
