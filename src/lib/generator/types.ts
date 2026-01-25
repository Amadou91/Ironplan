import type {
  Exercise,
  ExerciseLoad,
  FocusArea,
  MovementPattern
} from '@/types/domain'

export type ExerciseTemplate = Omit<Exercise, 'load'> & {
  loadTarget?: number
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

export type ExerciseSource = 'primary' | 'secondary' | 'accessory'

export type ExercisePrescription = {
  sets: number
  reps: string | number
  rpe: number
  restSeconds: number
  load?: ExerciseLoad
}

export type PlannedExercise = {
  exercise: Exercise
  source: ExerciseSource
  prescription: ExercisePrescription
  estimatedMinutes: number
  minSets: number
  maxSets: number
}
