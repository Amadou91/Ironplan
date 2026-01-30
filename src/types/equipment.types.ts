/**
 * Equipment-related types.
 * Defines equipment kinds, inventories, and configuration.
 */

export type BandResistance = 'light' | 'medium' | 'heavy'

export type MachineType = 'cable' | 'leg_press' | 'treadmill' | 'rower' | 'indoor_bicycle' | 'outdoor_bicycle'

export type EquipmentPreset = 'home_minimal' | 'full_gym' | 'hotel' | 'custom'

export type EquipmentKind =
  | 'bodyweight'
  | 'dumbbell'
  | 'kettlebell'
  | 'band'
  | 'barbell'
  | 'bench_press'
  | 'machine'
  | 'block'
  | 'bolster'
  | 'strap'

/**
 * Equipment requirement mode for free-weight equipment.
 * - 'or': Any selected equipment can satisfy the requirement (substitutable)
 * - 'and': All selected equipment is required (no substitution)
 */
export type EquipmentRequirementMode = 'or' | 'and'

/**
 * Free-weight equipment kinds that support OR/AND logic.
 * These are substitutable for strength exercises when in OR mode.
 */
export const FREE_WEIGHT_EQUIPMENT: EquipmentKind[] = [
  'bodyweight',
  'barbell',
  'dumbbell',
  'kettlebell',
  'band'
]

/**
 * Equipment OR-groups for substitutable equipment.
 * Exercises can declare an OR-group to allow any equipment within the group.
 * Groups combine with other requirements via AND logic.
 */
export type EquipmentOrGroup =
  | 'free_weight_primary'        // Barbell OR Dumbbells
  | 'single_implement'           // Kettlebell OR Dumbbell (single-implement ballistic/unilateral)
  | 'pull_up_infrastructure'     // Pull-up Bar OR Rings (bodyweight pulling)
  | 'treadmill_outdoor'          // Treadmill OR Outdoor Running
  | 'stationary_spin'            // Stationary Bike OR Spin Bike
  | 'rowing_machines'            // Row Erg OR Ski Erg
  | 'resistance_variable'        // Resistance Bands OR Cables

/**
 * Specifies if additional equipment like bench_press or machines are required or optional.
 * - 'required': Equipment MUST be available (AND logic)
 * - 'optional': Equipment is preferred but not required (soft requirement)
 */
export type AdditionalEquipmentMode = 'required' | 'optional'

type EquipmentRequirement = { requires?: EquipmentKind[] }

export type EquipmentOption =
  | ({ kind: 'bodyweight' } & EquipmentRequirement)
  | ({ kind: 'dumbbell' } & EquipmentRequirement)
  | ({ kind: 'kettlebell' } & EquipmentRequirement)
  | ({ kind: 'band' } & EquipmentRequirement)
  | ({ kind: 'barbell' } & EquipmentRequirement)
  | ({ kind: 'bench_press' } & EquipmentRequirement)
  | ({ kind: 'machine'; machineType?: MachineType } & EquipmentRequirement)
  | ({ kind: 'block' } & EquipmentRequirement)
  | ({ kind: 'bolster' } & EquipmentRequirement)
  | ({ kind: 'strap' } & EquipmentRequirement)

export interface EquipmentInventory {
  bodyweight: boolean
  benchPress: boolean
  dumbbells: number[]
  kettlebells: number[]
  bands: BandResistance[]
  barbell: {
    available: boolean
    plates: number[]
  }
  machines: Record<MachineType, boolean>
}
