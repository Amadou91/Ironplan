/**
 * Plan and template types.
 * Defines workout plans, templates, and generation inputs.
 */

import type {
  Goal,
  Intensity,
  FocusArea,
  CardioActivity,
  GoalPriority,
  RestPreference
} from '@/types/core.types'
import type { EquipmentPreset, EquipmentInventory } from '@/types/equipment.types'
import type { Exercise } from '@/types/exercise.types'
import type { WorkoutImpact } from '@/types/session.types'

export interface PlanDay {
  order: number
  name?: string
  focus: FocusArea
  durationMinutes: number
  rationale: string
  exercises: Exercise[]
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
    cardioActivities?: CardioActivity[]
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
