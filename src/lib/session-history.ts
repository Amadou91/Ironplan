import type { SupabaseClient } from '@supabase/supabase-js'
import type { MovementPattern } from '@/types/domain'

type SessionHistory = {
  recentExerciseNames?: string[]
  recentMovementPatterns?: MovementPattern[]
  recentPrimaryMuscles?: string[]
}

type SessionHistoryRow = {
  generated_exercises: Array<{
    name?: string
    movementPattern?: string | null
    primaryMuscle?: string | null
  }> | null
}

export const fetchTemplateHistory = async (
  supabase: SupabaseClient,
  templateId: string,
  limit = 3
): Promise<SessionHistory> => {
  const { data, error } = await supabase
    .from('sessions')
    .select('generated_exercises')
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

  ;(data as SessionHistoryRow[] | null)?.forEach((row) => {
    const generated = Array.isArray(row.generated_exercises) ? row.generated_exercises : []
    generated.forEach((exercise) => {
      if (exercise.name) recentExerciseNames.push(exercise.name)
      if (exercise.movementPattern) recentMovementPatterns.push(exercise.movementPattern as MovementPattern)
      if (exercise.primaryMuscle) recentPrimaryMuscles.push(exercise.primaryMuscle)
    })
  })

  return {
    recentExerciseNames,
    recentMovementPatterns,
    recentPrimaryMuscles
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

  return (data as any[]).map((row) => ({
    weight: Number(row.weight),
    weightUnit: row.weight_unit,
    reps: Number(row.reps),
    performedAt: row.performed_at,
    exerciseName: row.session_exercise.exercise_name
  }))
}

