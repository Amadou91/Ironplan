import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePlanInput } from '@/lib/generator'
import { getReadinessLevel } from '@/lib/training-metrics'
import type { FocusArea, Goal, BandResistance, EquipmentInventory } from '@/types/domain'

export const DEV_SEED_MARKER = 'IRONPLAN_DEV_SEED'
export const DEV_SEED_TAG = 'dev_seed'
export const DEV_TEMPLATE_PREFIX = 'DEV SEED - '
export const DEV_SESSION_PREFIX = 'DEV SEED:'

export type SeedResult = {
  templates: number
  sessions: number
  exercises: number
  sets: number
  readiness: number
}

type SetSeed = {
  reps: number | null
  weight: number | null
  weightUnit: 'lb' | 'kg'
  rpe?: number
  rir?: number
  durationSeconds?: number
  extraMetrics?: Record<string, any>
  extras?: Record<string, any>
}

type ExerciseSeed = {
  name: string
  primaryMuscle: string
  secondaryMuscles?: string[]
  metricProfile: string
  sets: SetSeed[]
}

type SessionSeed = {
  template_id?: string
  user_id?: string
  name: string
  started_at?: string
  ended_at?: string
  status?: string
  templateIndex: number
  daysAgo: number
  minutesAvailable: number
  exercises: ExerciseSeed[]
}

export async function seedDevData(supabase: SupabaseClient, userId: string): Promise<SeedResult> {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Dev seed operations are disabled in production.')
    return { templates: 0, sessions: 0, exercises: 0, sets: 0, readiness: 0 }
  }

  const fullGymInventory: EquipmentInventory = {
    bodyweight: true,
    dumbbells: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    kettlebells: [18, 26, 35, 44, 53],
    bands: ['light', 'medium', 'heavy'],
    barbell: { available: true, plates: [45, 35, 25, 10, 5, 2.5] },
    machines: { cable: true, leg_press: true, treadmill: true, rower: true }
  }

  const homeMinimalInventory: EquipmentInventory = {
    bodyweight: true,
    dumbbells: [5, 10, 15, 20],
    kettlebells: [18, 26],
    bands: ['light', 'medium'],
    barbell: { available: false, plates: [] },
    machines: { cable: false, leg_press: false, treadmill: false, rower: false }
  }

  const mobilityInventory: EquipmentInventory = {
    bodyweight: true,
    dumbbells: [],
    kettlebells: [],
    bands: [],
    barbell: { available: false, plates: [] },
    machines: { cable: false, leg_press: false, treadmill: false, rower: false }
  }

  const templateSeeds = [
    {
      title: `${DEV_TEMPLATE_PREFIX}Upper Strength`,
      focus: 'upper' as FocusArea,
      style: 'strength' as Goal,
      experience_level: 'intermediate',
      intensity: 'high',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'body_part', bodyParts: ['upper'] },
        goals: { primary: 'strength', priority: 'primary' },
        experienceLevel: 'intermediate',
        intensity: 'high',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Lower Hypertrophy`,
      focus: 'lower' as FocusArea,
      style: 'hypertrophy' as Goal,
      experience_level: 'beginner',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'body_part', bodyParts: ['lower'] },
        goals: { primary: 'hypertrophy', priority: 'primary' },
        experienceLevel: 'beginner',
        intensity: 'moderate',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Full Body Endurance`,
      focus: 'full_body' as FocusArea,
      style: 'endurance' as Goal,
      experience_level: 'beginner',
      intensity: 'low',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'body_part', bodyParts: ['full_body'] },
        goals: { primary: 'endurance', priority: 'primary' },
        experienceLevel: 'beginner',
        intensity: 'low',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Yoga Flow`,
      focus: 'mobility' as FocusArea,
      style: 'general_fitness' as Goal,
      experience_level: 'beginner',
      intensity: 'low',
      equipment: { preset: 'home_minimal', inventory: mobilityInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'style', style: 'general_fitness' },
        goals: { primary: 'general_fitness', priority: 'primary' },
        experienceLevel: 'beginner',
        intensity: 'low',
        equipment: { preset: 'home_minimal', inventory: mobilityInventory },
        time: { minutesPerSession: 30 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Cardio Conditioning`,
      focus: 'cardio' as FocusArea,
      style: 'cardio' as Goal,
      experience_level: 'intermediate',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'style', style: 'cardio' },
        goals: { primary: 'cardio', priority: 'primary' },
        experienceLevel: 'intermediate',
        intensity: 'moderate',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 45 }
      })
    }
  ]

  const { data: templates, error: templateError } = await supabase
    .from('workout_templates')
    .insert(templateSeeds.map((seed) => ({ ...seed, user_id: userId })))
    .select('id, title')

  if (templateError) {
    console.error('Seed templates error:', templateError)
    throw { step: 'templates', ...templateError }
  }

  const exerciseTemplates: Record<number, ExerciseSeed[]> = {
    0: [
      {
        name: 'Bench Press',
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        metricProfile: 'strength',
        sets: [
          { reps: 5, weight: 185, weightUnit: 'lb', rpe: 8 },
          { reps: 5, weight: 185, weightUnit: 'lb', rpe: 8.5 },
          { reps: 5, weight: 185, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Dumbbell Row',
        primaryMuscle: 'back',
        secondaryMuscles: ['biceps'],
        metricProfile: 'strength',
        sets: [
          { reps: 8, weight: 60, weightUnit: 'lb', rpe: 7.5 },
          { reps: 8, weight: 60, weightUnit: 'lb', rpe: 8 },
          { reps: 8, weight: 60, weightUnit: 'lb', rpe: 8.5 }
        ]
      }
    ],
    1: [
      {
        name: 'Barbell Back Squat',
        primaryMuscle: 'quads',
        secondaryMuscles: ['glutes', 'hamstrings'],
        metricProfile: 'strength',
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
        metricProfile: 'strength',
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
        metricProfile: 'strength',
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
        metricProfile: 'timed_strength',
        sets: [
          { reps: null, weight: 0, weightUnit: 'lb', rpe: 6, durationSeconds: 45 },
          { reps: null, weight: 0, weightUnit: 'lb', rpe: 6.5, durationSeconds: 45 },
          { reps: null, weight: 0, weightUnit: 'lb', rpe: 7, durationSeconds: 45 }
        ]
      }
    ],
    3: [
      {
        name: 'Yoga',
        primaryMuscle: 'yoga',
        secondaryMuscles: ['core', 'full_body'],
        metricProfile: 'yoga_session',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 6, durationSeconds: 900, extraMetrics: { style: 'Vinyasa', focus: 'Flow' } }
        ]
      },
      {
        name: 'Stretching',
        primaryMuscle: 'full_body',
        secondaryMuscles: ['core'],
        metricProfile: 'mobility_session',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 4, durationSeconds: 600, extraMetrics: { target_area: 'Hips' } }
        ]
      }
    ],
    4: [
      {
        name: 'Indoor Ride',
        primaryMuscle: 'cardio',
        metricProfile: 'cardio_session',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 7, durationSeconds: 1800, extraMetrics: { machine: 'stationary bike' } }
        ]
      },
      {
        name: 'Skipping',
        primaryMuscle: 'cardio',
        metricProfile: 'cardio_session',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 8, durationSeconds: 600, extraMetrics: { focus: 'intervals' } }
        ]
      }
    ]
  }

  const sessionSeeds: SessionSeed[] = []
  const totalSessions = 40
  for (let i = 0; i < totalSessions; i++) {
    const templateIndex = i % 5
    const daysAgo = Math.floor((totalSessions - i) * 2 + Math.random())
    const baseExercises = exerciseTemplates[templateIndex]

    const progressFactor = 0.85 + (1 - daysAgo / 72) * 0.25 // More progression range
    const exercises = baseExercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => {
        const setUpdate: any = {
          ...s,
          weight: typeof s.weight === 'number' && s.weight > 0 ? Math.max(1, Math.round((s.weight * progressFactor) / 5) * 5) : s.weight,
          reps: typeof s.reps === 'number' ? s.reps + (Math.random() > 0.7 ? 1 : 0) : s.reps,
          durationSeconds: typeof s.durationSeconds === 'number' ? Math.round(s.durationSeconds * (0.9 + Math.random() * 0.2)) : null
        };

        const isYogaOrCardio = ex.metricProfile === 'yoga_session' || ex.metricProfile === 'cardio_session' || ex.metricProfile === 'mobility_session';

        if (isYogaOrCardio) {
          // Yoga/Cardio effort is 1-10, stored in RPE
          setUpdate.rpe = Math.min(10, Math.max(1, Math.round((s.rir || s.rpe || 6) + (Math.random() * 4 - 2))));
          setUpdate.rir = null;
        } else if (typeof s.rir === 'number') {
          setUpdate.rir = Math.min(10, Math.max(1, Math.round(s.rir + (Math.random() * 2 - 1))));
          setUpdate.rpe = null;
        } else if (typeof s.rpe === 'number') {
          setUpdate.rpe = Math.min(10, Math.max(6, (s.rpe || 7) + (Math.random() * 2 - 0.5)));
          setUpdate.rir = null;
        }

        return setUpdate;
      })
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

  if (sessionError) {
    console.error('Seed sessions error:', sessionError)
    throw { step: 'sessions', ...sessionError }
  }

  const seedByName = new Map(sessionSeeds.map((seed) => [seed.name, seed]))
  const sessionExerciseRows: Array<{
    session_id: string
    exercise_name: string
    primary_muscle: string
    secondary_muscles: string[]
    metric_profile: string
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
        metric_profile: exercise.metricProfile ?? 'strength',
        order_index: index
      })
    })
  })

  const { data: sessionExercises, error: exerciseError } = await supabase
    .from('session_exercises')
    .insert(sessionExerciseRows)
    .select('id, session_id, exercise_name')

  if (exerciseError) {
    console.error('Seed exercises error:', exerciseError)
    throw { step: 'exercises', ...exerciseError }
  }

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
    reps: number | null
    weight: number | null
    rpe: number | null
    rir: number | null
    completed: boolean
    performed_at: string
    weight_unit: 'lb' | 'kg'
    duration_seconds?: number | null
    extras: Record<string, string | null>
    extra_metrics: Record<string, unknown>
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
        reps: set.reps ?? null,
        weight: set.weight ?? null,
        rpe: set.rpe ?? null,
        rir: set.rir ?? null,
        duration_seconds: set.durationSeconds ?? null,
        extras: set.extras ?? {},
        extra_metrics: set.extraMetrics ?? {},
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

  if (setError) {
    console.error('Seed sets error:', setError)
    throw { step: 'sets', ...setError }
  }

  let readinessCount = 0
  if (sessions?.length) {
    const readinessRows = sessions.map((session, index) => {
      // Simulate varied readiness data across the entire 0-100 spectrum
      // We'll use a sine wave + random to create some "cycles" of fatigue/recovery
      const cycle = Math.sin(index / 3) * 30 // -30 to +30
      const base = 50 + cycle
      const score = Math.min(100, Math.max(0, Math.round(base + Math.random() * 20 - 10)))
      
      const sleep = Math.max(1, Math.min(5, Math.round((score / 20))))
      const soreness = Math.max(1, Math.min(5, Math.round(6 - (score / 20))))
      const stress = Math.max(1, Math.min(5, Math.round(6 - (score / 20))))
      const motivation = Math.max(1, Math.min(5, Math.round((score / 20))))
      
      const level = getReadinessLevel(score)

      return {
        session_id: session.id,
        user_id: userId,
        recorded_at: session.started_at,
        sleep_quality: sleep,
        muscle_soreness: soreness,
        stress_level: stress,
        motivation: motivation,
        readiness_score: score,
        readiness_level: level
      }
    })

    const { data: readinessRowsInserted, error: readinessError } = await supabase
      .from('session_readiness')
      .insert(readinessRows)
      .select('id')

    if (readinessError && !isMissingTableError(readinessError)) {
      console.error('Seed readiness error:', readinessError)
      throw { step: 'readiness', ...readinessError }
    }
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
      recorded_at: dayDate.toISOString(),
      source: DEV_SEED_TAG
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

  const result: ClearResult = {
    templates: 0,
    sessions: 0,
    exercises: 0,
    sets: 0,
    readiness: 0
  }

  try {
    // 1. Identify seeded templates
    const { data: templates } = await supabase
      .from('workout_templates')
      .select('id')
      .eq('user_id', userId)
      .ilike('title', `${DEV_TEMPLATE_PREFIX}%`)

    const templateIds = templates?.map((row) => row.id) ?? []

    // 2. Identify sessions to delete (dev marker or linked to dev templates)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .or(`session_notes.eq.${DEV_SEED_MARKER}${templateIds.length ? `,template_id.in.(${templateIds.join(',')})` : ''}`)

    const sessionIds = sessions?.map((row) => row.id) ?? []

    // 3. Delete readiness entries
    if (sessionIds.length) {
      const { data: readinessRows } = await supabase
        .from('session_readiness')
        .delete()
        .in('session_id', sessionIds)
        .select('id')
      
      result.readiness = readinessRows?.length ?? 0

      // 4. Delete identified sessions
      const { error: sessionDeleteError } = await supabase
        .from('sessions')
        .delete()
        .in('id', sessionIds)

      if (!sessionDeleteError) {
        result.sessions = sessionIds.length
      }
    }

    // 5. Reset body weight on any remaining sessions
    await supabase
      .from('sessions')
      .update({ body_weight_lb: null })
      .eq('user_id', userId)

    // 6. Delete seeded body measurements
    const { data: measurementRows, error: measurementDeleteError } = await supabase
      .from('body_measurements')
      .delete()
      .eq('user_id', userId)
      .eq('source', DEV_SEED_TAG)
      .select('id')
    
    if (!measurementDeleteError) {
      result.measurements = measurementRows?.length ?? 0
    } else if (!isMissingTableError(measurementDeleteError)) {
      console.error('Failed to clear body measurements:', measurementDeleteError)
    }

    // 7. Reset profile weight
    await supabase
      .from('profiles')
      .update({ weight_lb: null })
      .eq('id', userId)

    // 8. Delete seeded templates
    if (templateIds.length) {
      const { error: templateDeleteError } = await supabase
        .from('workout_templates')
        .delete()
        .in('id', templateIds)

      if (!templateDeleteError) {
        result.templates = templateIds.length
      }
    }
  } catch (error) {
    console.error('Error during clearDevData:', error)
    // We still return whatever we managed to clear
  }

  return result
}