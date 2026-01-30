/**
 * Utilities for creating immutable session completion snapshots.
 * Ensures historical sessions are self-contained and never affected
 * by subsequent changes to user data or calculation algorithms.
 */

import type { CompletionSnapshot, WorkoutSession } from '@/types/domain'
import type { UserPreferences } from '@/lib/preferences'
import { defaultPreferences, defaultRpeBaselines } from '@/lib/preferences'
import {
  E1RM_FORMULA_VERSION,
  computeSetE1rm,
} from '@/lib/session-metrics'
import { computeSessionMetrics } from '@/lib/training-metrics'
import type { EquipmentInventory, WeightUnit, MetricProfile, LoadType, Intensity } from '@/types/domain'

type SnapshotExerciseData = {
  name: string
  e1rmEligible?: boolean
}

type SnapshotParams = {
  session: WorkoutSession
  endedAt: string
  bodyWeightLb: number | null
  preferences?: UserPreferences | null
  equipmentInventory?: EquipmentInventory | null
  exerciseCatalogLookup?: Map<string, SnapshotExerciseData>
}

/**
 * Builds an immutable completion snapshot for a session.
 * This snapshot captures all data needed to reconstruct session metrics
 * without referencing any mutable user data.
 */
export function buildCompletionSnapshot({
  session,
  endedAt,
  bodyWeightLb,
  preferences,
  equipmentInventory,
  exerciseCatalogLookup
}: SnapshotParams): CompletionSnapshot {
  const prefs = preferences ?? defaultPreferences
  
  // Collect all completed sets for metric calculations
  const allSets = session.exercises.flatMap((exercise) =>
    exercise.sets
      .filter((set) => set.completed)
      .map((set) => ({
        metricProfile: exercise.metricProfile as MetricProfile | undefined,
        reps: typeof set.reps === 'number' ? set.reps : null,
        weight: typeof set.weight === 'number' ? set.weight : null,
        weightUnit: (set.weightUnit as WeightUnit) ?? null,
        implementCount: typeof set.implementCount === 'number' ? set.implementCount : null,
        loadType: (set.loadType as LoadType) || null,
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null,
        performedAt: set.performedAt ?? null,
        durationSeconds: typeof set.durationSeconds === 'number' ? set.durationSeconds : null,
        restSecondsActual: set.restSecondsActual ?? null,
        completed: true,
        exerciseName: exercise.name
      }))
  )

  // Use computeSessionMetrics to get all standard metrics
  const sessionMetrics = computeSessionMetrics({
    startedAt: session.startedAt,
    endedAt,
    intensity: session.sessionIntensity as Intensity | null,
    sets: allSets
  })

  // Calculate best E1RM (not included in computeSessionMetrics)
  let bestE1rm: number | null = null
  let bestE1rmExercise: string | null = null

  allSets.forEach((set) => {
    const catalogEntry = exerciseCatalogLookup?.get(set.exerciseName?.toLowerCase() ?? '')
    const isEligible = catalogEntry?.e1rmEligible ?? false
    
    const e1rm = computeSetE1rm(
      {
        reps: set.reps,
        weight: set.weight,
        weightUnit: set.weightUnit,
        implementCount: set.implementCount,
        loadType: set.loadType,
        rpe: set.rpe,
        rir: set.rir,
        completed: true
      },
      session.sessionGoal,
      isEligible
    )

    if (e1rm !== null && (bestE1rm === null || e1rm > bestE1rm)) {
      bestE1rm = Math.round(e1rm)
      bestE1rmExercise = set.exerciseName ?? null
    }
  })

  return {
    bodyWeightLb,
    preferences: {
      units: prefs.settings?.units ?? 'lb',
      customRpeBaselines: {
        low: prefs.training?.customRpeBaselines?.low ?? defaultRpeBaselines.low,
        moderate: prefs.training?.customRpeBaselines?.moderate ?? defaultRpeBaselines.moderate,
        high: prefs.training?.customRpeBaselines?.high ?? defaultRpeBaselines.high
      }
    },
    equipmentInventory: equipmentInventory ?? undefined,
    e1rmFormulaVersion: E1RM_FORMULA_VERSION,
    computedMetrics: {
      tonnage: sessionMetrics.tonnage,
      totalSets: sessionMetrics.totalSets,
      totalReps: sessionMetrics.totalReps,
      workload: sessionMetrics.workload,
      hardSets: sessionMetrics.hardSets,
      avgEffort: sessionMetrics.avgEffort,
      avgIntensity: sessionMetrics.avgIntensity,
      avgRestSeconds: sessionMetrics.avgRestSeconds,
      density: sessionMetrics.density,
      sRpeLoad: sessionMetrics.sRpeLoad,
      bestE1rm,
      bestE1rmExercise,
      durationMinutes: sessionMetrics.durationMinutes
    },
    capturedAt: new Date().toISOString()
  }
}

/**
 * Gets session metrics from a completion snapshot if available,
 * ensuring historical data is not recalculated with different algorithms.
 * Falls back to live calculation for in-progress sessions.
 */
export function getSnapshotMetrics(snapshot: CompletionSnapshot | undefined | null) {
  if (!snapshot?.computedMetrics) return null
  
  const m = snapshot.computedMetrics
  return {
    tonnage: m.tonnage,
    totalSets: m.totalSets,
    totalReps: m.totalReps,
    workload: m.workload,
    hardSets: m.hardSets,
    avgEffort: m.avgEffort,
    avgIntensity: m.avgIntensity,
    avgRestSeconds: m.avgRestSeconds,
    density: m.density,
    sRpeLoad: m.sRpeLoad,
    bestE1rm: m.bestE1rm ?? 0,
    bestE1rmExercise: m.bestE1rmExercise,
    durationMinutes: m.durationMinutes,
    e1rmFormulaVersion: snapshot.e1rmFormulaVersion
  }
}

/**
 * Gets the body weight to use for calculations.
 * For completed sessions, always uses the snapshot value.
 * For in-progress sessions, uses the provided current value.
 */
export function getSessionBodyWeight(
  session: { completionSnapshot?: CompletionSnapshot | null; status?: string },
  currentBodyWeightLb: number | null
): number | null {
  // For completed sessions, always use snapshot data
  if (session.status === 'completed' && session.completionSnapshot?.bodyWeightLb != null) {
    return session.completionSnapshot.bodyWeightLb
  }
  return currentBodyWeightLb
}
