import { cloneInventory, equipmentPresets } from '@/lib/equipment'
import type { EquipmentPreset, FocusArea, Goal, PlanInput, RestPreference, WeightUnit } from '@/types/domain'

export type OnboardingPreferences = {
  goal: Goal
  focusAreas: FocusArea[]
  experienceLevel: PlanInput['experienceLevel']
  equipmentPreset: EquipmentPreset
  minutesPerSession: number
  daysPerWeek: number
  restPreference: RestPreference
}

export type SettingsPreferences = {
  units: WeightUnit
  notifications: {
    workoutReminders: boolean
    weeklySummary: boolean
  }
  shareProgress: boolean
}

export type UserPreferences = {
  onboarding?: OnboardingPreferences
  settings?: SettingsPreferences
  onboardingCompleted?: boolean
}

export const defaultPreferences: UserPreferences = {
  onboarding: {
    goal: 'strength',
    focusAreas: ['chest'],
    experienceLevel: 'intermediate',
    equipmentPreset: 'full_gym',
    minutesPerSession: 45,
    daysPerWeek: 3,
    restPreference: 'balanced'
  },
  settings: {
    units: 'lb',
    notifications: {
      workoutReminders: true,
      weeklySummary: true
    },
    shareProgress: false
  },
  onboardingCompleted: false
}

export const normalizePreferences = (value: unknown): UserPreferences => {
  if (!value || typeof value !== 'object') {
    return { ...defaultPreferences }
  }
  const input = value as UserPreferences
  return {
    onboarding: {
      ...defaultPreferences.onboarding,
      ...input.onboarding
    },
    settings: {
      ...defaultPreferences.settings,
      ...input.settings,
      notifications: {
        ...defaultPreferences.settings?.notifications,
        ...(input.settings?.notifications ?? {})
      }
    },
    onboardingCompleted: input.onboardingCompleted ?? defaultPreferences.onboardingCompleted
  }
}

export const applyPreferencesToPlanInput = (input: PlanInput, preferences: UserPreferences) => {
  const onboarding = preferences.onboarding
  if (!onboarding) return input
  const focus = onboarding.focusAreas?.[0] ?? input.intent.bodyParts?.[0] ?? 'chest'
  const daysPerWeek = Math.max(1, Math.min(6, onboarding.daysPerWeek || 3))
  const daysAvailable = Array.from({ length: daysPerWeek }, (_, index) => index)

  return {
    ...input,
    intent: {
      ...input.intent,
      mode: 'body_part',
      style: onboarding.goal,
      bodyParts: onboarding.focusAreas?.length ? onboarding.focusAreas : [focus]
    },
    goals: {
      ...input.goals,
      primary: onboarding.goal
    },
    experienceLevel: onboarding.experienceLevel,
    equipment: {
      preset: onboarding.equipmentPreset,
      inventory: cloneInventory(equipmentPresets[onboarding.equipmentPreset])
    },
    time: {
      ...input.time,
      minutesPerSession: onboarding.minutesPerSession
    },
    schedule: {
      ...input.schedule,
      daysAvailable,
      weeklyLayout: undefined
    },
    preferences: {
      ...input.preferences,
      focusAreas: onboarding.focusAreas?.length ? onboarding.focusAreas : [focus],
      restPreference: onboarding.restPreference
    }
  }
}
