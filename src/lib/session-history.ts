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
