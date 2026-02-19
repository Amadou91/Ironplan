import type { EquipmentInventory, PlanInput, WeightUnit } from '@/types/domain'

export type AcrVisibility = 'dashboard' | 'progress' | 'both'

export type SettingsPreferences = {
  units: WeightUnit
  acrVisibility: AcrVisibility
}

/**
 * Custom RPE baselines for different intensity levels.
 * Allows users to personalize what "low", "moderate", and "high" intensity mean.
 */
export type CustomRpeBaselines = {
  low: number       // Default: 6
  moderate: number  // Default: 7  
  high: number      // Default: 8.5
}

export type TrainingPreferences = {
  customRpeBaselines?: CustomRpeBaselines
}

export type UserPreferences = {
  settings?: SettingsPreferences
  equipment?: {
    inventory: EquipmentInventory
  }
  training?: TrainingPreferences
}

export const defaultRpeBaselines: CustomRpeBaselines = {
  low: 6,
  moderate: 7,
  high: 8.5
}

export const defaultPreferences: UserPreferences = {
  settings: {
    units: 'lb',
    acrVisibility: 'both'
  },
  training: {
    customRpeBaselines: { ...defaultRpeBaselines }
  }
}

export const normalizePreferences = (value: unknown): UserPreferences => {
  if (!value || typeof value !== 'object') {
    return { ...defaultPreferences }
  }
  const input = value as UserPreferences
  const validAcrValues: AcrVisibility[] = ['dashboard', 'progress', 'both']
  const rawAcr = input.settings?.acrVisibility
  const acrVisibility: AcrVisibility = rawAcr && validAcrValues.includes(rawAcr) ? rawAcr : 'both'
  return {
    settings: {
      units: input.settings?.units ?? defaultPreferences.settings?.units ?? 'lb',
      acrVisibility
    },
    equipment: input.equipment,
    training: {
      customRpeBaselines: {
        low: input.training?.customRpeBaselines?.low ?? defaultRpeBaselines.low,
        moderate: input.training?.customRpeBaselines?.moderate ?? defaultRpeBaselines.moderate,
        high: input.training?.customRpeBaselines?.high ?? defaultRpeBaselines.high
      }
    }
  }
}

/**
 * Gets the RPE baseline for a given intensity level from user preferences.
 * Falls back to defaults if not specified.
 */
export const getRpeFromPreferences = (
  intensity: 'low' | 'moderate' | 'high',
  preferences?: UserPreferences
): number => {
  const baselines = preferences?.training?.customRpeBaselines ?? defaultRpeBaselines
  return baselines[intensity] ?? defaultRpeBaselines[intensity]
}

export const applyPreferencesToPlanInput = (input: PlanInput, preferences: UserPreferences): PlanInput => {
  const result = { ...input }
  if (preferences.equipment?.inventory) {
    result.equipment = {
      ...result.equipment,
      inventory: preferences.equipment.inventory
    }
  }
  return result
}
