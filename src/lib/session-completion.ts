/**
 * Shared session completion utilities.
 * Handles finishing a workout session with full immutability snapshot.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkoutSession, EquipmentInventory, SessionGoal } from '@/types/domain'
import type { UserPreferences } from '@/lib/preferences'
import { normalizePreferences } from '@/lib/preferences'
import { buildCompletionSnapshot } from '@/lib/session-snapshot'
import { calculateSessionImpactFromSets } from '@/lib/workout-metrics'
import { stripPlannedDuration } from '@/lib/workout-naming'

type ExerciseCatalogEntry = {
  name: string
  e1rmEligible?: boolean
}

export type CompleteSessionParams = {
  supabase: SupabaseClient
  sessionId: string
  session: WorkoutSession
  userId: string
  bodyWeightLb: number | null
  sessionGoal?: SessionGoal | null
  equipmentInventory?: EquipmentInventory | null
  exerciseCatalog?: ExerciseCatalogEntry[]
  endedAtOverride?: string
  /** When editing a session, update the start time as well */
  startedAtOverride?: string
}

export type CompleteSessionResult = {
  success: boolean
  error?: string
  endedAt?: string
  finalName?: string
}

/**
 * Completes a workout session with full immutability snapshot.
 * 
 * This function:
 * 1. Calculates final session impact metrics
 * 2. Fetches current user preferences for snapshot
 * 3. Builds a complete immutability snapshot
 * 4. Updates the session as completed
 * 5. Records body weight in measurements and profile
 */
export async function completeSession({
  supabase,
  sessionId,
  session,
  userId,
  bodyWeightLb,
  sessionGoal,
  equipmentInventory,
  exerciseCatalog,
  endedAtOverride,
  startedAtOverride
}: CompleteSessionParams): Promise<CompleteSessionResult> {
  const resolvedEndedAt = endedAtOverride && Number.isFinite(new Date(endedAtOverride).getTime())
    ? endedAtOverride
    : new Date().toISOString()

  const resolvedStartedAt = startedAtOverride && Number.isFinite(new Date(startedAtOverride).getTime())
    ? startedAtOverride
    : session.startedAt

  try {
    // Fetch user preferences for snapshot
    const { data: profileData } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', userId)
      .maybeSingle()

    const preferences: UserPreferences = normalizePreferences(profileData?.preferences)

    // Build exercise catalog lookup for E1RM eligibility
    const exerciseCatalogLookup = exerciseCatalog
      ? new Map(exerciseCatalog.map((e) => [e.name.toLowerCase(), e]))
      : undefined

    // CLEANUP: Filter out incomplete sets and empty exercises for the snapshot
    // This ensures history is clean even if DB has some junk
    const cleanedExercises = session.exercises
      .map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => s.completed && s.reps !== null && s.weight !== null)
      }))
      .filter(ex => ex.sets.length > 0)

    const cleanedSession: WorkoutSession = {
      ...session,
      exercises: cleanedExercises
    }

    // Build the immutability snapshot using CLEANED data
    const completionSnapshot = buildCompletionSnapshot({
      session: cleanedSession,
      endedAt: resolvedEndedAt,
      bodyWeightLb,
      preferences,
      equipmentInventory,
      exerciseCatalogLookup
    })

    // Calculate impact for legacy field (still useful for quick queries)
    const impact = calculateSessionImpactFromSets(cleanedSession, resolvedEndedAt)

    // Build final session name
    let finalName = session.name
    if (sessionGoal === 'cardio' && session.exercises?.length) {
      const firstExName = session.exercises[0].name
      if (!finalName?.includes(firstExName)) {
        finalName = `Cardio ${firstExName}`
      }
    }

    // Ensure name reflects actual duration
    const start = new Date(resolvedStartedAt).getTime()
    const end = new Date(resolvedEndedAt).getTime()
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const durationMinutes = Math.round((end - start) / 60000)
      if (durationMinutes > 0) {
        const baseName = stripPlannedDuration(finalName)
        finalName = `${baseName} · ${durationMinutes} min`
      }
    }

    // Update session with completion data
    const sessionUpdate = {
      name: finalName,
      started_at: resolvedStartedAt,
      ended_at: resolvedEndedAt,
      status: 'completed',
      impact,
      body_weight_lb: bodyWeightLb,
      completion_snapshot: completionSnapshot
    }

    const { error: sessionError } = await supabase
      .from('sessions')
      .update(sessionUpdate)
      .eq('id', sessionId)

    if (sessionError) throw sessionError

    // DB CLEANUP: Remove incomplete sets to prevent them from reappearing on edit
    // We do this asynchronously to not block the UI response
    // We also don't await it to fail the request if it fails, but we log it
    const incompleteSetIds = session.exercises
      .flatMap(e => e.sets.filter(s => !s.completed).map(s => s.id));

    if (incompleteSetIds.length > 0) {
      supabase.from('sets')
        .delete()
        .in('id', incompleteSetIds)
        .then(({ error }) => {
          if (error) console.error('Failed to cleanup incomplete sets:', error)
        })
    }

    // Update profile and record body measurement if weight provided
    if (bodyWeightLb && userId) {
      const { recordBodyWeight } = await import('./body-measurements')
      await recordBodyWeight({
        supabase,
        userId,
        weightLb: bodyWeightLb,
        date: resolvedStartedAt,
        source: 'session',
        sessionId
      })
    }

    return {
      success: true,
      endedAt: resolvedEndedAt,
      finalName
    }
  } catch (error) {
    // Supabase errors have non-enumerable properties, so we extract them manually
    const errorDetails = error && typeof error === 'object' 
      ? {
          message: (error as { message?: string }).message,
          code: (error as { code?: string }).code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint
        }
      : error
    console.error('Failed to complete session:', errorDetails)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : (error as { message?: string })?.message ?? 'Failed to complete session'
    
    return {
      success: false,
      error: errorMessage
    }
  }
}
