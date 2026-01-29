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
import type { ExerciseVariation, GroupType } from './exercise.types'

export interface WorkoutImpact {
  score: number
  breakdown: {
    volume: number
    intensity: number
    density: number
  }
}

export interface WorkoutSession {
  id: string
  userId: string
  planId?: string
  templateId?: string
  name: string
  sessionFocus?: FocusArea | null
  sessionGoal?: SessionGoal | null
  sessionIntensity?: Intensity | null
  startedAt: string
  endedAt?: string
  status?: 'in_progress' | 'completed' | 'cancelled' | 'initializing'
  impact?: WorkoutImpact
  timezone?: string | null
  sessionNotes?: string | null
  weightUnit?: WeightUnit
  exercises: SessionExercise[]
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
