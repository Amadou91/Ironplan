import type { PlanInput, WeightUnit } from '@/types/domain'

export type SettingsPreferences = {
  units: WeightUnit
}

export type UserPreferences = {
  settings?: SettingsPreferences
}

export const defaultPreferences: UserPreferences = {
  settings: {
    units: 'lb'
  }
}

export const normalizePreferences = (value: unknown): UserPreferences => {
  if (!value || typeof value !== 'object') {
    return { ...defaultPreferences }
  }
  const input = value as UserPreferences
  return {
    settings: {
      units: input.settings?.units ?? defaultPreferences.settings?.units ?? 'lb'
    }
  }
}

export const applyPreferencesToPlanInput = (input: PlanInput, _preferences: UserPreferences) => {
  return input
}
