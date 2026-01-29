import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePlanInput } from '@/lib/generator'
import { getReadinessLevel } from '@/lib/training-metrics'
import type { FocusArea, Goal, EquipmentInventory } from '@/types/domain'

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

export async function seedExerciseCatalog(supabase: SupabaseClient): Promise<number> {
  const exercises = [
    // PUSH
    {
      name: 'Bench Press',
      focus: 'upper',
      movement_pattern: 'push',
      primary_muscle: 'chest',
      secondary_muscles: ['triceps', 'shoulders'],
      equipment: [{ kind: 'barbell', requires: ['bench_press'] }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '8', rpe: 8, e1rm_eligible: true
    },
    {
      name: 'Overhead Press',
      focus: 'upper',
      movement_pattern: 'push',
      primary_muscle: 'shoulders',
      secondary_muscles: ['triceps', 'core'],
      equipment: [{ kind: 'barbell' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '10', rpe: 8, e1rm_eligible: true
    },
    {
      name: 'Incline Dumbbell Press',
      focus: 'upper',
      movement_pattern: 'push',
      primary_muscle: 'chest',
      secondary_muscles: ['shoulders', 'triceps'],
      equipment: [{ kind: 'dumbbell', requires: ['bench_press'] }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '12', rpe: 7
    },
    // PULL
    {
      name: 'Barbell Row',
      focus: 'upper',
      movement_pattern: 'pull',
      primary_muscle: 'back',
      secondary_muscles: ['biceps', 'forearms', 'core'],
      equipment: [{ kind: 'barbell' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '8', rpe: 8, e1rm_eligible: true
    },
    {
      name: 'Lat Pulldown',
      focus: 'upper',
      movement_pattern: 'pull',
      primary_muscle: 'back',
      secondary_muscles: ['biceps', 'shoulders'],
      equipment: [{ kind: 'machine', machineType: 'cable' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '10', rpe: 7
    },
    {
      name: 'Bicep Curl',
      focus: 'upper',
      movement_pattern: 'pull',
      primary_muscle: 'biceps',
      secondary_muscles: ['forearms'],
      equipment: [{ kind: 'dumbbell' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '12', rpe: 8
    },
    // SQUAT
    {
      name: 'Barbell Back Squat',
      focus: 'lower',
      movement_pattern: 'squat',
      primary_muscle: 'quads',
      secondary_muscles: ['glutes', 'hamstrings', 'core', 'calves'],
      equipment: [{ kind: 'barbell' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '5', rpe: 8, e1rm_eligible: true
    },
    {
      name: 'Leg Press',
      focus: 'lower',
      movement_pattern: 'squat',
      primary_muscle: 'quads',
      secondary_muscles: ['glutes', 'calves'],
      equipment: [{ kind: 'machine', machineType: 'leg_press' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '12', rpe: 8
    },
    {
      name: 'Bulgarian Split Squats',
      focus: 'lower',
      movement_pattern: 'squat',
      primary_muscle: 'quads',
      secondary_muscles: ['glutes', 'hamstrings', 'calves'],
      equipment: [{ kind: 'dumbbell' }, { kind: 'bodyweight' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '8', rpe: 8
    },
    {
      name: 'Step Ups',
      focus: 'lower',
      movement_pattern: 'squat',
      primary_muscle: 'quads',
      secondary_muscles: ['glutes', 'hamstrings', 'calves'],
      equipment: [{ kind: 'dumbbell' }, { kind: 'bodyweight' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '10', rpe: 7
    },
    // HINGE
    {
      name: 'Romanian Deadlift',
      focus: 'lower',
      movement_pattern: 'hinge',
      primary_muscle: 'hamstrings',
      secondary_muscles: ['glutes', 'back', 'core', 'forearms'],
      equipment: [{ kind: 'barbell' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '10', rpe: 8, e1rm_eligible: true
    },
    {
      name: 'Hip Thrusts',
      focus: 'lower',
      movement_pattern: 'hinge',
      primary_muscle: 'glutes',
      secondary_muscles: ['hamstrings', 'core'],
      equipment: [{ kind: 'barbell' }],
      metric_profile: 'reps_weight',
      sets: 3, reps: '10', rpe: 8
    },
    {
      name: 'Kettlebell Swing',
      focus: 'lower',
      movement_pattern: 'hinge',
      primary_muscle: 'glutes',
      secondary_muscles: ['hamstrings', 'back', 'core', 'shoulders'],
      equipment: [{ kind: 'kettlebell' }],
      metric_profile: 'reps_weight',
      sets: 4, reps: '15', rpe: 7
    },
    // CORE
    {
      name: 'Plank',
      focus: 'core',
      movement_pattern: 'core',
      primary_muscle: 'core',
      secondary_muscles: ['shoulders', 'glutes'],
      equipment: [{ kind: 'bodyweight' }],
      metric_profile: 'timed_strength',
      sets: 3, reps: '60s', rpe: 7
    },
    // CARDIO / MOBILITY
    {
      name: 'Indoor Ride',
      focus: 'cardio',
      movement_pattern: 'cardio',
      primary_muscle: 'full_body',
      secondary_muscles: ['quads', 'calves'],
      equipment: [{ kind: 'machine', machineType: 'indoor_bicycle' }],
      metric_profile: 'cardio_session',
      sets: 1, reps: '30m', rpe: 6
    },
    {
      name: 'Yoga Flow',
      focus: 'mobility',
      movement_pattern: 'mobility',
      primary_muscle: 'full_body',
      secondary_muscles: ['core', 'shoulders', 'hamstrings'],
      equipment: [{ kind: 'bodyweight' }],
      metric_profile: 'mobility_session',
      sets: 1, reps: '30m', rpe: 5
    }
  ];

  // Map to only columns that exist in the database after migration 20260530000000
  // Removed columns: focus (now generated), sets, reps, rpe, duration_minutes, rest_seconds, load_target, video_url, instructions, interval_duration, interval_rest
  const toInsert = exercises.map(({ name, movement_pattern, primary_muscle, secondary_muscles, equipment, metric_profile, e1rm_eligible }) => ({
    name,
    movement_pattern,
    primary_muscle,
    secondary_muscles,
    equipment,
    metric_profile,
    e1rm_eligible: e1rm_eligible ?? false,
    is_interval: false
  }));

  const { error } = await supabase
    .from('exercise_catalog')
    .upsert(toInsert, { onConflict: 'name' });

  if (error) {
    console.error('Seed exercise catalog error:', error);
    return 0;
  }

  return toInsert.length;
}

export async function seedDevData(supabase: SupabaseClient, userId: string): Promise<SeedResult> {
  if (process.env.NODE_ENV === 'production') {
    console.warn('Dev seed operations are disabled in production.')
    return { templates: 0, sessions: 0, exercises: 0, sets: 0, readiness: 0 }
  }

  // 0. Seed Exercise Catalog first
  await seedExerciseCatalog(supabase);

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
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        movementPattern: 'push',
        metricProfile: 'reps_weight',
        sets: [
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 7 },
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 8 },
          { reps: 8, weight: 155, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Overhead Press',
        primaryMuscle: 'shoulders',
        secondaryMuscles: ['triceps', 'core'],
        movementPattern: 'push',
        metricProfile: 'reps_weight',
        sets: [
          { reps: 10, weight: 95, weightUnit: 'lb', rpe: 8 },
          { reps: 10, weight: 95, weightUnit: 'lb', rpe: 8 }
        ]
      }
    ],
    1: [
      {
        name: 'Lat Pulldown',
        primaryMuscle: 'back',
        secondaryMuscles: ['biceps', 'forearms'],
        movementPattern: 'pull',
        metricProfile: 'reps_weight',
        sets: [
          { reps: 10, weight: 120, weightUnit: 'lb', rpe: 7 },
          { reps: 10, weight: 120, weightUnit: 'lb', rpe: 8 },
          { reps: 10, weight: 120, weightUnit: 'lb', rpe: 8 }
        ]
      },
      {
        name: 'Bicep Curl',
        primaryMuscle: 'biceps',
        secondaryMuscles: ['forearms'],
        movementPattern: 'pull',
        metricProfile: 'reps_weight',
        sets: [
          { reps: 12, weight: 30, weightUnit: 'lb', rpe: 8 },
          { reps: 12, weight: 30, weightUnit: 'lb', rpe: 9 }
        ]
      }
    ],
    2: [
      {
        name: 'Barbell Back Squat',
        primaryMuscle: 'quads',
        secondaryMuscles: ['glutes', 'hamstrings', 'core'],
        movementPattern: 'squat',
        metricProfile: 'reps_weight',
        sets: [
          { reps: 5, weight: 225, weightUnit: 'lb', rpe: 8 },
          { reps: 5, weight: 225, weightUnit: 'lb', rpe: 8.5 },
          { reps: 5, weight: 225, weightUnit: 'lb', rpe: 9 }
        ]
      },
      {
        name: 'Romanian Deadlift',
        primaryMuscle: 'hamstrings',
        secondaryMuscles: ['glutes', 'core', 'back'],
        movementPattern: 'hinge',
        metricProfile: 'reps_weight',
        sets: [
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 7.5 },
          { reps: 10, weight: 185, weightUnit: 'lb', rpe: 8 }
        ]
      }
    ],
    3: [
      {
        name: 'Yoga Flow',
        primaryMuscle: 'full_body',
        secondaryMuscles: ['core', 'shoulders', 'hamstrings'],
        movementPattern: 'mobility',
        metricProfile: 'mobility_session',
        sets: [
          { reps: null, weight: null, weightUnit: 'lb', rpe: 5, durationSeconds: 1200, extraMetrics: { style: 'Vinyasa' } }
        ]
      }
    ],
    4: [
      {
        name: 'Stationary Bike',
        primaryMuscle: 'full_body',
        secondaryMuscles: ['quads', 'calves'],
        movementPattern: 'cardio',
        metricProfile: 'cardio_session',
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
    movement_pattern: string
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
        movement_pattern: exercise.movementPattern || 'push',
        metric_profile: exercise.metricProfile ?? 'reps_weight',
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
  if (process.env.NODE_ENV === 'production') {
    console.warn('Dev seed operations are disabled in production.')
    return { templates: 0, sessions: 0, exercises: 0, sets: 0, readiness: 0 }
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
