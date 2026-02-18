import type {
  Exercise,
  Goal,
  PlanInput,
  PlannedExercise,
  ExerciseSource,
  EquipmentInventory,
  WarmupSet
} from '@/types/domain'
import { DEFAULT_REST_SECONDS } from '@/constants/training'
import {
  clamp,
  selectEquipmentOption,
  buildLoad,
  estimateExerciseMinutes
} from '@/lib/generator/utils'
import { adaptPrescription } from '@/lib/generator/adaptation'

/**
 * Generates warm-up sets for a primary exercise.
 * Returns 2 warm-up sets with 50% load and low intensity.
 * These sets are marked type: 'warmup' so they don't skew average intensity stats.
 */
export const generateWarmupSets = (
  workingReps: string | number,
  workingRpe: number
): WarmupSet[] => {
  // Parse the minimum reps from a range like "8-12" or use the number directly
  const baseReps = typeof workingReps === 'string'
    ? parseInt(workingReps.split('-')[0], 10) || 8
    : workingReps || 8
  
  return [
    { setType: 'warmup', loadPercentage: 0.5, reps: Math.min(baseReps, 8), rpe: Math.max(4, workingRpe - 3) },
    { setType: 'warmup', loadPercentage: 0.5, reps: Math.min(baseReps - 2, 6), rpe: Math.max(5, workingRpe - 2) }
  ]
}

/**
 * Superset pairing structure for paired exercises.
 */
export type SupersetPair = {
  exerciseA: PlannedExercise
  exerciseB: PlannedExercise
  groupId: string
  estimatedMinutes: number
}

/**
 * Pairs two exercises into a superset structure.
 * Typically used for push/pull or agonist/antagonist pairings.
 * 
 * Time estimation for supersets:
 * Normal: (SetA + Rest) + (SetB + Rest) = SetA + SetB + 2*Rest
 * Superset: (SetA + SetB + Rest) = SetA + SetB + Rest (saves one rest period)
 * 
 * @param push - The first exercise (typically a push movement)
 * @param pull - The second exercise (typically a pull movement)
 * @param groupId - Unique identifier for this superset pairing
 * @returns SupersetPair with combined time estimation
 */
export const pairExercises = (
  push: PlannedExercise,
  pull: PlannedExercise,
  groupId: string
): SupersetPair => {
  // Calculate superset time: SetA + SetB + shared rest (instead of individual rests)
  const setTimeA = push.estimatedMinutes / Math.max(1, push.prescription.sets)
  const setTimeB = pull.estimatedMinutes / Math.max(1, pull.prescription.sets)
  
  // Estimate rest time (typically ~2 min per exercise, now shared)
  const restMinutesPerSet = 2
  const maxSets = Math.max(push.prescription.sets, pull.prescription.sets)
  
  // Superset saves one rest period per set cycle
  // Old: (setA + rest) + (setB + rest) = total sets * (setTimeA + setTimeB + 2*rest)
  // New: (setA + setB + rest) = total sets * (setTimeA + setTimeB + rest)
  const normalTime = push.estimatedMinutes + pull.estimatedMinutes
  const savedRest = maxSets * restMinutesPerSet
  const supersetTime = Math.max(normalTime - savedRest, (setTimeA + setTimeB + restMinutesPerSet) * maxSets)
  
  return {
    exerciseA: push,
    exerciseB: pull,
    groupId,
    estimatedMinutes: supersetTime
  }
}

/**
 * Estimates combined time for a superset pair.
 * Time = (SetA + SetB + Rest) instead of (SetA + Rest) + (SetB + Rest)
 */
export const estimateSupersetTime = (
  exerciseA: PlannedExercise,
  exerciseB: PlannedExercise,
  restSeconds: number = DEFAULT_REST_SECONDS
): number => {
  const setsA = exerciseA.prescription.sets
  const setsB = exerciseB.prescription.sets
  const maxSets = Math.max(setsA, setsB)
  
  // Time per set (execution only, ~30-45 seconds average)
  const execTimePerSetA = 0.5 // minutes
  const execTimePerSetB = 0.5 // minutes
  const restMinutes = restSeconds / 60
  
  // Superset: (execA + execB + rest) * sets
  return (execTimePerSetA + execTimePerSetB + restMinutes) * maxSets
}

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
  
  // Add warm-up sets for primary exercises (strength/hypertrophy focus)
  // Warm-up sets are marked type: 'warmup' so they don't skew average intensity stats
  if (source === 'primary' && (goal === 'strength' || goal === 'hypertrophy')) {
    prescription.setType = 'working'
    prescription.warmupSets = generateWarmupSets(prescription.reps, prescription.rpe)
  }

  const estimatedMinutes = estimateExerciseMinutes(exercise, prescription, selectedOption, goal)
  
  // Add warm-up time to estimate for primary exercises (~3 min for 2 warmup sets)
  const warmupTimeMinutes = prescription.warmupSets ? prescription.warmupSets.length * 1.5 : 0
  
  return {
    exercise,
    source,
    prescription,
    estimatedMinutes: estimatedMinutes + warmupTimeMinutes,
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
  const totalMinutes = recalcTotals()

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
