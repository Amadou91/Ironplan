import type { EquipmentInventory, PlanInput, WeightUnit } from '@/types/domain'

export type SettingsPreferences = {
  units: WeightUnit
}

export type UserPreferences = {
  settings?: SettingsPreferences
  equipment?: {
    inventory: EquipmentInventory
  }
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
    },
    equipment: input.equipment
  }
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
