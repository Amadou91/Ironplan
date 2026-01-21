import type { BandResistance, EquipmentInventory, EquipmentOption, EquipmentPreset, MachineType } from '@/types/domain'

export type WeightOption = {
  value: number
  label: string
}

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
      rower: false
    }
  },
  full_gym: {
    bodyweight: true,
    dumbbells: [10, 15, 20, 25, 30, 35, 40, 50],
    kettlebells: [15, 25, 35, 50],
    bands: ['light', 'medium', 'heavy'],
    barbell: { available: true, plates: [10, 25, 35, 45] },
    machines: {
      cable: true,
      leg_press: true,
      treadmill: true,
      rower: true
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
      rower: false
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

export const parseWeightList = (value: string) =>
  value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item) && item > 0)
    .sort((a, b) => a - b)

export const formatWeightList = (weights: number[]) => [...weights].sort((a, b) => a - b).join(', ')

export const hasEquipment = (inventory: EquipmentInventory) =>
  inventory.bodyweight ||
  inventory.dumbbells.length > 0 ||
  inventory.kettlebells.length > 0 ||
  inventory.bands.length > 0 ||
  inventory.barbell.available ||
  Object.values(inventory.machines).some(Boolean)

export const machineLabels: Record<MachineType, string> = {
  cable: 'Cable Station',
  leg_press: 'Leg Press',
  treadmill: 'Treadmill',
  rower: 'Rower'
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
  profileWeightLb?: number | null
) => {
  const availableOptions = equipmentOptions.filter((option) => isEquipmentOptionAvailable(inventory, option))
  if (!availableOptions.length) return []
  const kindCount = new Set(availableOptions.map((option) => option.kind)).size
  const showKindLabel = kindCount > 1
  const options: WeightOption[] = []

  availableOptions.forEach((option) => {
    switch (option.kind) {
      case 'dumbbell':
        inventory.dumbbells.forEach((weight) => {
          options.push({ value: weight, label: showKindLabel ? `${weight} lb dumbbell` : `${weight} lb` })
        })
        break
      case 'kettlebell':
        inventory.kettlebells.forEach((weight) => {
          options.push({ value: weight, label: showKindLabel ? `${weight} lb kettlebell` : `${weight} lb` })
        })
        break
      case 'barbell':
        options.push(...buildBarbellLoadOptions(inventory))
        break
      case 'band':
        inventory.bands.forEach((band) => {
          const value = bandLoadMap[band] ?? 10
          options.push({
            value,
            label: showKindLabel ? `${bandLabels[band]} band (~${value} lb)` : `${bandLabels[band]} band`
          })
        })
        break
      case 'bodyweight':
        if (typeof profileWeightLb === 'number' && Number.isFinite(profileWeightLb) && profileWeightLb > 0) {
          options.push({
            value: profileWeightLb,
            label: showKindLabel ? `Bodyweight (${profileWeightLb} lb)` : `Bodyweight (${profileWeightLb} lb)`
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
