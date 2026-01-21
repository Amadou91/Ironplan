import type { SupabaseClient } from '@supabase/supabase-js'

export const DEV_SEED_MARKER = 'IRONPLAN_DEV_SEED'
export const DEV_SEED_TAG = 'dev_seed'
export const DEV_TEMPLATE_PREFIX = 'DEV SEED - '
export const DEV_SESSION_PREFIX = 'DEV SEED:'

type ExerciseSeed = {
  name: string
  primaryMuscle: string
  secondaryMuscles?: string[]
  sets: Array<{
    reps: number
    weight: number
    weightUnit: 'lb' | 'kg'
    rpe?: number
    setType?: 'working' | 'backoff' | 'drop' | 'amrap'
  }>
}

type SessionSeed = {
  name: string
  templateIndex: number
  daysAgo: number
  minutesAvailable: number
  exercises: ExerciseSeed[]
}

type TemplateSeed = {
  title: string
  focus: string
  style: string
  experience_level: string
  intensity: string
}

export type SeedResult = {
  templates: number
  sessions: number
  exercises: number
  sets: number
  readiness: number
}

export type ClearResult = SeedResult

const isMissingTableError = (error: { message?: string; code?: string }) => {
  const message = error?.message?.toLowerCase() ?? ''
  return error?.code === '42P01' || message.includes('does not exist')
}

export async function seedDevData(supabase: SupabaseClient, userId: string): Promise<SeedResult> {
  const templateSeeds: TemplateSeed[] = [
    {
      title: `${DEV_TEMPLATE_PREFIX}Upper Strength`,
      focus: 'upper',
      style: 'strength',
      experience_level: 'intermediate',
      intensity: 'high'
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Lower Hypertrophy`,
      focus: 'lower',
      style: 'hypertrophy',
      experience_level: 'beginner',
      intensity: 'moderate'
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Full Body Endurance`,
      focus: 'full_body',
      style: 'endurance',
      experience_level: 'beginner',
      intensity: 'low'
    }
  ]

  const { data: templates, error: templateError } = await supabase
    .from('workout_templates')
    .insert(templateSeeds.map((seed) => ({ ...seed, user_id: userId })))
    .select('id, title')

  if (templateError) throw templateError

  const sessionSeeds: SessionSeed[] = [
    {
      name: `${DEV_SESSION_PREFIX} Upper Strength`,
      templateIndex: 0,
      daysAgo: 1,
      minutesAvailable: 50,
      exercises: [
        {
          name: 'Bench Press',
          primaryMuscle: 'chest',
          secondaryMuscles: ['triceps', 'shoulders'],
          sets: [
            { reps: 5, weight: 185, weightUnit: 'lb', rpe: 8, setType: 'working' },
            { reps: 5, weight: 185, weightUnit: 'lb', rpe: 8.5, setType: 'working' },
            { reps: 5, weight: 185, weightUnit: 'lb', rpe: 9, setType: 'working' }
          ]
        },
        {
          name: 'Bent-Over Row',
          primaryMuscle: 'back',
          secondaryMuscles: ['biceps'],
          sets: [
            { reps: 8, weight: 155, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 8, weight: 155, weightUnit: 'lb', rpe: 8, setType: 'working' },
            { reps: 8, weight: 155, weightUnit: 'lb', rpe: 8.5, setType: 'working' }
          ]
        }
      ]
    },
    {
      name: `${DEV_SESSION_PREFIX} Upper Strength (Speed)`,
      templateIndex: 0,
      daysAgo: 6,
      minutesAvailable: 45,
      exercises: [
        {
          name: 'Incline Dumbbell Press',
          primaryMuscle: 'chest',
          secondaryMuscles: ['shoulders', 'triceps'],
          sets: [
            { reps: 10, weight: 60, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 10, weight: 60, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 10, weight: 60, weightUnit: 'lb', rpe: 8, setType: 'working' }
          ]
        },
        {
          name: 'Lat Pulldown',
          primaryMuscle: 'back',
          secondaryMuscles: ['biceps'],
          sets: [
            { reps: 12, weight: 120, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 12, weight: 120, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 12, weight: 120, weightUnit: 'lb', rpe: 8, setType: 'working' }
          ]
        }
      ]
    },
    {
      name: `${DEV_SESSION_PREFIX} Lower Hypertrophy`,
      templateIndex: 1,
      daysAgo: 3,
      minutesAvailable: 55,
      exercises: [
        {
          name: 'Back Squat',
          primaryMuscle: 'quads',
          secondaryMuscles: ['glutes', 'hamstrings'],
          sets: [
            { reps: 8, weight: 225, weightUnit: 'lb', rpe: 8, setType: 'working' },
            { reps: 8, weight: 225, weightUnit: 'lb', rpe: 8.5, setType: 'working' },
            { reps: 8, weight: 225, weightUnit: 'lb', rpe: 9, setType: 'working' }
          ]
        },
        {
          name: 'Romanian Deadlift',
          primaryMuscle: 'hamstrings',
          secondaryMuscles: ['glutes'],
          sets: [
            { reps: 10, weight: 185, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 10, weight: 185, weightUnit: 'lb', rpe: 8, setType: 'working' },
            { reps: 10, weight: 185, weightUnit: 'lb', rpe: 8.5, setType: 'working' }
          ]
        }
      ]
    },
    {
      name: `${DEV_SESSION_PREFIX} Lower Hypertrophy (Pump)`,
      templateIndex: 1,
      daysAgo: 10,
      minutesAvailable: 40,
      exercises: [
        {
          name: 'Leg Press',
          primaryMuscle: 'quads',
          secondaryMuscles: ['glutes'],
          sets: [
            { reps: 12, weight: 270, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 12, weight: 270, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 12, weight: 270, weightUnit: 'lb', rpe: 8, setType: 'working' }
          ]
        },
        {
          name: 'Seated Hamstring Curl',
          primaryMuscle: 'hamstrings',
          secondaryMuscles: ['calves'],
          sets: [
            { reps: 12, weight: 90, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 12, weight: 90, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 12, weight: 90, weightUnit: 'lb', rpe: 8, setType: 'working' }
          ]
        }
      ]
    },
    {
      name: `${DEV_SESSION_PREFIX} Full Body Endurance`,
      templateIndex: 2,
      daysAgo: 2,
      minutesAvailable: 35,
      exercises: [
        {
          name: 'Kettlebell Swing',
          primaryMuscle: 'full_body',
          secondaryMuscles: ['core'],
          sets: [
            { reps: 15, weight: 35, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 15, weight: 35, weightUnit: 'lb', rpe: 7.5, setType: 'working' },
            { reps: 15, weight: 35, weightUnit: 'lb', rpe: 8, setType: 'working' }
          ]
        },
        {
          name: 'Plank',
          primaryMuscle: 'core',
          secondaryMuscles: ['shoulders'],
          sets: [
            { reps: 45, weight: 0, weightUnit: 'lb', rpe: 6, setType: 'working' },
            { reps: 45, weight: 0, weightUnit: 'lb', rpe: 6.5, setType: 'working' },
            { reps: 45, weight: 0, weightUnit: 'lb', rpe: 7, setType: 'working' }
          ]
        }
      ]
    },
    {
      name: `${DEV_SESSION_PREFIX} Full Body Endurance (Circuit)`,
      templateIndex: 2,
      daysAgo: 12,
      minutesAvailable: 30,
      exercises: [
        {
          name: 'Goblet Squat',
          primaryMuscle: 'quads',
          secondaryMuscles: ['glutes'],
          sets: [
            { reps: 12, weight: 40, weightUnit: 'lb', rpe: 6.5, setType: 'working' },
            { reps: 12, weight: 40, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 12, weight: 40, weightUnit: 'lb', rpe: 7.5, setType: 'working' }
          ]
        },
        {
          name: 'Farmer Carry',
          primaryMuscle: 'full_body',
          secondaryMuscles: ['core', 'forearms'],
          sets: [
            { reps: 30, weight: 50, weightUnit: 'lb', rpe: 6.5, setType: 'working' },
            { reps: 30, weight: 50, weightUnit: 'lb', rpe: 7, setType: 'working' },
            { reps: 30, weight: 50, weightUnit: 'lb', rpe: 7.5, setType: 'working' }
          ]
        }
      ]
    }
  ]

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const sessionRows = sessionSeeds.map((seed) => {
    const startedAt = new Date(now - seed.daysAgo * dayMs - 45 * 60 * 1000)
    const endedAt = new Date(now - seed.daysAgo * dayMs - 15 * 60 * 1000)
    return {
      user_id: userId,
      template_id: templates?.[seed.templateIndex]?.id ?? null,
      name: seed.name,
      status: 'completed',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      minutes_available: seed.minutesAvailable,
      generated_exercises: [],
      session_notes: DEV_SEED_MARKER
    }
  })

  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .insert(sessionRows)
    .select('id, name, started_at')

  if (sessionError) throw sessionError

  const seedByName = new Map(sessionSeeds.map((seed) => [seed.name, seed]))
  const sessionExerciseRows: Array<{
    session_id: string
    exercise_name: string
    primary_muscle: string
    secondary_muscles: string[]
    order_index: number
  }> = []

  sessions?.forEach((session) => {
    const seed = seedByName.get(session.name)
    if (!seed) return
    seed.exercises.forEach((exercise, index) => {
      sessionExerciseRows.push({
        session_id: session.id,
        exercise_name: exercise.name,
        primary_muscle: exercise.primaryMuscle,
        secondary_muscles: exercise.secondaryMuscles ?? [],
        order_index: index
      })
    })
  })

  const { data: sessionExercises, error: exerciseError } = await supabase
    .from('session_exercises')
    .insert(sessionExerciseRows)
    .select('id, session_id, exercise_name')

  if (exerciseError) throw exerciseError

  const sessionIdByName = new Map(sessions?.map((session) => [session.name, session.id]))
  const sessionStartedAtById = new Map(sessions?.map((session) => [session.id, session.started_at]))
  const exerciseSeedBySessionId = new Map<string, Map<string, ExerciseSeed>>()
  sessionSeeds.forEach((seed) => {
    const sessionId = sessionIdByName.get(seed.name)
    if (!sessionId) return
    const map = new Map(seed.exercises.map((exercise) => [exercise.name, exercise]))
    exerciseSeedBySessionId.set(sessionId, map)
  })

  const setRows: Array<{
    session_exercise_id: string
    set_number: number
    reps: number
    weight: number
    rpe: number | null
    completed: boolean
    performed_at: string
    weight_unit: 'lb' | 'kg'
    set_type: string
  }> = []

  sessionExercises?.forEach((exerciseRow) => {
    const seedMap = exerciseSeedBySessionId.get(exerciseRow.session_id)
    const seed = seedMap?.get(exerciseRow.exercise_name)
    if (!seed) return
    seed.sets.forEach((set, index) => {
      const performedAt = sessionStartedAtById.get(exerciseRow.session_id) ?? new Date().toISOString()
      setRows.push({
        session_exercise_id: exerciseRow.id,
        set_number: index + 1,
        reps: set.reps,
        weight: set.weight,
        rpe: set.rpe ?? null,
        completed: true,
        performed_at: performedAt,
        weight_unit: set.weightUnit,
        set_type: set.setType ?? 'working'
      })
    })
  })

  const { data: sets, error: setError } = await supabase
    .from('sets')
    .insert(setRows)
    .select('id')

  if (setError) throw setError

  let readinessCount = 0
  if (sessions?.length) {
    const readinessRows = sessions.map((session) => ({
      session_id: session.id,
      user_id: userId,
      recorded_at: session.started_at,
      sleep_quality: 4,
      muscle_soreness: 3,
      stress_level: 2,
      motivation: 4,
      readiness_score: 78,
      readiness_level: 'steady'
    }))

    const { data: readinessRowsInserted, error: readinessError } = await supabase
      .from('session_readiness')
      .insert(readinessRows)
      .select('id')

    if (readinessError && !isMissingTableError(readinessError)) throw readinessError
    readinessCount = readinessRowsInserted?.length ?? 0
  }

  return {
    templates: templates?.length ?? 0,
    sessions: sessions?.length ?? 0,
    exercises: sessionExercises?.length ?? 0,
    sets: sets?.length ?? 0,
    readiness: readinessCount
  }
}

export async function clearDevData(supabase: SupabaseClient, userId: string): Promise<ClearResult> {
  const { data: templates } = await supabase
    .from('workout_templates')
    .select('id')
    .eq('user_id', userId)
    .ilike('title', `${DEV_TEMPLATE_PREFIX}%`)

  const templateIds = templates?.map((row) => row.id) ?? []

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .or(`session_notes.eq.${DEV_SEED_MARKER}${templateIds.length ? `,template_id.in.(${templateIds.join(',')})` : ''}`)

  const sessionIds = sessions?.map((row) => row.id) ?? []

  let readinessDeleted = 0
  if (sessionIds.length) {
    const { data: readinessRows, error: readinessError } = await supabase
      .from('session_readiness')
      .delete()
      .in('session_id', sessionIds)
      .select('id')

    if (readinessError && !isMissingTableError(readinessError)) throw readinessError
    readinessDeleted = readinessRows?.length ?? 0

    const { error: sessionDeleteError } = await supabase
      .from('sessions')
      .delete()
      .in('id', sessionIds)

    if (sessionDeleteError) throw sessionDeleteError
  }

  if (templateIds.length) {
    const { error: templateDeleteError } = await supabase
      .from('workout_templates')
      .delete()
      .in('id', templateIds)

    if (templateDeleteError) throw templateDeleteError
  }

  return {
    templates: templateIds.length,
    sessions: sessionIds.length,
    exercises: 0,
    sets: 0,
    readiness: readinessDeleted
  }
}
