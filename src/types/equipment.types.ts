/**
 * Equipment-related types.
 * Defines equipment kinds, inventories, and configuration.
 */

export type BandResistance = 'light' | 'medium' | 'heavy'

export type MachineType = 'cable' | 'leg_press' | 'treadmill' | 'rower' | 'indoor_bicycle' | 'outdoor_bicycle'

export type EquipmentPreset = 'home_minimal' | 'full_gym' | 'hotel'

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
