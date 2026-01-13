export interface User {
  id: string
  email: string
  name?: string
}

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Core'
  | 'Glutes'
  | 'Quads'
  | 'Hamstrings'
  | 'Calves'
  | 'Hip Flexors'
  | 'Adductors'
  | 'Abductors'
  | 'Full Body'
  | 'Cardio'
  | 'Lower Body'
  | 'Upper Body'

export type BandResistance = 'light' | 'medium' | 'heavy'

export type MachineType = 'cable' | 'leg_press' | 'treadmill' | 'rower'

export type EquipmentPreset = 'home_minimal' | 'full_gym' | 'hotel'

export type EquipmentKind = 'bodyweight' | 'dumbbell' | 'kettlebell' | 'band' | 'barbell' | 'machine'

export type EquipmentOption =
  | { kind: 'bodyweight' }
  | { kind: 'dumbbell' }
  | { kind: 'kettlebell' }
  | { kind: 'band' }
  | { kind: 'barbell' }
  | { kind: 'machine'; machineType?: MachineType }

export interface EquipmentInventory {
  bodyweight: boolean
  dumbbells: number[]
  kettlebells: number[]
  bands: BandResistance[]
  barbell: {
    available: boolean
    plates: number[]
  }
  machines: Record<MachineType, boolean>
}

export type FocusArea = 'upper' | 'lower' | 'full_body' | 'core' | 'cardio' | 'mobility'

export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness'

export type GoalPriority = 'primary' | 'secondary' | 'balanced'

export type Intensity = 'low' | 'moderate' | 'high'

export type TimeWindow = 'morning' | 'afternoon' | 'evening'

export type RestPreference = 'balanced' | 'high_recovery' | 'minimal_rest'

export interface ExerciseLoad {
  value: number
  unit: 'lb'
  label: string
}

export interface Exercise {
  id?: string
  name: string
  focus: FocusArea
  sets: number
  reps: string | number
  rpe: number
  equipment: EquipmentOption[]
  durationMinutes: number
  restSeconds: number
  loadTarget?: number
  load?: ExerciseLoad
  primaryMuscle?: MuscleGroup | string
  secondaryMuscles?: string[]
  primaryBodyParts?: string[]
  secondaryBodyParts?: string[]
  videoUrl?: string
  instructions?: string[]
}

export type WorkoutExercise = Exercise

export interface PlanDay {
  dayOfWeek: number
  timeWindow: TimeWindow
  focus: FocusArea
  durationMinutes: number
  rationale: string
  exercises: Exercise[]
}

export interface WorkoutImpact {
  score: number
  breakdown: {
    volume: number
    intensity: number
    density: number
  }
}

export interface PlanInput {
  goals: {
    primary: Goal
    secondary?: Goal
    priority: GoalPriority
  }
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  intensity: Intensity
  equipment: {
    preset: EquipmentPreset | 'custom'
    inventory: EquipmentInventory
  }
  time: {
    minutesPerSession: number
    totalMinutesPerWeek?: number
  }
  schedule: {
    daysAvailable: number[]
    timeWindows: TimeWindow[]
    minRestDays: number
  }
  preferences: {
    focusAreas: FocusArea[]
    dislikedActivities: string[]
    accessibilityConstraints: string[]
    restPreference: RestPreference
  }
}

export interface GeneratedPlan {
  title: string
  description: string
  goal: Goal
  level: PlanInput['experienceLevel']
  tags: string[]
  schedule: PlanDay[]
  inputs: PlanInput
  summary: {
    sessionsPerWeek: number
    totalMinutes: number
    focusDistribution: Record<FocusArea, number>
    impact: WorkoutImpact
  }
}

export interface WorkoutPlan {
  id: string
  userId: string
  name: string
  goal: string
  days: WorkoutDay[]
  createdAt: string
}

export interface WorkoutDay {
  id: string
  name: string
  exercises: Exercise[]
}

export interface WorkoutSession {
  id: string
  userId: string
  planId?: string
  workoutId?: string
  name: string
  startedAt: string
  endedAt?: string
  status?: 'active' | 'completed' | 'cancelled'
  exercises: SessionExercise[]
}

export interface SessionExercise {
  id: string
  sessionId: string
  exerciseId?: string
  name: string
  primaryMuscle: string
  secondaryMuscles: string[]
  sets: WorkoutSet[]
  orderIndex: number
}

export interface WorkoutSet {
  id: string
  setNumber: number
  reps: number | '' | null
  weight: number | '' | null
  rpe?: number | '' | null
  rir?: number | '' | null
  notes?: string | null
  performedAt?: string | null
  completed: boolean
}
