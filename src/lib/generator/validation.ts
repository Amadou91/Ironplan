import type { PlanInput } from '@/types/domain'
import { hasEquipment } from '@/lib/equipment'
import { DEFAULT_INPUT } from './constants'
import { clamp } from './utils'

export const validatePlanInput = (input: PlanInput): string[] => {
  const errors: string[] = []

  if (input.time.minutesPerSession < 20 || input.time.minutesPerSession > 120) {
    errors.push('Minutes per session must be between 20 and 120.')
  }

  if (input.time.totalMinutesPerWeek !== undefined && input.time.totalMinutesPerWeek < 40) {
    errors.push('Total weekly minutes must be at least 40 when provided.')
  }

  if (input.intent.mode === 'style' && !input.intent.style) {
    errors.push('Select a workout style.')
  }

  if (input.intent.mode === 'body_part' && (!input.intent.bodyParts || input.intent.bodyParts.length === 0)) {
    errors.push('Select at least one body focus area.')
  }

  if (input.schedule.minRestDays < 0 || input.schedule.minRestDays > 2) {
    errors.push('Minimum rest days must be between 0 and 2.')
  }

  if (!hasEquipment(input.equipment.inventory)) {
    errors.push('Select at least one equipment option.')
  }

  return errors
}

export const normalizePlanInput = (input: Partial<PlanInput>): PlanInput => ({
  ...DEFAULT_INPUT,
  ...input,
  intent: {
    ...DEFAULT_INPUT.intent,
    ...input.intent
  },
  goals: {
    ...DEFAULT_INPUT.goals,
    ...input.goals
  },
  equipment: {
    ...DEFAULT_INPUT.equipment,
    ...input.equipment,
    inventory: {
      ...DEFAULT_INPUT.equipment.inventory,
      ...input.equipment?.inventory,
      barbell: {
        ...DEFAULT_INPUT.equipment.inventory.barbell,
        ...input.equipment?.inventory?.barbell
      },
      machines: {
        ...DEFAULT_INPUT.equipment.inventory.machines,
        ...input.equipment?.inventory?.machines
      }
    }
  },
  time: {
    ...DEFAULT_INPUT.time,
    ...input.time
  },
  schedule: {
    ...DEFAULT_INPUT.schedule,
    ...input.schedule
  },
  preferences: {
    ...DEFAULT_INPUT.preferences,
    ...input.preferences
  }
})

export const applyRestPreference = (input: PlanInput): PlanInput => {
  if (input.preferences.restPreference === 'high_recovery') {
    return {
      ...input,
      schedule: { ...input.schedule, minRestDays: Math.max(input.schedule.minRestDays, 1) }
    }
  }
  if (input.preferences.restPreference === 'minimal_rest') {
    return {
      ...input,
      schedule: { ...input.schedule, minRestDays: 0 }
    }
  }
  return input
}

export const adjustMinutesPerSession = (input: PlanInput, sessionsPerWeek: number) => {
  if (!input.time.totalMinutesPerWeek) {
    return input.time.minutesPerSession
  }
  const perSession = Math.floor(input.time.totalMinutesPerWeek / sessionsPerWeek)
  return clamp(perSession, 20, 120)
}
