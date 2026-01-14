import { toMuscleLabel, toMuscleSlug } from '@/lib/muscle-utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionExercise } from '@/types/domain'

type SessionExerciseSeed = {
  name: string
  focus?: string
  primaryBodyParts?: string[]
  secondaryBodyParts?: string[]
  primaryMuscle?: string
  secondaryMuscles?: string[]
}

type CreateSessionParams = {
  supabase: SupabaseClient
  userId: string
  workoutId: string
  workoutTitle: string
  exercises: SessionExerciseSeed[]
  nameSuffix?: string
}

type CreateSessionResult = {
  sessionId: string
  startedAt: string
  sessionName: string
  exercises: SessionExercise[]
}

const getPrimaryMuscle = (exercise: SessionExerciseSeed) =>
  exercise.primaryBodyParts?.[0] ?? exercise.primaryMuscle ?? exercise.focus ?? 'Full Body'

const getSecondaryMuscles = (exercise: SessionExerciseSeed) =>
  exercise.secondaryBodyParts ?? exercise.secondaryMuscles ?? []

export const createWorkoutSession = async ({
  supabase,
  userId,
  workoutId,
  workoutTitle,
  exercises,
  nameSuffix
}: CreateSessionParams): Promise<CreateSessionResult> => {
  const startedAt = new Date().toISOString()
  const sessionName = nameSuffix ? `${workoutTitle} · ${nameSuffix}` : workoutTitle
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      workout_id: workoutId,
      name: sessionName,
      started_at: startedAt
    })
    .select()
    .single()

  if (sessionError || !sessionData) {
    throw sessionError ?? new Error('Failed to create session.')
  }

  const exercisePayload = exercises.map((exercise, index) => {
    const primaryMuscle = toMuscleSlug(getPrimaryMuscle(exercise), 'full_body')
    const secondaryMuscles = getSecondaryMuscles(exercise)
      .map((muscle) => toMuscleSlug(muscle, null))
      .filter((muscle): muscle is string => Boolean(muscle))
    return {
      session_id: sessionData.id,
      exercise_name: exercise.name,
      primary_muscle: primaryMuscle,
      secondary_muscles: secondaryMuscles,
      order_index: index
    }
  })

  let sessionExercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    order_index: number | null
  }> = []

  if (exercisePayload.length > 0) {
    const { data: insertedExercises, error: exerciseError } = await supabase
      .from('session_exercises')
      .insert(exercisePayload)
      .select('id, exercise_name, primary_muscle, secondary_muscles, order_index')
      .order('order_index', { ascending: true })

    if (exerciseError) throw exerciseError
    sessionExercises = insertedExercises ?? []
  }

  const mappedExercises: SessionExercise[] = sessionExercises.map((exercise, idx) => ({
    id: exercise.id,
    sessionId: sessionData.id,
    name: exercise.exercise_name,
    primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
    secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
    sets: [],
    orderIndex: exercise.order_index ?? idx
  }))

  return {
    sessionId: sessionData.id,
    startedAt,
    sessionName,
    exercises: mappedExercises
  }
}
