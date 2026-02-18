/**
 * Session and workout tracking types.
 * Defines active sessions, exercises, and sets during workouts.
 */

import type {
  FocusArea,
  SessionGoal,
  Intensity,
  MetricProfile,
  WeightUnit,
  LoadType,
  MovementPattern
} from './core.types'
import type { EquipmentInventory } from './equipment.types'
import type { ExerciseVariation, GroupType } from './exercise.types'

export interface WorkoutImpact {
  score: number
  breakdown: {
    volume: number
    intensity: number
    density: number
  }
}

/**
 * Immutable snapshot of user data captured at session completion.
 * Ensures historical sessions are never affected by subsequent changes
 * to user profiles, preferences, or calculation algorithms.
 */
export interface CompletionSnapshot {
  /** User's body weight in pounds at completion time */
  bodyWeightLb: number | null
  /** User preferences snapshot (units, RPE baselines, etc.) */
  preferences: {
    units: WeightUnit
    customRpeBaselines?: {
      low: number
      moderate: number
      high: number
    }
  }
  /** Equipment inventory available at time of session */
  equipmentInventory?: EquipmentInventory
  /** Algorithm version used for E1RM calculations */
  e1rmFormulaVersion: string
  /** Pre-calculated session metrics that should never change */
  computedMetrics: {
    /** Total volume load in pounds */
    tonnage: number
    /** Total number of completed sets */
    totalSets: number
    /** Total number of reps across all sets */
    totalReps: number
    /** Workload score (volume * intensity factor) */
    workload: number
    /** Number of sets with RPE >= 8 */
    hardSets: number
    /** Average effort score (RPE/RIR based) */
    avgEffort: number | null
    /** Average intensity (weight / E1RM) */
    avgIntensity: number | null
    /** Average rest between sets in seconds */
    avgRestSeconds: number | null
    /** Session density (workload / duration) */
    density: number | null
    /** sRPE-based load score */
    sRpeLoad: number | null
    /** Best estimated 1RM in kg */
    bestE1rm: number | null
    /** Exercise name for best E1RM */
    bestE1rmExercise: string | null
    /** Duration in minutes */
    durationMinutes: number | null
  }
  /** Timestamp when snapshot was created */
  capturedAt: string
}

export interface WorkoutSession {
  id: string
  userId: string
  planId?: string
  templateId?: string
  name: string
  sessionFocus?: FocusArea | null
  sessionFocusAreas?: FocusArea[] | null
  sessionGoal?: SessionGoal | null
  sessionIntensity?: Intensity | null
  startedAt: string
  endedAt?: string
  status?: 'in_progress' | 'completed' | 'cancelled' | 'initializing'
  impact?: WorkoutImpact
  timezone?: string | null
  sessionNotes?: string | null
  weightUnit?: WeightUnit
  /** Body weight in pounds, set during readiness check before session starts */
  bodyWeightLb?: number | null
  exercises: SessionExercise[]
  /** Immutable snapshot captured at session completion - only present for completed sessions */
  completionSnapshot?: CompletionSnapshot
}

export interface WorkoutLog {
  templateId: string
  sessionName: string | null
  startedAt: string
  completedAt: string | null
}

export interface SessionExercise {
  id: string
  sessionId: string
  exerciseId?: string
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  metricProfile?: MetricProfile
  sets: WorkoutSet[]
  orderIndex: number
  variation?: ExerciseVariation
}

export interface WorkoutSet {
  id: string
  setNumber: number
  reps: number | '' | null
  weight: number | '' | null
  implementCount?: number | '' | null
  loadType?: LoadType | '' | null
  rpe?: number | '' | null
  rir?: number | '' | null
  notes?: string | null
  performedAt?: string | null
  completed: boolean
  weightUnit?: WeightUnit
  tempo?: string | null
  romCue?: string | null
  groupId?: string | '' | null
  groupType?: GroupType | '' | null
  extras?: Record<string, string | null> | null
  extraMetrics?: Record<string, unknown> | null
  durationSeconds?: number | '' | null
  distance?: number | '' | null
  distanceUnit?: string | null
  restSecondsActual?: number | null
}

export interface BodyMeasurement {
  id: string
  userId: string
  weightLb: number
  recordedAt: string
}

export type SessionHistory = {
  recentExerciseNames?: string[]
  recentMovementPatterns?: MovementPattern[]
  recentPrimaryMuscles?: string[]
}

export type FocusConstraint = {
  focus: FocusArea
  primaryMuscles: string[]
  accessoryMuscles: string[]
  minPrimarySetRatio: number
}
