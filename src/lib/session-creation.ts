import { generateSessionExercisesForFocusAreas, calculateExerciseImpact } from '@/lib/generator'
import { toMuscleLabel, toMuscleSlug } from '@/lib/muscle-utils'
import { getPrimaryFocusArea, resolveSessionFocusAreas } from '@/lib/session-focus'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FocusArea, Goal, SessionGoal, MovementPattern, PlanInput, SessionExercise, WorkoutImpact, MetricProfile, Exercise } from '@/types/domain'
import type { ReadinessLevel, ReadinessSurvey } from '@/lib/training-metrics'

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
  templateId?: string | null
  templateTitle: string
  focusAreas: FocusArea[]
  goal: Goal
  sessionGoal?: SessionGoal
  input: PlanInput
  minutesAvailable: number
  readiness: {
    survey: ReadinessSurvey
    score: number
    level: ReadinessLevel
  }
  catalog: Exercise[]
  bodyWeightLb?: number | null
  sessionNotes?: Record<string, unknown> | string | null
  history?: {
    recentExerciseNames?: string[]
    recentMovementPatterns?: MovementPattern[]
    recentPrimaryMuscles?: string[]
  }
  nameSuffix?: string
}

type CreateSessionResult = {
  sessionId: string
  startedAt: string
  sessionName: string
  exercises: SessionExercise[]
  impact?: WorkoutImpact
  timezone?: string | null
  sessionNotes?: string | null
}

const getPrimaryMuscle = (exercise: SessionExerciseSeed) =>
  exercise.primaryBodyParts?.[0] ?? exercise.primaryMuscle ?? exercise.focus ?? 'Full Body'

const getSecondaryMuscles = (exercise: SessionExerciseSeed) =>
  exercise.secondaryBodyParts ?? exercise.secondaryMuscles ?? []

export const createWorkoutSession = async ({
  supabase,
  userId,
  templateId,
  templateTitle,
  focusAreas,
  goal,
  sessionGoal,
  input,
  minutesAvailable,
  readiness,
  catalog,
  bodyWeightLb,
  sessionNotes,
  history,
  nameSuffix
}: CreateSessionParams): Promise<CreateSessionResult> => {
  if (!readiness) {
    throw new Error('Readiness data is required to create a session.')
  }
  const normalizedFocusAreas = resolveSessionFocusAreas(focusAreas)
  const primaryFocus = getPrimaryFocusArea(normalizedFocusAreas)
  const startedAt = new Date().toISOString()
  const sessionName = buildWorkoutDisplayName({
    focus: primaryFocus,
    focusAreas: normalizedFocusAreas,
    style: goal,
    intensity: input.intensity,
    minutes: minutesAvailable,
    fallback: nameSuffix ? `${templateTitle} · ${nameSuffix}` : templateTitle
  })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  const serializedNotes =
    typeof sessionNotes === 'string' ? sessionNotes : sessionNotes ? JSON.stringify(sessionNotes) : null

  let finalWeight = bodyWeightLb
  if (!finalWeight) {
    const { data: profile } = await supabase.from('profiles').select('weight_lb').eq('id', userId).maybeSingle()
    if (profile?.weight_lb) {
      finalWeight = profile.weight_lb
    }
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      template_id: templateId ?? null,
      session_focus: primaryFocus,
      session_goal: sessionGoal ?? goal,
      session_intensity: input.intensity,
      name: sessionName,
      started_at: startedAt,
      status: 'initializing',
      minutes_available: minutesAvailable,
      timezone,
      session_notes: serializedNotes,
      body_weight_lb: finalWeight
    })
    .select()
    .single()

  if (sessionError || !sessionData) {
    throw sessionError ?? new Error('Failed to create session.')
  }

  const { error: focusAreaError } = await supabase.from('session_focus_areas').insert(
    normalizedFocusAreas.map((focusArea) => ({
      session_id: sessionData.id,
      focus_area: focusArea
    }))
  )

  if (focusAreaError) {
    await supabase.from('sessions').delete().eq('id', sessionData.id)
    throw focusAreaError
  }

  try {
    const { error: readinessError } = await supabase.from('session_readiness').insert({
      session_id: sessionData.id,
      user_id: userId,
      recorded_at: startedAt,
      sleep_quality: readiness.survey.sleep,
      muscle_soreness: readiness.survey.soreness,
      stress_level: readiness.survey.stress,
      motivation: readiness.survey.motivation,
      readiness_score: readiness.score,
      readiness_level: readiness.level
    })
    if (readinessError) throw readinessError

    const cardioOnlyFocus = normalizedFocusAreas.every((focusArea) => focusArea === 'cardio')
    const exercises = cardioOnlyFocus
      ? [] 
      : generateSessionExercisesForFocusAreas(catalog, input, normalizedFocusAreas, minutesAvailable, goal, {
          seed: sessionData.id,
          history
        })
    const impact = exercises.length ? calculateExerciseImpact(exercises) : undefined
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
        metric_profile: exercise.metricProfile ?? 'reps_weight',
        order_index: index
      }
    })

    let sessionExercises: Array<{
      id: string
      exercise_name: string
      primary_muscle: string | null
      secondary_muscles: string[] | null
      metric_profile?: string
      order_index: number | null
    }> = []

    if (exercisePayload.length > 0) {
      const { data: insertedExercises, error: exerciseError } = await supabase
        .from('session_exercises')
        .insert(exercisePayload)
        .select('id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index')
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
      metricProfile: (exercise.metric_profile as MetricProfile) ?? 'reps_weight',
      sets: [],
      orderIndex: exercise.order_index ?? idx
    }))

    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        impact: impact ?? null,
        status: 'in_progress'
      })
      .eq('id', sessionData.id)
    if (updateError) throw updateError

    return {
      sessionId: sessionData.id,
      startedAt,
      sessionName,
      exercises: mappedExercises,
      impact,
      timezone,
      sessionNotes: serializedNotes
    }
  } catch (error) {
    await supabase.from('sessions').delete().eq('id', sessionData.id)
    throw error
  }
}
