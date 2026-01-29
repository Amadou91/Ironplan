/**
 * Load building and weight calculation utilities.
 * Handles weight selection based on equipment and targets.
 */

import type {
  Exercise,
  EquipmentInventory,
  EquipmentOption,
  ExerciseLoad
} from '@/types/domain'
import { bandLoadMap } from './constants'

/**
 * Finds the closest available weight to a target.
 */
export const pickClosestWeight = (weights: number[], target: number): number | undefined => {
  if (weights.length === 0) return undefined
  return weights.reduce(
    (closest, weight) =>
      Math.abs(weight - target) < Math.abs(closest - target) ? weight : closest,
    weights[0]
  )
}

/**
 * Builds a barbell load from available plates.
 */
export const buildBarbellLoad = (
  target: number,
  inventory: EquipmentInventory
): { value: number; label: string } => {
  const base = 45
  if (!inventory.barbell.available) {
    return { value: base, label: `${base} lb barbell (no plates)` }
  }
  if (inventory.barbell.plates.length === 0) {
    return { value: base, label: `${base} lb barbell` }
  }

  const platePairs = inventory.barbell.plates
  const possibleLoads = new Set<number>([base])

  platePairs.forEach((plateWeight) => {
    const currentLoads = Array.from(possibleLoads)
    currentLoads.forEach(load => {
      possibleLoads.add(load + plateWeight * 2)
    })
  })

  const closest = Array.from(possibleLoads).reduce(
    (closestLoad, load) =>
      Math.abs(load - target) < Math.abs(closestLoad - target) ? load : closestLoad,
    base
  )

  return { value: closest, label: `${closest} lb barbell` }
}

/**
 * Builds a complete load specification for an exercise.
 */
export const buildLoad = (
  option: EquipmentOption | undefined,
  target: number | undefined,
  inventory: EquipmentInventory
): ExerciseLoad | undefined => {
  if (!option || !target) return undefined

  const adjustedTarget = option.kind === 'dumbbell' && target > 80 ? Math.round(target / 3) : target

  switch (option.kind) {
    case 'dumbbell': {
      const perHand = pickClosestWeight(inventory.dumbbells, adjustedTarget)
      if (!perHand) return undefined
      return { value: perHand * 2, unit: 'lb', label: `2x${perHand} lb dumbbells` }
    }
    case 'kettlebell': {
      const weight = pickClosestWeight(inventory.kettlebells, target)
      if (!weight) return undefined
      return { value: weight, unit: 'lb', label: `${weight} lb kettlebell` }
    }
    case 'band': {
      const band = inventory.bands.includes('heavy')
        ? 'heavy'
        : inventory.bands.includes('medium')
          ? 'medium'
          : inventory.bands[0]
      const value = bandLoadMap[band] ?? 10
      return { value, unit: 'lb', label: `${band} band` }
    }
    case 'barbell': {
      const barbellLoad = buildBarbellLoad(target, inventory)
      return { value: barbellLoad.value, unit: 'lb', label: barbellLoad.label }
    }
    case 'machine': {
      const stackValue = target
      return { value: stackValue, unit: 'lb', label: `Select ~${stackValue} lb on the stack` }
    }
    default:
      return undefined
  }
}
