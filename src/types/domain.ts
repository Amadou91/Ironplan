export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type Intensity = 'low' | 'moderate' | 'high'
export type Equipment = 'gym' | 'dumbbells' | 'bodyweight' | 'bands' | 'kettlebell'
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

export interface PlanInput {
  goals: {
    primary: Goal
    secondary?: Goal
    priority: GoalPriority
  }
  experienceLevel: ExperienceLevel
  intensity: Intensity
  equipment: Equipment[]
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
  }
}
