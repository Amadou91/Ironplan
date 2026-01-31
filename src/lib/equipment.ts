import type { BandResistance, EquipmentInventory, EquipmentOption, EquipmentPreset, MachineType, WeightUnit } from '@/types/domain'
import { convertWeight, roundWeight } from '@/lib/units'

export type WeightOption = {
  /** Unique key for this option (e.g., 'dumbbell-30', 'kettlebell-30') */
  key: string
  value: number
  label: string
  unit?: WeightUnit
  /** Equipment kind that this weight option belongs to (for UI decisions like dumbbell toggle) */
  equipmentKind?: EquipmentOption['kind']
}

export const DUMBBELL_WEIGHT_OPTIONS = [5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const
export const KETTLEBELL_WEIGHT_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60] as const
export const BARBELL_PLATE_OPTIONS = [10, 25, 35, 45] as const

export const equipmentPresets: Record<EquipmentPreset, EquipmentInventory> = {
  home_minimal: {
    bodyweight: true,
    benchPress: false,
    dumbbells: [10, 20],
    kettlebells: [],
    bands: ['light', 'medium'],
    barbell: { available: false, plates: [] },
    machines: {
      cable: false,
      leg_press: false,
      treadmill: false,
      rower: false,
      indoor_bicycle: false,
      outdoor_bicycle: false
    }
  },
  full_gym: {
    bodyweight: true,
    benchPress: true,
    dumbbells: [...DUMBBELL_WEIGHT_OPTIONS],
    kettlebells: [...KETTLEBELL_WEIGHT_OPTIONS],
    bands: ['light', 'medium', 'heavy'],
    barbell: { available: true, plates: [...BARBELL_PLATE_OPTIONS] },
    machines: {
      cable: true,
      leg_press: true,
      treadmill: true,
      rower: true,
      indoor_bicycle: true,
      outdoor_bicycle: true
    }
  },
  custom: {
    bodyweight: false,
    benchPress: false,
    dumbbells: [],
    kettlebells: [],
    bands: [],
    barbell: { available: false, plates: [] },
    machines: {
      cable: false,
      leg_press: false,
      treadmill: false,
      rower: false,
      indoor_bicycle: false,
      outdoor_bicycle: false
    }
  },
  hotel: {
    bodyweight: true,
    benchPress: false,
    dumbbells: [10, 15, 20],
    kettlebells: [],
    bands: ['light'],
    barbell: { available: false, plates: [] },
    machines: {
      cable: false,
      leg_press: false,
      treadmill: true,
      rower: false,
      indoor_bicycle: false,
      outdoor_bicycle: false
    }
  }
}

export const cloneInventory = (inventory: EquipmentInventory): EquipmentInventory => ({
  bodyweight: inventory.bodyweight,
  benchPress: inventory.benchPress,
  dumbbells: [...inventory.dumbbells],
  kettlebells: [...inventory.kettlebells],
  bands: [...inventory.bands],
  barbell: {
    available: inventory.barbell.available,
    plates: [...inventory.barbell.plates]
  },
  machines: { ...inventory.machines }
})

export const formatWeightList = (weights: number[]) => [...weights].sort((a, b) => a - b).join(', ')

export const hasEquipment = (inventory: EquipmentInventory) =>
  inventory.bodyweight ||
  inventory.benchPress ||
  inventory.dumbbells.length > 0 ||
  inventory.kettlebells.length > 0 ||
  inventory.bands.length > 0 ||
  inventory.barbell.available ||
  Object.values(inventory.machines).some(Boolean)

export const parseWeightList = (value: string) =>
  value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item) && item > 0)
    .sort((a, b) => a - b)

export const machineLabels: Record<MachineType, string> = {
  cable: 'Cable Machine',
  leg_press: 'Leg Press',
  treadmill: 'Treadmill',
  rower: 'Rowing Machine',
  indoor_bicycle: 'Indoor Bicycle',
  outdoor_bicycle: 'Outdoor Bicycle'
}

export const bandLabels: Record<BandResistance, string> = {
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy'
}

const bandLoadMap: Record<BandResistance, number> = {
  light: 10,
  medium: 20,
  heavy: 30
}

const isRequirementMet = (inventory: EquipmentInventory, requirement: EquipmentOption['kind']) => {
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

export const isEquipmentOptionAvailable = (inventory: EquipmentInventory, option: EquipmentOption) => {
  if (option.requires?.length) {
    const meetsRequirements = option.requires.every((requirement) => isRequirementMet(inventory, requirement))
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
      return option.machineType ? inventory.machines[option.machineType] : Object.values(inventory.machines).some(Boolean)
    default:
      return false
  }
}

export const isExerciseEquipmentAvailable = (inventory: EquipmentInventory, equipment: EquipmentOption[]) =>
  equipment.some(option => isEquipmentOptionAvailable(inventory, option))

const buildBarbellLoadOptions = (inventory: EquipmentInventory) => {
  const base = 45
  if (!inventory.barbell.available) return []
  const possibleLoads = new Set<number>([base])
  inventory.barbell.plates.forEach((plateWeight) => {
    const currentLoads = Array.from(possibleLoads)
    currentLoads.forEach(load => {
      possibleLoads.add(load + plateWeight * 2)
    })
  })
  return Array.from(possibleLoads)
    .sort((a, b) => a - b)
    .map((value) => ({ value, label: `${value} lb barbell` }))
}

/**
 * Builds selectable weight options based on equipment inventory.
 * 
 * NOTE: profileWeightLb parameter is kept for API compatibility but is NOT used.
 * Bodyweight is not a selectable weight option - exercises using bodyweight
 * should have weight=0 or null and will show 0 tonnage (external weight only).
 */
export const buildWeightOptions = (
  inventory: EquipmentInventory,
  equipmentOptions: EquipmentOption[],
  _profileWeightLb?: number | null,
  preferredUnit: WeightUnit = 'lb'
) => {
  const availableOptions = equipmentOptions.filter((option) => isEquipmentOptionAvailable(inventory, option))
  if (!availableOptions.length) return []
  const kindCount = new Set(availableOptions.map((option) => option.kind)).size
  const showKindLabel = kindCount > 1
  const unitLabel = preferredUnit
  
  // Always include bodyweight (0) option at the top
  const options: WeightOption[] = [
    { key: 'bodyweight-0', value: 0, label: `0 ${unitLabel} (Bodyweight)`, unit: preferredUnit, equipmentKind: 'bodyweight' }
  ]
  const toPreferred = (value: number) => roundWeight(convertWeight(value, 'lb', preferredUnit))

  availableOptions.forEach((option) => {
    switch (option.kind) {
      case 'dumbbell':
        inventory.dumbbells.forEach((weight) => {
          const converted = toPreferred(weight)
          options.push({
            key: `dumbbell-${converted}`,
            value: converted,
            unit: preferredUnit,
            label: `${converted} ${unitLabel} dumbbell each`,
            equipmentKind: 'dumbbell'
          })
        })
        break
      case 'kettlebell':
        inventory.kettlebells.forEach((weight) => {
          const converted = toPreferred(weight)
          options.push({
            key: `kettlebell-${converted}`,
            value: converted,
            unit: preferredUnit,
            label: showKindLabel ? `${converted} ${unitLabel} kettlebell` : `${converted} ${unitLabel}`,
            equipmentKind: 'kettlebell'
          })
        })
        break
      case 'barbell':
        buildBarbellLoadOptions(inventory).forEach((option) => {
          const converted = toPreferred(option.value)
          options.push({
            key: `barbell-${converted}`,
            value: converted,
            unit: preferredUnit,
            label: showKindLabel ? `${converted} ${unitLabel} barbell (total)` : `${converted} ${unitLabel} (total)`,
            equipmentKind: 'barbell'
          })
        })
        break
      case 'band':
        inventory.bands.forEach((band) => {
          const value = bandLoadMap[band] ?? 10
          const converted = toPreferred(value)
          options.push({
            key: `band-${band}-${converted}`,
            value: converted,
            unit: preferredUnit,
            label: showKindLabel
              ? `${bandLabels[band]} band (~${converted} ${unitLabel})`
              : `${bandLabels[band]} band`,
            equipmentKind: 'band'
          })
        })
        break
      case 'bodyweight':
        // Bodyweight is NOT a selectable "weight" option.
        // Exercises using bodyweight have weight=0 or null.
        // External tonnage = 0 for sets without explicit weight (pure accuracy).
        break
      case 'machine':
      default:
        break
    }
  })

  const seen = new Set<string>()
  return options.filter((option) => {
    const key = `${option.value}-${option.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
