'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Export format for session history.
 * Uses domain-level camelCase to match the rest of the codebase.
 */
export interface ExportedSession {
  name: string
  startedAt: string
  endedAt: string | null
  status: string
  bodyWeightLb: number | null
  timezone: string | null
  sessionNotes: string | null
  exercises: Array<{
    exerciseName: string
    primaryMuscle: string | null
    secondaryMuscles: string[]
    metricProfile: string
    orderIndex: number
    sets: Array<{
      setNumber: number
      reps: number | null
      weight: number | null
      implementCount: number | null
      loadType: string | null
      weightUnit: string | null
      rpe: number | null
      rir: number | null
      completed: boolean
      performedAt: string | null
      durationSeconds: number | null
      restSecondsActual: number | null
      notes: string | null
    }>
  }>
  readiness?: {
    sleepQuality: number
    muscleSoreness: number
    stressLevel: number
    motivation: number
    readinessScore: number | null
    readinessLevel: string | null
  } | null
}

export async function getSessionHistoryBackupAction() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Fetch all completed sessions with exercises and sets
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select(`
      id,
      name,
      started_at,
      ended_at,
      status,
      body_weight_lb,
      timezone,
      session_notes,
      session_exercises (
        id,
        exercise_name,
        primary_muscle,
        secondary_muscles,
        metric_profile,
        order_index,
        sets:sets (
          set_number,
          reps,
          weight,
          implement_count,
          load_type,
          weight_unit,
          rpe,
          rir,
          completed,
          performed_at,
          duration_seconds,
          rest_seconds_actual,
          notes
        )
      )
    `)
    .eq('user_id', user.id)
    .in('status', ['completed', 'cancelled'])
    .order('started_at', { ascending: false })

  if (sessionError) {
    return { success: false, error: sessionError.message }
  }

  // Fetch readiness data for all sessions
  const sessionIds = (sessions ?? []).map(s => s.id)
  const { data: readinessData } = await supabase
    .from('session_readiness')
    .select('session_id, sleep_quality, muscle_soreness, stress_level, motivation, readiness_score, readiness_level')
    .in('session_id', sessionIds)

  const readinessMap = new Map(
    (readinessData ?? []).map(r => [r.session_id, r])
  )

  // Transform to export format (camelCase domain objects)
  // Deduplicate and clean data
  const exportedSessions: ExportedSession[] = (sessions ?? []).map(session => {
    const readiness = readinessMap.get(session.id)
    
    // Group exercises by name to handle duplicates
    const exerciseMap = new Map<string, any>()
    
    const rawExercises = session.session_exercises ?? []
    // Sort by order_index to preserve sequence
    rawExercises.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))

    for (const exercise of rawExercises) {
      // Filter sets: only include completed sets with valid data
      // We strictly require completed=true for history
      const validSets = (exercise.sets ?? [])
        .filter(set => set.completed && set.reps !== null && set.weight !== null)
        .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
        .map((set, idx) => ({
          setNumber: idx + 1, // Renumber sequentially
          reps: set.reps,
          weight: set.weight,
          implementCount: set.implement_count,
          loadType: set.load_type,
          weightUnit: set.weight_unit,
          rpe: set.rpe,
          rir: set.rir,
          completed: true,
          performedAt: set.performed_at,
          durationSeconds: set.duration_seconds,
          restSecondsActual: set.rest_seconds_actual,
          notes: set.notes
        }))

      if (validSets.length === 0) continue

      const key = exercise.exercise_name.toLowerCase()
      if (exerciseMap.has(key)) {
        // Merge sets if duplicate exercise exists
        const existing = exerciseMap.get(key)
        const combinedSets = [...existing.sets, ...validSets]
        // Renumber merged sets
        existing.sets = combinedSets.map((s: any, idx: number) => ({ ...s, setNumber: idx + 1 }))
      } else {
        exerciseMap.set(key, {
          exerciseName: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles ?? [],
          metricProfile: exercise.metric_profile,
          orderIndex: exercise.order_index ?? 0,
          sets: validSets
        })
      }
    }

    return {
      name: session.name,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      status: session.status,
      bodyWeightLb: session.body_weight_lb,
      timezone: session.timezone,
      sessionNotes: session.session_notes,
      exercises: Array.from(exerciseMap.values()),
      readiness: readiness ? {
        sleepQuality: readiness.sleep_quality,
        muscleSoreness: readiness.muscle_soreness,
        stressLevel: readiness.stress_level,
        motivation: readiness.motivation,
        readinessScore: readiness.readiness_score,
        readinessLevel: readiness.readiness_level
      } : null
    }
  })

  return { success: true, data: exportedSessions }
}

export async function importSessionHistoryAction(sessions: ExportedSession[]) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return { success: false, error: 'Invalid data: expected an array of sessions' }
  }

  let importedCount = 0
  let skippedCount = 0
  const errors: string[] = []

  for (const session of sessions) {
    try {
      // Check for duplicate by startedAt timestamp to avoid re-importing
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('started_at', session.startedAt)
        .limit(1)
        .single()

      if (existing) {
        skippedCount++
        continue
      }

      // Insert session
      const { data: insertedSession, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          name: session.name,
          started_at: session.startedAt,
          ended_at: session.endedAt,
          status: session.status || 'completed',
          body_weight_lb: session.bodyWeightLb,
          timezone: session.timezone,
          session_notes: session.sessionNotes,
          generated_exercises: []
        })
        .select('id')
        .single()

      if (sessionError || !insertedSession) {
        errors.push(`Failed to import session "${session.name}": ${sessionError?.message}`)
        continue
      }

      const sessionId = insertedSession.id

      // Insert readiness if present
      if (session.readiness) {
        await supabase
          .from('session_readiness')
          .insert({
            session_id: sessionId,
            user_id: user.id,
            sleep_quality: session.readiness.sleepQuality,
            muscle_soreness: session.readiness.muscleSoreness,
            stress_level: session.readiness.stressLevel,
            motivation: session.readiness.motivation,
            readiness_score: session.readiness.readinessScore,
            readiness_level: session.readiness.readinessLevel
          })
      }

      // Insert exercises and sets
      for (const exercise of session.exercises) {
        const { data: insertedExercise, error: exerciseError } = await supabase
          .from('session_exercises')
          .insert({
            session_id: sessionId,
            exercise_name: exercise.exerciseName,
            primary_muscle: exercise.primaryMuscle,
            secondary_muscles: exercise.secondaryMuscles,
            metric_profile: exercise.metricProfile || 'strength',
            order_index: exercise.orderIndex
          })
          .select('id')
          .single()

        if (exerciseError || !insertedExercise) {
          errors.push(`Failed to import exercise "${exercise.exerciseName}": ${exerciseError?.message}`)
          continue
        }

        const exerciseId = insertedExercise.id

        // Insert sets
        if (exercise.sets && exercise.sets.length > 0) {
          const setsToInsert = exercise.sets.map(set => ({
            session_exercise_id: exerciseId,
            set_number: set.setNumber,
            reps: set.reps,
            weight: set.weight,
            implement_count: set.implementCount,
            load_type: set.loadType,
            weight_unit: set.weightUnit || 'lb',
            rpe: set.rpe,
            rir: set.rir,
            completed: set.completed ?? true,
            performed_at: set.performedAt || session.startedAt,
            duration_seconds: set.durationSeconds,
            rest_seconds_actual: set.restSecondsActual,
            notes: set.notes
          }))

          const { error: setsError } = await supabase
            .from('sets')
            .insert(setsToInsert)

          if (setsError) {
            errors.push(`Failed to import sets for "${exercise.exerciseName}": ${setsError.message}`)
          }
        }
      }

      importedCount++
    } catch (err) {
      errors.push(`Unexpected error importing session "${session.name}": ${err}`)
    }
  }

  revalidatePath('/progress')

  return {
    success: true,
    imported: importedCount,
    skipped: skippedCount,
    errors: errors.length > 0 ? errors : undefined
  }
}
