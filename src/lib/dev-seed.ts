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
  }>
}

type SessionSeed = {
  name: string
  templateIndex: number
  daysAgo: number
  minutesAvailable: number
  exercises: ExerciseSeed[]
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
  if (process.env.NODE_ENV === 'production') {
    console.warn('Dev seed operations are disabled in production.')
    return { templates: 0, sessions: 0, exercises: 0, sets: 0, readiness: 0 }
  }

  const fullGymInventory = {
    bodyweight: true,
    dumbbells: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    kettlebells: [18, 26, 35, 44, 53],
    bands: ['light', 'medium', 'heavy'],
    barbell: { available: true, plates: [45, 35, 25, 10, 5, 2.5] },
    machines: { cable: true, leg_press: true, treadmill: true, rower: true }
  }

  const templateSeeds = [
    {
      title: `${DEV_TEMPLATE_PREFIX}Upper Strength`,
      focus: 'upper',
      style: 'strength',
      experience_level: 'intermediate',
      intensity: 'high',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: {
        experienceLevel: 'intermediate',
        intensity: 'high',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      }
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Lower Hypertrophy`,
      focus: 'lower',
      style: 'hypertrophy',
      experience_level: 'beginner',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: {
        experienceLevel: 'beginner',
        intensity: 'moderate',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      }
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Full Body Endurance`,
      focus: 'full_body',
      style: 'endurance',
      experience_level: 'beginner',
      intensity: 'low',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: {
        experienceLevel: 'beginner',
        intensity: 'low',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      }
    }
  ]

  const { data: templates, error: templateError } = await supabase
    .from('workout_templates')
    .insert(templateSeeds.map((seed) => ({ ...seed, user_id: userId })))
    .select('id, title')

  if (templateError) throw templateError

  const exerciseTemplates: Record<number, ExerciseSeed[]> = {
    0: [
      {
        name: 'Bench Press',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        sets: [
          { reps: 5, weight: 185, weightUnit: 'lb', rpe: 8 },
          { reps: 5, weight: 185, weightUnit: 'lb', rpe: 8.5 },
          { reps: 5, weight: 185, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Bent-Over Row',
        primaryMuscle: 'back',
        secondaryMuscles: ['biceps'],
        sets: [
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 7.5 },
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 8 },
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 8.5 }
        ]
      }
    ],
    1: [
      {
        name: 'Back Squat',
        primaryMuscle: 'quads',
        secondaryMuscles: ['glutes', 'hamstrings'],
        sets: [
          { reps: 8, weight: 225, weightUnit: 'lb', rpe: 8 },
          { reps: 8, weight: 225, weightUnit: 'lb', rpe: 8.5 },
          { reps: 8, weight: 225, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Romanian Deadlift',
        primaryMuscle: 'hamstrings',
        secondaryMuscles: ['glutes'],
        sets: [
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 7.5 },
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 8 },
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 8.5 }
        ]
      }
    ],
    2: [
      {
        name: 'Kettlebell Swing',
        primaryMuscle: 'glutes',
        secondaryMuscles: ['hamstrings', 'core', 'shoulders'],
        sets: [
          { reps: 15, weight: 35, weightUnit: 'lb', rpe: 7 },
          { reps: 15, weight: 35, weightUnit: 'lb', rpe: 7.5 },
          { reps: 15, weight: 35, weightUnit: 'lb', rpe: 8 }
        ]
      },
      {
        name: 'Plank',
        primaryMuscle: 'core',
        secondaryMuscles: ['shoulders', 'glutes'],
        sets: [
          { reps: 45, weight: 0, weightUnit: 'lb', rpe: 6 },
          { reps: 45, weight: 0, weightUnit: 'lb', rpe: 6.5 },
          { reps: 45, weight: 0, weightUnit: 'lb', rpe: 7 }
        ]
      }
    ]
  }

  const sessionSeeds: SessionSeed[] = []
  const totalSessions = 36
  for (let i = 0; i < totalSessions; i++) {
    const templateIndex = i % 3
    const daysAgo = Math.floor((totalSessions - i) * 2 + Math.random())
    const baseExercises = exerciseTemplates[templateIndex]

    const progressFactor = 0.85 + (1 - daysAgo / 72) * 0.25 // More progression range
    const exercises = baseExercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => ({
        ...s,
        weight: s.weight === 0 ? 0 : Math.max(1, Math.round((s.weight * progressFactor) / 5) * 5),
        reps: s.reps + (Math.random() > 0.7 ? 1 : 0),
        rpe: Math.min(10, Math.max(6, (s.rpe || 7) + (Math.random() * 2 - 0.5)))
      }))
    }))

    sessionSeeds.push({
      name: `${DEV_SESSION_PREFIX} ${templateSeeds[templateIndex].title.replace(DEV_TEMPLATE_PREFIX, '')} ${i + 1}`,
      templateIndex,
      daysAgo,
      minutesAvailable: 45 + Math.floor(Math.random() * 15),
      exercises
    })
  }

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const weightStartPoint = 184.2
  
  // Helper to get weight for a specific time
  const getWeightAtTime = (daysAgo: number) => {
    // Roughly 0.1lb loss per day
    return Number((weightStartPoint - (30 - daysAgo) * 0.1 + (Math.random() * 0.4 - 0.2)).toFixed(1))
  }

  const sessionRows = sessionSeeds.map((seed) => {
    const startedAt = new Date(now - seed.daysAgo * dayMs - 45 * 60 * 1000)
    const endedAt = new Date(now - seed.daysAgo * dayMs - 15 * 60 * 1000)
    const sessionWeight = getWeightAtTime(seed.daysAgo)
    
    return {
      user_id: userId,
      template_id: templates?.[seed.templateIndex]?.id ?? null,
      name: seed.name,
      status: 'completed',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      minutes_available: seed.minutesAvailable,
      generated_exercises: [],
      session_notes: DEV_SEED_MARKER,
      body_weight_lb: sessionWeight
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
        weight_unit: set.weightUnit
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
    const readinessRows = sessions.map((session, index) => {
      // Simulate varied readiness data
      // Cycles slightly based on index to show trends
      const baseScore = 65 + (index % 3) * 10 + Math.floor(Math.random() * 15)
      const sleep = Math.max(1, Math.min(5, Math.floor(3 + Math.random() * 2.5 - (index % 2) * 0.5)))
      const soreness = Math.max(1, Math.min(5, Math.floor(2 + Math.random() * 3 - (index % 2))))
      const stress = Math.max(1, Math.min(5, Math.floor(2 + Math.random() * 3)))
      const motivation = Math.max(1, Math.min(5, Math.floor(3 + Math.random() * 2)))
      
      let level = 'steady'
      if (baseScore < 60) level = 'low'
      if (baseScore > 85) level = 'high'

      return {
        session_id: session.id,
        user_id: userId,
        recorded_at: session.started_at,
        sleep_quality: sleep,
        muscle_soreness: soreness,
        stress_level: stress,
        motivation: motivation,
        readiness_score: baseScore,
        readiness_level: level
      }
    })

    const { data: readinessRowsInserted, error: readinessError } = await supabase
      .from('session_readiness')
      .insert(readinessRows)
      .select('id')

    if (readinessError && !isMissingTableError(readinessError)) throw readinessError
    readinessCount = readinessRowsInserted?.length ?? 0
  }

  // Seed Body Measurements (Daily History for last 30 days)
  const dailyMeasurementRows = []
  for (let i = 0; i < 30; i++) {
    const daysAgo = 29 - i
    const dayDate = new Date(now - daysAgo * dayMs)
    const currentWeight = getWeightAtTime(daysAgo)
    dailyMeasurementRows.push({
      user_id: userId,
      weight_lb: currentWeight,
      recorded_at: dayDate.toISOString()
    })
  }

  const { error: dailyWeightError } = await supabase
    .from('body_measurements')
    .insert(dailyMeasurementRows)

  if (dailyWeightError && !isMissingTableError(dailyWeightError)) {
    console.error('Failed to seed daily weight history:', dailyWeightError)
  }

  // Update profile with latest weight
  if (dailyMeasurementRows.length > 0) {
    const latestWeight = dailyMeasurementRows[dailyMeasurementRows.length - 1].weight_lb
    await supabase.from('profiles').update({ weight_lb: latestWeight }).eq('id', userId)
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
  if (process.env.NODE_ENV === 'production') {
    console.warn('Dev seed operations are disabled in production.')
    return { templates: 0, sessions: 0, exercises: 0, sets: 0, readiness: 0 }
  }

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

  // Also clear body weight from any remaining non-dev sessions
  await supabase
    .from('sessions')
    .update({ body_weight_lb: null })
    .eq('user_id', userId)

  const { error: measurementDeleteError } = await supabase
    .from('body_measurements')
    .delete()
    .eq('user_id', userId)
    
  if (measurementDeleteError && !isMissingTableError(measurementDeleteError)) throw measurementDeleteError

  // Reset profile weight
  await supabase
    .from('profiles')
    .update({ weight_lb: null })
    .eq('id', userId)

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