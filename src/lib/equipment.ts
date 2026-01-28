import type { BandResistance, EquipmentInventory, EquipmentOption, EquipmentPreset, MachineType, WeightUnit } from '@/types/domain'
import { convertWeight, roundWeight } from '@/lib/units'

export type WeightOption = {
  value: number
  label: string
  unit?: WeightUnit
}

export const DUMBBELL_WEIGHT_OPTIONS = [5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const
export const KETTLEBELL_WEIGHT_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60] as const
export const BARBELL_PLATE_OPTIONS = [10, 25, 35, 45] as const

export const equipmentPresets: Record<EquipmentPreset, EquipmentInventory> = {
  home_minimal: {
    bodyweight: true,
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
    dumbbells: [...DUMBBELL_WEIGHT_OPTIONS],
    kettlebells: [...KETTLEBELL_WEIGHT_OPTIONS],
    bands: ['light', 'medium', 'heavy'],
    barbell: { available: true, plates: [10, 25, 35, 45] },
    machines: {
      cable: true,
      leg_press: true,
      treadmill: true,
      rower: true,
      indoor_bicycle: true,
      outdoor_bicycle: true
    }
  },
  hotel: {
    bodyweight: true,
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

export const isEquipmentOptionAvailable = (inventory: EquipmentInventory, option: EquipmentOption) => {
  switch (option.kind) {
    case 'bodyweight':
      return inventory.bodyweight
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

export const buildWeightOptions = (
  inventory: EquipmentInventory,
  equipmentOptions: EquipmentOption[],
  profileWeightLb?: number | null,
  preferredUnit: WeightUnit = 'lb'
) => {
  const availableOptions = equipmentOptions.filter((option) => isEquipmentOptionAvailable(inventory, option))
  if (!availableOptions.length) return []
  const kindCount = new Set(availableOptions.map((option) => option.kind)).size
  const showKindLabel = kindCount > 1
  const options: WeightOption[] = []
  const toPreferred = (value: number) => roundWeight(convertWeight(value, 'lb', preferredUnit))
  const unitLabel = preferredUnit

  availableOptions.forEach((option) => {
    switch (option.kind) {
      case 'dumbbell':
        inventory.dumbbells.forEach((weight) => {
          const converted = toPreferred(weight)
          options.push({
            value: converted,
            unit: preferredUnit,
            label: showKindLabel ? `${converted} ${unitLabel} dumbbell` : `${converted} ${unitLabel}`
          })
        })
        break
      case 'kettlebell':
        inventory.kettlebells.forEach((weight) => {
          const converted = toPreferred(weight)
          options.push({
            value: converted,
            unit: preferredUnit,
            label: showKindLabel ? `${converted} ${unitLabel} kettlebell` : `${converted} ${unitLabel}`
          })
        })
        break
      case 'barbell':
        buildBarbellLoadOptions(inventory).forEach((option) => {
          const converted = toPreferred(option.value)
          options.push({
            value: converted,
            unit: preferredUnit,
            label: showKindLabel ? `${converted} ${unitLabel} barbell` : `${converted} ${unitLabel}`
          })
        })
        break
      case 'band':
        inventory.bands.forEach((band) => {
          const value = bandLoadMap[band] ?? 10
          const converted = toPreferred(value)
          options.push({
            value: converted,
            unit: preferredUnit,
            label: showKindLabel
              ? `${bandLabels[band]} band (~${converted} ${unitLabel})`
              : `${bandLabels[band]} band`
          })
        })
        break
      case 'bodyweight':
        if (typeof profileWeightLb === 'number' && Number.isFinite(profileWeightLb) && profileWeightLb > 0) {
          const converted = toPreferred(profileWeightLb)
          options.push({
            value: converted,
            unit: preferredUnit,
            label: showKindLabel ? `Bodyweight (${converted} ${unitLabel})` : `Bodyweight (${converted} ${unitLabel})`
          })
        }
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
