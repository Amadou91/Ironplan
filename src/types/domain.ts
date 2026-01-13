export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type Intensity = 'low' | 'moderate' | 'high'
export type EquipmentKind = 'bodyweight' | 'dumbbell' | 'kettlebell' | 'band' | 'barbell' | 'machine'
export type EquipmentPreset = 'home_minimal' | 'full_gym' | 'hotel'
export type BandResistance = 'light' | 'medium' | 'heavy'
export type MachineType = 'cable' | 'leg_press' | 'treadmill' | 'rower'
export type LoadUnit = 'lb'
export type TimeWindow = 'morning' | 'afternoon' | 'evening'
export type FocusArea = 'upper' | 'lower' | 'full_body' | 'core' | 'cardio' | 'mobility'
export type RestPreference = 'balanced' | 'high_recovery' | 'minimal_rest'
export type GoalPriority = 'primary' | 'balanced' | 'secondary'

export interface EquipmentRequirement {
  kind: EquipmentKind
  machineType?: MachineType
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

export interface EquipmentProfile {
  preset: EquipmentPreset | 'custom'
  inventory: EquipmentInventory
}

export interface TimeConstraint {
  minutesPerSession: number
  totalMinutesPerWeek?: number
}

export interface ScheduleConstraint {
  daysAvailable: number[]
  timeWindows: TimeWindow[]
  minRestDays: number
}

export interface PlanPreferences {
  focusAreas: FocusArea[]
  dislikedActivities: string[]
  accessibilityConstraints: string[]
  restPreference: RestPreference
}

export interface PlanInput {
  goals: {
    primary: Goal
    secondary?: Goal
    priority: GoalPriority
  }
  experienceLevel: ExperienceLevel
  intensity: Intensity
  equipment: EquipmentProfile
  time: TimeConstraint
  schedule: ScheduleConstraint
  preferences: PlanPreferences
}

export interface ExerciseLoad {
  value: number
  unit: LoadUnit
  label: string
}

export interface Exercise {
  name: string
  focus: FocusArea
  sets: number
  reps: string
  rpe: number
  equipment: EquipmentRequirement[]
  durationMinutes: number
  load?: ExerciseLoad
  restSeconds?: number
  notes?: string
}

export interface PlanDay {
  dayOfWeek: number
  timeWindow: TimeWindow
  focus: FocusArea
  durationMinutes: number
  exercises: Exercise[]
  rationale: string
}

export interface GeneratedPlan {
  title: string
  description: string
  goal: Goal
  level: ExperienceLevel
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

export interface WorkoutImpact {
  score: number
  breakdown: {
    volume: number
    intensity: number
    density: number
  }
}
