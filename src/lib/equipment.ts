import type { BandResistance, EquipmentInventory, EquipmentPreset, MachineType } from '@/types/domain'

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
