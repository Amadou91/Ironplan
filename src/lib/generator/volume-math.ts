import type {
  Exercise,
  Goal,
  PlanInput,
  PlannedExercise,
  ExerciseSource,
  EquipmentInventory
} from '@/types/domain'
import {
  clamp,
  selectEquipmentOption,
  buildLoad,
  estimateExerciseMinutes
} from './utils'
import { adaptPrescription } from './adaptation'

export const createPlannedExercise = (
  exercise: Exercise,
  source: ExerciseSource,
  input: PlanInput,
  targetMinutes: number,
  minSetCap: number,
  maxSetCap: number,
  restModifier: number,
  reps: string | number,
  goal: Goal
): PlannedExercise | null => {
  const selectedOption = selectEquipmentOption(input.equipment.inventory, exercise.equipment)
  if (!selectedOption) return null

  const prescription = adaptPrescription(
    exercise,
    goal,
    input.intensity,
    input.experienceLevel,
    { restModifier, repsOverride: reps }
  )

  const isCardio = exercise.focus === 'cardio'
  const minSets = isCardio ? 1 : minSetCap
  const maxSets = isCardio ? Math.max(minSets, Math.min(4, maxSetCap)) : maxSetCap
  
  // Ensure sets are within caps
  prescription.sets = clamp(prescription.sets, minSets, maxSets)

  if (targetMinutes <= 35 && (source === 'accessory' || source === 'secondary')) {
    prescription.sets = Math.max(minSets, prescription.sets - 1)
  }
  if (targetMinutes >= 90 && source === 'primary') {
    prescription.sets = Math.min(maxSets, prescription.sets + 1)
  }

  prescription.load = buildLoad(selectedOption, exercise.loadTarget, input.equipment.inventory)

  const estimatedMinutes = estimateExerciseMinutes(exercise, prescription, selectedOption, goal)
  return {
    exercise,
    source,
    prescription,
    estimatedMinutes,
    minSets,
    maxSets
  }
}

export const adjustSessionVolume = (
  picks: PlannedExercise[],
  targetMinutes: number,
  goal: Goal,
  inventory: EquipmentInventory,
  direction: 'increase' | 'decrease'
) => {
  const recalcTotals = () => picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  let totalMinutes = recalcTotals()

  const adjustEstimate = (planned: PlannedExercise) => {
    const selectedOption = selectEquipmentOption(inventory, planned.exercise.equipment)
    planned.estimatedMinutes = estimateExerciseMinutes(
      planned.exercise,
      planned.prescription,
      selectedOption,
      goal
    )
  }

  const order = direction === 'decrease' 
    ? (['accessory', 'secondary', 'primary'] as ExerciseSource[])
    : (['primary', 'secondary', 'accessory'] as ExerciseSource[])

  let safetyCounter = 0
  const condition = direction === 'decrease' 
    ? () => totalMinutes > targetMinutes 
    : () => totalMinutes < targetMinutes - 6

  while (condition() && safetyCounter < 200) {
    let changed = false
    for (const source of order) {
      const planned = picks.find((item) => 
        item.source === source && 
        (direction === 'decrease' 
          ? item.prescription.sets > item.minSets 
          : item.prescription.sets < item.maxSets)
      )
      if (!planned) continue

      if (direction === 'decrease') {
        planned.prescription.sets -= 1
        adjustEstimate(planned)
        totalMinutes = recalcTotals()
        changed = true
        if (totalMinutes <= targetMinutes) break
      } else {
        // Increase logic
        planned.prescription.sets += 1
        adjustEstimate(planned)
        totalMinutes = recalcTotals()
        if (totalMinutes <= targetMinutes) {
          changed = true
          break
        }
        // Rollback if too much
        planned.prescription.sets -= 1
        adjustEstimate(planned)
        totalMinutes = recalcTotals()
      }
    }
    if (!changed) break
    safetyCounter += 1
  }
  return totalMinutes
}
