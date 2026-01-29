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
  const selectedOption = selectEquipmentOption(input.equipment.inventory, exercise.equipment, exercise.orGroup)
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
    const selectedOption = selectEquipmentOption(inventory, planned.exercise.equipment, planned.exercise.orGroup)
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

  // Reserve time for warm-up before filling with working sets
  const WARMUP_TIME_MINUTES = 10
  const effectiveTargetMinutes = direction === 'decrease' 
    ? targetMinutes 
    : Math.max(0, targetMinutes - WARMUP_TIME_MINUTES)

  // Optimized direct calculation approach instead of iterative loop
  // Calculate how many set adjustments are needed based on average time per set
  const avgTimePerSet = totalMinutes / Math.max(1, picks.reduce((sum, p) => sum + p.prescription.sets, 0))
  
  if (direction === 'decrease' && avgTimePerSet > 0) {
    const excessMinutes = totalMinutes - effectiveTargetMinutes
    const setsToRemove = Math.ceil(excessMinutes / avgTimePerSet)
    let remainingToRemove = setsToRemove
    
    for (const source of order) {
      if (remainingToRemove <= 0) break
      const planned = picks.find((item) => 
        item.source === source && item.prescription.sets > item.minSets
      )
      if (!planned) continue
      
      const removable = planned.prescription.sets - planned.minSets
      const toRemove = Math.min(removable, remainingToRemove)
      planned.prescription.sets -= toRemove
      adjustEstimate(planned)
      remainingToRemove -= toRemove
    }
  } else if (direction === 'increase' && avgTimePerSet > 0) {
    const deficitMinutes = effectiveTargetMinutes - totalMinutes
    const setsToAdd = Math.floor(deficitMinutes / avgTimePerSet)
    let remainingToAdd = Math.max(0, setsToAdd)
    
    for (const source of order) {
      if (remainingToAdd <= 0) break
      const planned = picks.find((item) => 
        item.source === source && item.prescription.sets < item.maxSets
      )
      if (!planned) continue
      
      const addable = planned.maxSets - planned.prescription.sets
      const toAdd = Math.min(addable, remainingToAdd)
      planned.prescription.sets += toAdd
      adjustEstimate(planned)
      remainingToAdd -= toAdd
    }
  }
  
  return recalcTotals()
}
