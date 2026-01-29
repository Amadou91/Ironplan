/**
 * Core domain types used across the application.
 * These are foundational types with no dependencies on other domain types.
 */

export interface User {
  id: string
  email: string
  name?: string
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'hip_flexors'
  | 'adductors'
  | 'abductors'
  | 'full_body'
  | 'upper_body'
  | 'lower_body'
  | 'cardio'
  | 'mobility'

export type FocusArea =
  | 'upper'
  | 'lower'
  | 'full_body'
  | 'core'
  | 'cardio'
  | 'mobility'
  | 'arms'
  | 'legs'
  | 'biceps'
  | 'triceps'
  | 'chest'
  | 'back'
  | 'shoulders'

export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'range_of_motion' | 'cardio' | 'general_fitness'
export type SessionGoal = Goal

export type GoalPriority = 'primary' | 'secondary' | 'balanced'

export type Intensity = 'low' | 'moderate' | 'high'

export type MovementPattern = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'core' | 'cardio'

export type RestPreference = 'balanced' | 'high_recovery' | 'minimal_rest'

export type CardioActivity = 'skipping' | 'indoor_cycling' | 'outdoor_cycling'

export type WeightUnit = 'lb' | 'kg'
export type DistanceUnit = 'm' | 'km' | 'miles'
export type LoadType = 'total' | 'per_implement'

export type MetricProfile =
  | 'timed_strength'
  | 'cardio_session'
  | 'mobility_session'
  | 'reps_weight'
  | 'reps_only'
  | 'duration'

export type ExerciseCategory = 'Strength' | 'Cardio' | 'Mobility'
