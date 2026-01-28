import type { SupabaseClient } from '@supabase/supabase-js'
import type { MovementPattern } from '@/types/domain'

type SessionHistory = {
  recentExerciseNames?: string[]
  recentMovementPatterns?: MovementPattern[]
  recentPrimaryMuscles?: string[]
}

type SessionRow = {
  id: string
  started_at: string
  session_exercises: Array<{
    exercise_name: string
    primary_muscle: string
    exercise_catalog: {
      movement_pattern: string | null
    } | null
  }>
}

export const fetchTemplateHistory = async (
  supabase: SupabaseClient,
  templateId: string,
  limit = 3
): Promise<SessionHistory> => {
  // Query sessions for this template, and join their exercises
  const { data, error } = await supabase
    .from('sessions')
    .select(`
      id,
      started_at,
      session_exercises (
        exercise_name,
        primary_muscle,
        exercise_catalog (
          movement_pattern
        )
      )
    `)
    .eq('template_id', templateId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to load session history', error)
    return {}
  }

  const recentExerciseNames: string[] = []
  const recentMovementPatterns: MovementPattern[] = []
  const recentPrimaryMuscles: string[] = []

  const sessions = (data as unknown) as SessionRow[]

  sessions?.forEach((session) => {
    session.session_exercises?.forEach((ex) => {
      if (ex.exercise_name) recentExerciseNames.push(ex.exercise_name)
      if (ex.primary_muscle) recentPrimaryMuscles.push(ex.primary_muscle)
      if (ex.exercise_catalog?.movement_pattern) {
        recentMovementPatterns.push(ex.exercise_catalog.movement_pattern as MovementPattern)
      }
    })
  })

  return {
    recentExerciseNames: Array.from(new Set(recentExerciseNames)),
    recentMovementPatterns: Array.from(new Set(recentMovementPatterns)),
    recentPrimaryMuscles: Array.from(new Set(recentPrimaryMuscles))
  }
}

export type ExerciseHistoryPoint = {
  weight: number
  weightUnit: string
  reps: number
  performedAt: string
  exerciseName: string
}

type ExerciseHistoryRow = {
  weight: number | null
  weight_unit: string
  reps: number | null
  performed_at: string
  session_exercise: {
    exercise_name: string
  }
}

export const fetchExerciseHistory = async (
  supabase: SupabaseClient,
  userId: string
): Promise<ExerciseHistoryPoint[]> => {
  const { data, error } = await supabase
    .from('sets')
    .select(`
      weight,
      weight_unit,
      reps,
      performed_at,
      session_exercise:session_exercises!inner (
        exercise_name,
        session:sessions!inner (
          user_id
        )
      )
    `)
    .eq('session_exercise.session.user_id', userId)
    .eq('completed', true)
    .not('weight', 'is', null)
    .order('performed_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Failed to fetch exercise history:', error)
    return []
  }

  return (data as unknown as ExerciseHistoryRow[]).map((row) => ({
    weight: Number(row.weight),
    weightUnit: row.weight_unit,
    reps: Number(row.reps),
    performedAt: row.performed_at,
    exerciseName: row.session_exercise.exercise_name
  }))
}

