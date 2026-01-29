/**
 * Equipment matching and availability utilities.
 * Handles equipment inventory checks and option selection.
 */

import type {
  Exercise,
  EquipmentInventory,
  EquipmentOption,
  EquipmentOrGroup
} from '@/types/domain'
import { evaluateEquipmentExpression, isOrGroupSatisfied } from '@/lib/equipment-groups'

/**
 * Checks if a machine type is available in inventory.
 */
export const hasMachine = (
  inventory: EquipmentInventory,
  machineType?: keyof EquipmentInventory['machines']
): boolean =>
  machineType ? inventory.machines[machineType] : Object.values(inventory.machines).some(Boolean)

/**
 * Checks if a single equipment requirement is met.
 */
const isRequirementMet = (
  inventory: EquipmentInventory,
  requirement: EquipmentOption['kind']
): boolean => {
  switch (requirement) {
    case 'bodyweight':
      return inventory.bodyweight
    case 'bench_press':
      return inventory.benchPress
    case 'dumbbell':
      return inventory.dumbbells.length > 0
    case 'kettlebell':
      return inventory.kettlebells.length > 0
    case 'band':
      return inventory.bands.length > 0
    case 'barbell':
      return inventory.barbell.available
    case 'machine':
      return Object.values(inventory.machines).some(Boolean)
    case 'block':
    case 'bolster':
    case 'strap':
      return true
    default:
      return false
  }
}

/**
 * Checks if a specific equipment option is available.
 */
export const isEquipmentOptionAvailable = (
  inventory: EquipmentInventory,
  option: Exercise['equipment'][number]
): boolean => {
  if (option.requires?.length) {
    const meetsRequirements = option.requires.every((requirement) =>
      isRequirementMet(inventory, requirement)
    )
    if (!meetsRequirements) return false
  }
  switch (option.kind) {
    case 'bodyweight':
      return inventory.bodyweight
    case 'bench_press':
      return inventory.benchPress
    case 'dumbbell':
      return inventory.dumbbells.length > 0
    case 'kettlebell':
      return inventory.kettlebells.length > 0
    case 'band':
      return inventory.bands.length > 0
    case 'barbell':
      return inventory.barbell.available
    case 'machine':
      return hasMachine(inventory, option.machineType)
    default:
      return false
  }
}

/**
 * Check if an exercise's equipment requirements are satisfied.
 * Evaluates: (OR-group satisfied if present) AND (at least one equipment option available)
 * 
 * This is the primary function for filtering exercises during workout generation.
 * It handles the full boolean expression including OR-group substitution.
 */
export const isExerciseEquipmentSatisfied = (
  inventory: EquipmentInventory,
  exercise: Exercise
): boolean => {
  // Use the OR-group evaluation if exercise declares one
  if (exercise.orGroup) {
    return evaluateEquipmentExpression(inventory, exercise.equipment, exercise.orGroup)
  }
  
  // Fall back to standard evaluation: at least one equipment option available
  if (!exercise.equipment?.length) return true
  return exercise.equipment.some(option => isEquipmentOptionAvailable(inventory, option))
}

/**
 * Selects the best available equipment option for an exercise.
 */
export const selectEquipmentOption = (
  inventory: EquipmentInventory,
  options: Exercise['equipment'],
  orGroup?: EquipmentOrGroup
): Exercise['equipment'][number] | undefined => {
  // If there's an OR-group, ensure it's satisfied first
  if (orGroup && !isOrGroupSatisfied(inventory, orGroup)) {
    return undefined
  }
  return options?.find(option => isEquipmentOptionAvailable(inventory, option))
}
