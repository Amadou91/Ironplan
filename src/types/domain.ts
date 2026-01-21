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

export type SetType = 'working' | 'backoff' | 'drop' | 'amrap'

export type WeightUnit = 'lb' | 'kg'

export type GroupType = 'superset' | 'circuit' | 'giant_set' | 'dropset'

export type ExerciseVariation = {
  grip?: string
  stance?: string
  equipment?: string
}

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

export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'cardio' | 'general_fitness'

export type GoalPriority = 'primary' | 'secondary' | 'balanced'

export type Intensity = 'low' | 'moderate' | 'high'

export type MovementPattern = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'core' | 'cardio'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type RestPreference = 'balanced' | 'high_recovery' | 'minimal_rest'

export type CardioActivity = 'skipping' | 'indoor_cycling' | 'outdoor_cycling' | 'running' | 'rowing'

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
  movementPattern?: MovementPattern
  difficulty?: Difficulty
  goal?: Goal
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
  order: number
  name?: string
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
  intent: {
    mode: 'style' | 'body_part'
    style?: Goal
    bodyParts?: FocusArea[]
  }
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
    minRestDays: number
    weeklyLayout?: Array<{
      sessionIndex: number
      style: Goal
      focus: FocusArea
    }>
  }
  preferences: {
    focusAreas: FocusArea[]
    dislikedActivities: string[]
    cardioActivities: CardioActivity[]
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

export interface WorkoutTemplate {
  id: string
  userId: string
  title: string
  description?: string | null
  focus: FocusArea
  style: Goal
  experienceLevel: PlanInput['experienceLevel']
  intensity: Intensity
  equipment: PlanInput['equipment']
  preferences: PlanInput['preferences']
  inputs: PlanInput
  createdAt: string
}

export interface WorkoutTemplateDraft {
  title: string
  description: string
  focus: FocusArea
  style: Goal
  inputs: PlanInput
}

export type PlanStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'COMPLETED'

export interface WorkoutPlan {
  id: string
  userId: string
  name: string
  goal: string
  sessions: PlanDay[]
  createdAt: string
  status?: PlanStatus
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
  templateId?: string
  name: string
  startedAt: string
  endedAt?: string
  status?: 'in_progress' | 'completed' | 'cancelled'
  impact?: WorkoutImpact
  timezone?: string | null
  sessionNotes?: string | null
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
  sets: WorkoutSet[]
  orderIndex: number
  variation?: ExerciseVariation
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
  setType?: SetType
  weightUnit?: WeightUnit
  restSecondsActual?: number | '' | null
  failure?: boolean
  tempo?: string | null
  romCue?: string | null
  painScore?: number | '' | null
  painArea?: string | '' | null
  groupId?: string | '' | null
  groupType?: GroupType | '' | null
  extras?: Record<string, string | null> | null
}
