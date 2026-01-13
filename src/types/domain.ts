export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type Intensity = 'low' | 'moderate' | 'high'
export type Equipment = 'bodyweight' | 'dumbbells' | 'barbell' | 'kettlebell' | 'bands' | 'machines'
export type MachineType = 'bench' | 'lat_pulldown' | 'cable' | 'assault_bike' | 'leg_press'
export type LoadType = 'bodyweight' | 'dumbbell' | 'barbell' | 'kettlebell' | 'band' | 'machine' | 'none'
export type TimeWindow = 'morning' | 'afternoon' | 'evening'
export type FocusArea = 'upper' | 'lower' | 'full_body' | 'core' | 'cardio' | 'mobility'
export type RestPreference = 'balanced' | 'high_recovery' | 'minimal_rest'
export type GoalPriority = 'primary' | 'balanced' | 'secondary'

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

export interface EquipmentInventory {
  bodyweight: boolean
  dumbbells: number[]
  kettlebells: number[]
  bands: string[]
  barbell: {
    available: boolean
    barWeight: number
    plates: number[]
  }
  machines: Record<MachineType, boolean>
}

export interface PlanInput {
  goals: {
    primary: Goal
    secondary?: Goal
    priority: GoalPriority
  }
  experienceLevel: ExperienceLevel
  intensity: Intensity
  equipment: EquipmentInventory
  time: TimeConstraint
  schedule: ScheduleConstraint
  preferences: PlanPreferences
}

export interface Exercise {
  name: string
  focus: FocusArea
  sets: number
  reps: string
  rpe: number
  equipment: Equipment[]
  durationMinutes: number
  machineRequirement?: MachineType[]
  loadType?: LoadType
  suggestedLoad?: string
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
    workoutScore: {
      total: number
      breakdown: {
        volume: number
        intensity: number
        density: number
      }
    }
  }
}
