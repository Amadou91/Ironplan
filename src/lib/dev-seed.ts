import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePlanInput } from '@/lib/generator'
import { getReadinessLevel } from '@/lib/training-metrics'
import type { FocusArea, Goal, EquipmentInventory } from '@/types/domain'
import { assertDeveloperToolsAccess } from '@/lib/developer-access'

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

export type ClearResult = {
  templates: number
  sessions: number
  exercises: number
  sets: number
  readiness: number
  measurements?: number
}

type SetSeed = {
  reps: number | null
  weight: number | null
  weightUnit: 'lb' | 'kg'
  rpe?: number | null
  rir?: number | null
  durationSeconds?: number | null
  extraMetrics?: Record<string, unknown>
  extras?: Record<string, unknown>
}

type ExerciseSeed = {
  name: string
  primaryMuscle: string
  secondaryMuscles?: string[]
  metricProfile: string
  sets: SetSeed[]
  movementPattern?: string
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

const isMissingTableError = (error: unknown) => {
  const e = error as { code?: string; message?: string }
  return e?.code === '42P01' || e?.message?.includes('does not exist')
}

/**
 * Required exercises for dev seeding.
 * These must already exist in the exercise_catalog.
 * The seed process will NOT create exercises - it only creates session data.
 */
const REQUIRED_EXERCISE_NAMES = [
  'Bench Press',
  'Overhead Press',
  'Lat Pulldown',
  'Dumbbell Biceps Curl',
  'Barbell Back Squat',
  'Romanian Deadlift',
  'Yoga / Mobility',
  'Indoor Ride'
] as const

type CatalogExercise = {
  id: string
  name: string
  primary_muscle: string | null
  secondary_muscles: string[] | null
  metric_profile: string | null
}

/**
 * Looks up required exercises from the existing catalog.
 * Does NOT insert any exercises - fails if required exercises are missing.
 * 
 * @returns Map of exercise name (lowercase) to catalog exercise data
 * @throws Error if any required exercises are missing from the catalog
 */
async function lookupRequiredExercises(
  supabase: SupabaseClient
): Promise<Map<string, CatalogExercise>> {
  const { data: exercises, error } = await supabase
    .from('exercise_catalog')
    .select('id, name, primary_muscle, secondary_muscles, metric_profile')
    .in('name', REQUIRED_EXERCISE_NAMES)

  if (error) {
    console.error('Failed to lookup exercises from catalog:', error)
    throw new Error(`Failed to lookup exercises: ${error.message}`)
  }

  const exerciseMap = new Map<string, CatalogExercise>()
  exercises?.forEach((ex) => {
    exerciseMap.set(ex.name.toLowerCase(), ex)
  })

  // Validate all required exercises exist
  const missingExercises: string[] = []
  REQUIRED_EXERCISE_NAMES.forEach((name) => {
    if (!exerciseMap.has(name.toLowerCase())) {
      missingExercises.push(name)
    }
  })

  if (missingExercises.length > 0) {
    throw new Error(
      `Dev seed requires exercises that are missing from the catalog: ${missingExercises.join(', ')}. ` +
      `Please ensure these exercises exist in the exercise_catalog before running dev seed.`
    )
  }

  return exerciseMap
}

export async function seedDevData(supabase: SupabaseClient, userId: string): Promise<SeedResult> {
  const user = await assertDeveloperToolsAccess(supabase)

  if (user.id !== userId) {
    throw new Error('Unauthorized developer tools access')
  }

  // 0. Lookup required exercises from catalog (does NOT insert any)
  const catalogExercises = await lookupRequiredExercises(supabase);

  // Tuesday Jan 27, 2026 is "Today"
  const todayStart = new Date('2026-01-27T00:00:00Z').getTime()
  const dayMs = 24 * 60 * 60 * 1000

  const fullGymInventory: EquipmentInventory = {
    bodyweight: true,
    benchPress: true,
    dumbbells: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    kettlebells: [18, 26, 35, 44, 53],
    bands: ['light', 'medium', 'heavy'],
    barbell: { available: true, plates: [45, 35, 25, 10, 5, 2.5] },
    machines: { cable: true, leg_press: true, treadmill: true, rower: true, indoor_bicycle: true, outdoor_bicycle: false }
  }

  const mobilityInventory: EquipmentInventory = {
    bodyweight: true,
    benchPress: false,
    dumbbells: [],
    kettlebells: [],
    bands: [],
    barbell: { available: false, plates: [] },
    machines: { cable: false, leg_press: false, treadmill: false, rower: false, indoor_bicycle: false, outdoor_bicycle: false }
  }

  const templateSeeds = [
    {
      title: `${DEV_TEMPLATE_PREFIX}Push (Chest/Shoulders/Tri)`,
      focus: 'upper' as FocusArea,
      style: 'hypertrophy' as Goal,
      experience_level: 'intermediate',
      intensity: 'high',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'body_part', bodyParts: ['upper'] },
        goals: { primary: 'hypertrophy', priority: 'primary' },
        experienceLevel: 'intermediate',
        intensity: 'high',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 60 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Pull (Back/Biceps)`,
      focus: 'upper' as FocusArea,
      style: 'hypertrophy' as Goal,
      experience_level: 'intermediate',
      intensity: 'high',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'body_part', bodyParts: ['upper'] },
        goals: { primary: 'hypertrophy', priority: 'primary' },
        experienceLevel: 'intermediate',
        intensity: 'high',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 60 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Legs (Quads/Hams/Glutes)`,
      focus: 'lower' as FocusArea,
      style: 'strength' as Goal,
      experience_level: 'intermediate',
      intensity: 'high',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'body_part', bodyParts: ['lower'] },
        goals: { primary: 'strength', priority: 'primary' },
        experienceLevel: 'intermediate',
        intensity: 'high',
        equipment: { preset: 'full_gym', inventory: fullGymInventory },
        time: { minutesPerSession: 75 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Yoga / Mobility Flow`,
      focus: 'mobility' as FocusArea,
      style: 'range_of_motion' as Goal,
      experience_level: 'beginner',
      intensity: 'low',
      equipment: { preset: 'home_minimal', inventory: mobilityInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'style', style: 'range_of_motion' },
        goals: { primary: 'range_of_motion', priority: 'primary' },
        experienceLevel: 'beginner',
        intensity: 'low',
        equipment: { preset: 'home_minimal', inventory: mobilityInventory },
        time: { minutesPerSession: 30 }
      })
    },
    {
      title: `${DEV_TEMPLATE_PREFIX}Cardio Conditioning`,
      focus: 'cardio' as FocusArea,
      style: 'endurance' as Goal,
      experience_level: 'intermediate',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: fullGymInventory },
      template_inputs: normalizePlanInput({
        intent: { mode: 'style', style: 'endurance' },
        goals: { primary: 'endurance', priority: 'primary' },
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
        primaryMuscle: '', // Will be populated from catalog
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 7 },
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 8 },
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Overhead Press',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: 10, weight: 95, weightUnit: 'lb', rpe: 8 },
          { reps: 10, weight: 95, weightUnit: 'lb', rpe: 8 }
        ]
      }
    ],
    1: [
      {
        name: 'Lat Pulldown',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: 10, weight: 120, weightUnit: 'lb', rpe: 7 },
          { reps: 10, weight: 120, weightUnit: 'lb', rpe: 8 },
          { reps: 10, weight: 120, weightUnit: 'lb', rpe: 8 }
        ]
      },
      {
        name: 'Dumbbell Biceps Curl',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: 12, weight: 30, weightUnit: 'lb', rpe: 8 },
          { reps: 12, weight: 30, weightUnit: 'lb', rpe: 9 }
        ]
      }
    ],
    2: [
      {
        name: 'Barbell Back Squat',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: 5, weight: 225, weightUnit: 'lb', rpe: 8 },
          { reps: 5, weight: 225, weightUnit: 'lb', rpe: 8.5 },
          { reps: 5, weight: 225, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Romanian Deadlift',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 7.5 },
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 8 }
        ]
      }
    ],
    3: [
      {
        name: 'Yoga / Mobility',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 5, durationSeconds: 1200, extraMetrics: { style: 'Vinyasa' } }
        ]
      }
    ],
    4: [
      {
        name: 'Indoor Ride',
        primaryMuscle: '',
        secondaryMuscles: [],
        metricProfile: '',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 7, durationSeconds: 2400, extraMetrics: { machine: 'bike' } }
        ]
      }
    ]
  }

  const sessionSeeds: SessionSeed[] = []
  const totalSessions = 60
  for (let i = 0; i < totalSessions; i++) {
    const templateIndex = i % 5
    const daysAgo = Math.max(1, Math.floor((totalSessions - 1 - i) * 1.5) + 1)
    const baseExercises = exerciseTemplates[templateIndex]

    const progressFactor = 0.8 + (1 - daysAgo / 100) * 0.4 
    const exercises = baseExercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map((s) => {
        const setUpdate: SetSeed = {
          ...s,
          weight: typeof s.weight === 'number' && s.weight > 0 ? Math.max(1, Math.round((s.weight * progressFactor) / 5) * 5) : s.weight,
          reps: typeof s.reps === 'number' ? s.reps + (Math.random() > 0.8 ? 1 : 0) : s.reps,
          durationSeconds: typeof s.durationSeconds === 'number' ? Math.round(s.durationSeconds * (0.95 + Math.random() * 0.1)) : null
        };

        const isYogaOrCardio = ex.metricProfile === 'mobility_session' || ex.metricProfile === 'cardio_session';

        if (isYogaOrCardio) {
          setUpdate.rpe = Math.min(10, Math.max(3, Math.round((s.rpe || 5) + (Math.random() * 4 - 2))));
          setUpdate.rir = null;
        } else {
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
      minutesAvailable: 45 + Math.floor(Math.random() * 30),
      exercises
    })
  }

  const weightStartPoint = 192.5
  
  const getWeightAtTime = (daysAgo: number) => {
    // Gradual loss with fluctuations
    return Number((weightStartPoint - (100 - daysAgo) * 0.08 + (Math.random() * 0.6 - 0.3)).toFixed(1))
  }

  const sessionRows = sessionSeeds.map((seed) => {
    const startedAt = new Date(todayStart - seed.daysAgo * dayMs - 60 * 60 * 1000)
    const endedAt = new Date(todayStart - seed.daysAgo * dayMs - 10 * 60 * 1000)
    const sessionWeight = getWeightAtTime(seed.daysAgo)
    
    return {
      user_id: userId,
      template_id: templates?.[seed.templateIndex]?.id ?? null,
      name: seed.name,
      status: 'completed',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      minutes_available: seed.minutesAvailable,
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
      // Lookup exercise from catalog to get correct muscle/profile data
      const catalogExercise = catalogExercises.get(exercise.name.toLowerCase())
      if (!catalogExercise) {
        console.warn(`Skipping exercise "${exercise.name}" - not found in catalog`)
        return
      }
      sessionExerciseRows.push({
        session_id: session.id,
        exercise_name: catalogExercise.name,
        primary_muscle: catalogExercise.primary_muscle ?? 'unknown',
        secondary_muscles: catalogExercise.secondary_muscles ?? [],
        metric_profile: catalogExercise.metric_profile ?? 'reps_weight',
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
        extras: (set.extras as Record<string, string | null>) ?? {},
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
      // Simulate varied readiness data
      const cycle = Math.sin(index / 3) * 30
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
    // End history 1 day ago (Jan 23)
    const daysAgo = 30 - i 
    const dayDate = new Date(todayStart - daysAgo * dayMs)
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
  const user = await assertDeveloperToolsAccess(supabase)

  if (user.id !== userId) {
    throw new Error('Unauthorized developer tools access')
  }

  const result: ClearResult = {
    templates: 0,
    sessions: 0,
    exercises: 0,
    sets: 0,
    readiness: 0,
    measurements: 0
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
    // We'll also delete all measurements for this user since they specifically 
    // requested to ensure no hidden entries remain and confirmed they have no manual entries.
    const { data: measurementRows, error: measurementDeleteError } = await supabase
      .from('body_measurements')
      .delete()
      .eq('user_id', userId)
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
  }

  return result
}
