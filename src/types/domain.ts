/**
 * Domain types barrel file.
 * 
 * This file re-exports from focused type modules for backwards compatibility.
 * New code should import directly from specific type files:
 * 
 * - core.types.ts      - Foundational types (goals, focus, units, etc.)
 * - equipment.types.ts - Equipment kinds, inventories, options
 * - exercise.types.ts  - Exercise definitions and prescriptions
 * - session.types.ts   - Active workout sessions and sets
 * - plan.types.ts      - Workout plans, templates, generation inputs
 */

// Core types
export type {
  User,
  MuscleGroup,
  FocusArea,
  Goal,
  SessionGoal,
  GoalPriority,
  Intensity,
  MovementPattern,
  RestPreference,
  CardioActivity,
  WeightUnit,
  DistanceUnit,
  LoadType,
  MetricProfile,
  ExerciseCategory
} from './core.types'

// Equipment types
export type {
  BandResistance,
  MachineType,
  EquipmentPreset,
  EquipmentKind,
  EquipmentOrGroup,
  EquipmentOption,
  EquipmentInventory
} from './equipment.types'

// Exercise types
export type {
  GroupType,
  SetType,
  WarmupSet,
  ExerciseVariation,
  ExerciseLoad,
  Exercise,
  WorkoutExercise,
  ExerciseSource,
  ExercisePrescription,
  PlannedExercise
} from './exercise.types'

// Session types
export type {
  WorkoutImpact,
  WorkoutSession,
  WorkoutLog,
  SessionExercise,
  WorkoutSet,
  BodyMeasurement,
  SessionHistory,
  FocusConstraint
} from './session.types'

// Plan types
export type {
  PlanDay,
  PlanInput,
  GeneratedPlan,
  WorkoutTemplate,
  WorkoutTemplateDraft,
  PlanStatus,
  WorkoutPlan,
  WorkoutDay
} from './plan.types'
