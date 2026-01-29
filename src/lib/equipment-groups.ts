/**
 * Equipment OR-Group Definitions
 * 
 * This module defines explicit equipment substitution groups (OR-groups) for workout generation.
 * OR-groups allow exercises to be satisfied by any equipment within the group.
 * Groups combine with each other via AND logic.
 * 
 * RULES:
 * 1. OR-groups are explicit and scoped, not inferred ad hoc.
 * 2. Exercises declare which OR-group (if any) they belong to via `orGroup` field.
 * 3. Workout generation must evaluate the full boolean expression.
 * 4. If any AND requirement fails, generation must fail.
 * 5. Do not auto-create new OR-groups without explicit definition and review.
 */

import type { EquipmentKind, MachineType, EquipmentInventory, EquipmentOption } from '@/types/domain'

/**
 * Enumeration of all supported OR-groups.
 * Each group has a specific scope and context where substitution is valid.
 */
export type EquipmentOrGroup =
  | 'free_weight_primary'        // Barbell OR Dumbbells - general free weight loading
  | 'single_implement'           // Kettlebell OR Dumbbell - single-implement ballistic/unilateral
  | 'pull_up_infrastructure'     // Pull-up Bar OR Rings - bodyweight pulling
  | 'treadmill_outdoor'          // Treadmill OR Outdoor Running
  | 'stationary_spin'            // Stationary Bike OR Spin Bike (indoor_bicycle)
  | 'rowing_machines'            // Row Erg OR Ski Erg (rower)
  | 'resistance_variable'        // Resistance Bands OR Cables

/**
 * Definition of equipment kinds that satisfy each OR-group.
 * Each group maps to the equipment kinds that can substitute for each other.
 */
export const EQUIPMENT_OR_GROUPS: Record<EquipmentOrGroup, {
  kinds: EquipmentKind[]
  machineTypes?: MachineType[]
  description: string
  scope: string
}> = {
  free_weight_primary: {
    kinds: ['barbell', 'dumbbell'],
    description: 'Barbell OR Dumbbells',
    scope: 'General free weight loading for bilateral movements'
  },
  single_implement: {
    kinds: ['kettlebell', 'dumbbell'],
    description: 'Kettlebell OR single Dumbbell',
    scope: 'Single-implement ballistic or unilateral exercises (e.g., swings, goblet squats)'
  },
  pull_up_infrastructure: {
    kinds: ['bodyweight'],  // Represented as bodyweight with implicit bar/rings
    description: 'Pull-up Bar OR Rings',
    scope: 'Bodyweight pulling movements only'
  },
  treadmill_outdoor: {
    kinds: ['machine', 'bodyweight'],
    machineTypes: ['treadmill'],
    description: 'Treadmill OR Outdoor Running',
    scope: 'Running-based cardio activities'
  },
  stationary_spin: {
    kinds: ['machine'],
    machineTypes: ['indoor_bicycle', 'outdoor_bicycle'],
    description: 'Stationary Bike OR Spin Bike',
    scope: 'Cycling-based cardio activities'
  },
  rowing_machines: {
    kinds: ['machine'],
    machineTypes: ['rower'],
    description: 'Row Erg OR Ski Erg',
    scope: 'Rowing/pulling cardio machines'
  },
  resistance_variable: {
    kinds: ['band', 'machine'],
    machineTypes: ['cable'],
    description: 'Resistance Bands OR Cables',
    scope: 'Variable resistance exercises where substitution is valid'
  }
}

/**
 * Equipment that must remain standalone (AND logic only).
 * These items cannot be substituted and must be explicitly available.
 */
export const NON_SUBSTITUTABLE_EQUIPMENT: EquipmentKind[] = [
  'bench_press'  // Never substitutable
]

/**
 * Machine types that must remain standalone (AND logic only).
 * These represent constrained-path or specialized machines.
 */
export const NON_SUBSTITUTABLE_MACHINES: MachineType[] = [
  'leg_press'    // Specialized machine, not substitutable
]

/**
 * Check if a specific equipment kind is available in the inventory.
 */
const isKindAvailable = (inventory: EquipmentInventory, kind: EquipmentKind, machineType?: MachineType): boolean => {
  switch (kind) {
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
      if (machineType) {
        return inventory.machines[machineType] === true
      }
      return Object.values(inventory.machines).some(Boolean)
    case 'block':
    case 'bolster':
    case 'strap':
      return true  // Props always available
    default:
      return false
  }
}

/**
 * Check if an OR-group is satisfied by the inventory.
 * Returns true if at least one equipment in the group is available.
 */
export const isOrGroupSatisfied = (
  inventory: EquipmentInventory,
  group: EquipmentOrGroup
): boolean => {
  const groupDef = EQUIPMENT_OR_GROUPS[group]
  if (!groupDef) return false

  // Check if any equipment kind in the group is available
  for (const kind of groupDef.kinds) {
    if (kind === 'machine' && groupDef.machineTypes?.length) {
      // For machines, check specific machine types
      for (const machineType of groupDef.machineTypes) {
        if (isKindAvailable(inventory, 'machine', machineType)) {
          return true
        }
      }
    } else {
      if (isKindAvailable(inventory, kind)) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if an equipment option with OR-group is available.
 * This evaluates: (OR-group satisfied) AND (any other requirements met)
 */
export const isEquipmentOptionWithGroupAvailable = (
  inventory: EquipmentInventory,
  option: EquipmentOption & { orGroup?: EquipmentOrGroup }
): boolean => {
  const { orGroup, ...baseOption } = option

  // If exercise has an OR-group, check if the group is satisfied
  if (orGroup) {
    if (!isOrGroupSatisfied(inventory, orGroup)) {
      return false
    }
  }

  // Check additional requirements (AND logic)
  if (baseOption.requires?.length) {
    for (const requirement of baseOption.requires) {
      if (!isKindAvailable(inventory, requirement)) {
        return false
      }
    }
  }

  // If no OR-group, fall back to standard equipment check
  if (!orGroup) {
    return isKindAvailable(inventory, baseOption.kind, 
      baseOption.kind === 'machine' ? (baseOption as { machineType?: MachineType }).machineType : undefined)
  }

  return true
}

/**
 * Evaluate a full equipment requirement expression.
 * Handles: ((OR-group) AND requirement AND requirement...)
 * 
 * @param inventory - User's available equipment
 * @param options - Array of equipment options (OR'd together)
 * @param orGroup - Optional OR-group that applies to this exercise
 * @returns true if requirements are satisfied
 */
export const evaluateEquipmentExpression = (
  inventory: EquipmentInventory,
  options: EquipmentOption[],
  orGroup?: EquipmentOrGroup
): boolean => {
  // If there's an OR-group, it must be satisfied first
  if (orGroup && !isOrGroupSatisfied(inventory, orGroup)) {
    return false
  }

  // Then check if at least one equipment option is available
  if (options.length === 0) return true

  return options.some(option => {
    // Check the equipment kind itself
    const kindAvailable = isKindAvailable(
      inventory,
      option.kind,
      option.kind === 'machine' ? (option as { machineType?: MachineType }).machineType : undefined
    )

    if (!kindAvailable) return false

    // Check additional requirements (AND logic)
    if (option.requires?.length) {
      return option.requires.every(req => isKindAvailable(inventory, req))
    }

    return true
  })
}

/**
 * Get all available equipment from an OR-group.
 * Returns the list of equipment kinds from the group that are currently available.
 */
export const getAvailableFromGroup = (
  inventory: EquipmentInventory,
  group: EquipmentOrGroup
): EquipmentKind[] => {
  const groupDef = EQUIPMENT_OR_GROUPS[group]
  if (!groupDef) return []

  const available: EquipmentKind[] = []

  for (const kind of groupDef.kinds) {
    if (kind === 'machine' && groupDef.machineTypes?.length) {
      for (const machineType of groupDef.machineTypes) {
        if (isKindAvailable(inventory, 'machine', machineType)) {
          available.push('machine')
          break  // Only add 'machine' once
        }
      }
    } else if (isKindAvailable(inventory, kind)) {
      available.push(kind)
    }
  }

  return available
}

/**
 * Select the best equipment option from an OR-group based on availability and preference.
 * Prefers barbell > dumbbell for free_weight_primary, etc.
 */
export const selectFromOrGroup = (
  inventory: EquipmentInventory,
  group: EquipmentOrGroup
): EquipmentKind | null => {
  const available = getAvailableFromGroup(inventory, group)
  if (available.length === 0) return null

  // Return first available (ordered by preference in group definition)
  return available[0]
}

/**
 * Describes the boolean expression for debug/logging purposes.
 */
export const describeEquipmentExpression = (
  options: EquipmentOption[],
  orGroup?: EquipmentOrGroup
): string => {
  const parts: string[] = []

  if (orGroup) {
    const groupDef = EQUIPMENT_OR_GROUPS[orGroup]
    parts.push(`(${groupDef?.description ?? orGroup})`)
  }

  if (options.length > 0) {
    const optionDescs = options.map(opt => {
      let desc: string = opt.kind
      if (opt.kind === 'machine' && (opt as { machineType?: MachineType }).machineType) {
        desc = (opt as { machineType: MachineType }).machineType as string
      }
      if (opt.requires?.length) {
        desc += ` + ${opt.requires.join(' + ')}`
      }
      return desc
    })
    parts.push(`(${optionDescs.join(' OR ')})`)
  }

  return parts.join(' AND ') || 'No equipment required'
}
