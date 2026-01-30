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

    // Build the immutability snapshot
    const completionSnapshot = buildCompletionSnapshot({
      session,
      endedAt: resolvedEndedAt,
      bodyWeightLb,
      preferences,
      equipmentInventory,
      exerciseCatalogLookup
    })

    // Calculate impact for legacy field (still useful for quick queries)
    const impact = calculateSessionImpactFromSets(session, resolvedEndedAt)

    // Build final session name
    let finalName = session.name
    if (sessionGoal === 'cardio' && session.exercises?.length) {
      const firstExName = session.exercises[0].name
      if (!finalName?.includes(firstExName)) {
        finalName = `Cardio ${firstExName}`
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

    // Update profile and record body measurement if weight provided
    if (bodyWeightLb && userId) {
      await Promise.all([
        supabase.from('profiles').update({ weight_lb: bodyWeightLb }).eq('id', userId),
        supabase.from('body_measurements').insert({
          user_id: userId,
          weight_lb: bodyWeightLb,
          recorded_at: resolvedEndedAt
        })
      ])
    }

    return {
      success: true,
      endedAt: resolvedEndedAt,
      finalName
    }
  } catch (error) {
    console.error('Failed to complete session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete session'
    }
  }
}
