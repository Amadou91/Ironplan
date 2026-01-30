/**
 * Exercise and workout types.
 * Defines exercises, sets, and their configurations.
 */

import type {
  FocusArea,
  MuscleGroup,
  MovementPattern,
  MetricProfile,
  ExerciseCategory,
  WeightUnit
} from './core.types'
import type { EquipmentOption, EquipmentOrGroup, EquipmentRequirementMode, AdditionalEquipmentMode } from './equipment.types'

export type GroupType = 'superset' | 'circuit' | 'giant_set' | 'dropset'

/**
 * Type of set within an exercise prescription.
 * - working: Standard working sets
 * - warmup: Preparatory sets with reduced load
 * - backoff: Post-working sets with reduced intensity
 * - dropset: Immediate reduction in weight
 */
export type SetType = 'working' | 'warmup' | 'backoff' | 'dropset'

/**
 * Represents a warm-up set configuration for exercise generation.
 */
export type WarmupSet = {
  setType: 'warmup'
  loadPercentage: number  // e.g., 0.5 for 50% of working weight
  reps: number
  rpe: number
}

export type ExerciseVariation = {
  grip?: string
  stance?: string
  equipment?: string
}

export interface ExerciseLoad {
  value: number
  unit: WeightUnit
  label: string
}

export interface Exercise {
  id?: string
  name: string
  category?: ExerciseCategory
  focus?: FocusArea
  metricProfile?: MetricProfile
  equipment: EquipmentOption[]
  /**
   * Optional OR-group for equipment substitution.
   * When set, any equipment in the group can satisfy the requirement.
   * Group is combined with other equipment requirements via AND logic.
   */
  orGroup?: EquipmentOrGroup
  /**
   * Determines how free-weight equipment is evaluated.
   * - 'or' (default): Any selected free-weight equipment satisfies the requirement
   * - 'and': All selected free-weight equipment must be available
   */
  equipmentMode?: EquipmentRequirementMode
  /**
   * Determines if bench/machine equipment is required or optional.
   * - 'required': Must be available (AND logic)
   * - 'optional': Preferred but not required
   */
  additionalEquipmentMode?: AdditionalEquipmentMode
  movementPattern?: MovementPattern
  load?: ExerciseLoad
  primaryMuscle?: MuscleGroup | string
  secondaryMuscles?: string[]
  primaryBodyParts?: string[]
  secondaryBodyParts?: string[]
  e1rmEligible?: boolean
  isInterval?: boolean
  // Prescription properties (used during generation)
  sets?: number
  reps?: string | number
  rpe?: number
  restSeconds?: number
  durationMinutes?: number
  loadTarget?: number
}

export type WorkoutExercise = Exercise

export type ExerciseSource = 'primary' | 'secondary' | 'accessory'

export type ExercisePrescription = {
  sets: number
  reps: string | number
  rpe: number
  restSeconds: number
  load?: ExerciseLoad
  setType?: SetType
  warmupSets?: WarmupSet[]
}

export type PlannedExercise = {
  exercise: Exercise
  source: ExerciseSource
  prescription: ExercisePrescription
  estimatedMinutes: number
  minSets: number
  maxSets: number
}
