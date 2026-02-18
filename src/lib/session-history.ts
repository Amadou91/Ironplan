import type { SupabaseClient } from '@supabase/supabase-js'
import type { MovementPattern } from '@/types/domain'
import { templateHistoryRowSchema, exerciseHistoryRowSchema, safeParseArray } from '@/lib/validation/schemas'

type SessionHistory = {
  recentExerciseNames?: string[]
  recentMovementPatterns?: MovementPattern[]
  recentPrimaryMuscles?: string[]
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

  const sessions = safeParseArray(templateHistoryRowSchema, data, 'template history')

  sessions.forEach((session) => {
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

  const validated = safeParseArray(exerciseHistoryRowSchema, data, 'exercise history')

  return validated.map((row) => ({
    weight: Number(row.weight),
    weightUnit: row.weight_unit,
    reps: Number(row.reps),
    performedAt: row.performed_at,
    exerciseName: row.session_exercise.exercise_name
  }))
}

