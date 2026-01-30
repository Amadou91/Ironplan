/**
 * Equipment matching and availability utilities.
 * Handles equipment inventory checks and option selection.
 */

import type {
  Exercise,
  EquipmentInventory,
  EquipmentOption,
  EquipmentOrGroup,
  EquipmentKind
} from '@/types/domain'
import { FREE_WEIGHT_EQUIPMENT } from '@/types/domain'
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
 * Check if an equipment kind is a free-weight type.
 */
const isFreeWeightKind = (kind: EquipmentKind): boolean => 
  FREE_WEIGHT_EQUIPMENT.includes(kind)

/**
 * Check if an equipment kind is additional equipment (bench/machine).
 */
const isAdditionalEquipmentKind = (kind: EquipmentKind): boolean =>
  kind === 'bench_press' || kind === 'machine'

/**
 * Check if an exercise's equipment requirements are satisfied.
 * 
 * Evaluates equipment based on the exercise's configuration:
 * - equipmentMode: 'or' (default) = any free-weight equipment satisfies
 * - equipmentMode: 'and' = all free-weight equipment required
 * - additionalEquipmentMode: 'required' (default) = bench/machine must be available
 * - additionalEquipmentMode: 'optional' = bench/machine preferred but not required
 * 
 * For backwards compatibility, also supports orGroup for predefined substitution groups.
 */
export const isExerciseEquipmentSatisfied = (
  inventory: EquipmentInventory,
  exercise: Exercise
): boolean => {
  // Legacy: Use the OR-group evaluation if exercise declares one
  if (exercise.orGroup) {
    return evaluateEquipmentExpression(inventory, exercise.equipment, exercise.orGroup)
  }
  
  // No equipment = always satisfied
  if (!exercise.equipment?.length) return true

  // Separate equipment into categories
  const freeWeightOptions = exercise.equipment.filter(opt => isFreeWeightKind(opt.kind))
  const additionalOptions = exercise.equipment.filter(opt => isAdditionalEquipmentKind(opt.kind))
  const otherOptions = exercise.equipment.filter(
    opt => !isFreeWeightKind(opt.kind) && !isAdditionalEquipmentKind(opt.kind)
  )

  // Check free-weight equipment based on mode
  const equipmentMode = exercise.equipmentMode ?? 'or'
  let freeWeightSatisfied = true
  
  if (freeWeightOptions.length > 0) {
    if (equipmentMode === 'and') {
      // AND mode: all free-weight equipment must be available
      freeWeightSatisfied = freeWeightOptions.every(opt => isEquipmentOptionAvailable(inventory, opt))
    } else {
      // OR mode (default): any free-weight equipment satisfies
      freeWeightSatisfied = freeWeightOptions.some(opt => isEquipmentOptionAvailable(inventory, opt))
    }
  }

  // Check additional equipment (bench/machine) based on mode
  const additionalMode = exercise.additionalEquipmentMode ?? 'required'
  let additionalSatisfied = true
  
  if (additionalOptions.length > 0) {
    if (additionalMode === 'required') {
      // REQUIRED: must have the additional equipment
      additionalSatisfied = additionalOptions.every(opt => isEquipmentOptionAvailable(inventory, opt))
    } else {
      // OPTIONAL: ignore additional equipment requirements (soft preference)
      additionalSatisfied = true
    }
  }

  // Check other options (yoga props, etc.) - at least one must match
  let otherSatisfied = true
  if (otherOptions.length > 0) {
    otherSatisfied = otherOptions.some(opt => isEquipmentOptionAvailable(inventory, opt))
  }

  // All categories must be satisfied
  return freeWeightSatisfied && additionalSatisfied && otherSatisfied
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
