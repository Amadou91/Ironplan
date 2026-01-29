import type {
  Exercise,
  FocusArea,
  Goal,
  GoalPriority,
  PlanDay,
  WorkoutImpact,
  MovementPattern,
  EquipmentInventory,
  EquipmentOption,
  PlanInput,
  ExerciseLoad
} from '@/types/domain'
import { computeExerciseMetrics } from '@/lib/workout-metrics'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import type { ExercisePrescription, FocusConstraint } from './types'
import { focusMuscleMap, focusAccessoryMap, bandLoadMap } from './constants'

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export const normalizeExerciseKey = (name: string) => name.trim().toLowerCase()

export const hashSeed = (seed: string) => {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const createSeededRandom = (seed: string) => {
  let state = hashSeed(seed)
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const getPrimaryMuscleKey = (exercise: Exercise) =>
  String(exercise.primaryMuscle ?? '').trim().toLowerCase()

/**
 * Determines the movement "family" for variety scoring.
 * Prevents the generator from picking too many similar movements (e.g., multiple "press" exercises)
 * in a single session or consecutively.
 * 
 * Uses 'movementPattern' from the catalog as a fallback, but applies string-based 
 * heuristics for more granular categorization.
 */
export const getMovementFamilyFromName = (name: string, movementPattern?: MovementPattern | null) => {
  const lower = name.toLowerCase()
  if (lower.includes('press') || lower.includes('push-up') || lower.includes('pushup')) return 'press'
  if (lower.includes('fly') || lower.includes('pec deck')) return 'fly'
  if (lower.includes('dip')) return 'dip'
  if (lower.includes('row')) return 'row'
  if (lower.includes('pull')) return 'pull'
  if (lower.includes('curl')) return 'curl'
  if (lower.includes('extension')) return 'extension'
  if (lower.includes('raise') || lower.includes('lateral')) return 'raise'
  if (lower.includes('squat')) return 'squat'
  if (lower.includes('deadlift') || lower.includes('rdl') || lower.includes('hinge')) return 'hinge'
  if (lower.includes('lunge') || lower.includes('split squat')) return 'lunge'
  if (lower.includes('carry')) return 'carry'
  if (lower.includes('plank') || lower.includes('core')) return 'core'
  if (lower.includes('run') || lower.includes('bike') || lower.includes('rower') || lower.includes('interval')) {
    return 'cardio'
  }
  return movementPattern ?? 'other'
}

export const getMovementFamily = (exercise: Exercise) =>
  getMovementFamilyFromName(exercise.name, exercise.movementPattern)

/**
 * Identifies compound movements for intensity-based scoring.
 * Based on the 'movementPattern' field in the exercise catalog.
 */
export const isCompoundMovement = (exercise: Exercise) =>
  ['squat', 'hinge', 'push', 'pull', 'carry'].includes(exercise.movementPattern ?? '')

export const formatFocusLabel = (focus: FocusArea) => {
  const map: Record<string, string> = {
    upper: 'Upper Body',
    lower: 'Lower Body',
    full_body: 'Full Body',
    core: 'Core',
    cardio: 'Conditioning',
    mobility: 'Yoga / Mobility',
    arms: 'Arms',
    legs: 'Legs',
    biceps: 'Biceps',
    triceps: 'Triceps',
    chest: 'Chest',
    back: 'Back'
  }
  return map[focus] ?? focus.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const formatGoalLabel = (goal: Goal | string) => {
const map: Record<string, string> = {
  range_of_motion: 'Mobility & Flexibility',
  hypertrophy: 'Muscle Growth',
  strength: 'Strength',
  endurance: 'Endurance',
  cardio: 'Conditioning'
}
  return map[goal] ?? goal.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getPrimaryMuscleLabel = (exercise: Exercise) => {
  if (exercise.primaryBodyParts?.length) return exercise.primaryBodyParts[0]
  if (typeof exercise.primaryMuscle === 'string') return exercise.primaryMuscle
  return ''
}

export const matchesPrimaryMuscle = (exercise: Exercise, muscles: string[]) => {
  const primary = getPrimaryMuscleLabel(exercise).toLowerCase()
  return muscles.some((muscle) => primary.includes(muscle.toLowerCase()))
}

/**
 * Core filtering logic for body-part focused sessions.
 * - 'full_body' sessions include all exercises.
 * - Targeted sessions (e.g., 'chest') check against the exercise's primary muscle mapping.
 * - 'cardio' focus strictly uses the 'focus' field from the catalog.
 */
export const matchesFocusArea = (focus: FocusArea, exercise: Exercise) => {
  if (focus === 'full_body') return true
  if (focus === 'cardio') return exercise.focus === 'cardio'
  const focusConfig = focusMuscleMap[focus]
  if (focusConfig?.primaryMuscles?.length) {
    const matchesMuscle = matchesPrimaryMuscle(exercise, focusConfig.primaryMuscles)
    const matchesBase = focusConfig.baseFocus ? exercise.focus === focusConfig.baseFocus : true
    return matchesMuscle && matchesBase
  }
  return exercise.focus === focus
}

export const getFocusConstraint = (focus: FocusArea): FocusConstraint | null => {
  const focusConfig = focusMuscleMap[focus]
  if (!focusConfig?.primaryMuscles?.length) return null
  return {
    focus,
    primaryMuscles: focusConfig.primaryMuscles,
    accessoryMuscles: focusAccessoryMap[focus] ?? [],
    minPrimarySetRatio: 0.75
  }
}

export const hasMachine = (inventory: EquipmentInventory, machineType?: keyof EquipmentInventory['machines']) =>
  machineType ? inventory.machines[machineType] : Object.values(inventory.machines).some(Boolean)

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

export const isEquipmentOptionAvailable = (inventory: EquipmentInventory, option: Exercise['equipment'][number]) => {
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
      return hasMachine(inventory, option.machineType)
    default:
      return false
  }
}

export const selectEquipmentOption = (inventory: EquipmentInventory, options: Exercise['equipment']) =>
  options?.find(option => isEquipmentOptionAvailable(inventory, option))

export const pickClosestWeight = (weights: number[], target: number) => {
  if (weights.length === 0) return undefined
  return weights.reduce((closest, weight) =>
    Math.abs(weight - target) < Math.abs(closest - target) ? weight : closest
  , weights[0])
}

export const buildBarbellLoad = (target: number, inventory: EquipmentInventory) => {
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

  const closest = Array.from(possibleLoads).reduce((closestLoad, load) =>
    Math.abs(load - target) < Math.abs(closestLoad - target) ? load : closestLoad
  , base)

  return { value: closest, label: `${closest} lb barbell` }
}

export const buildLoad = (
  option: Exercise['equipment'][number] | undefined,
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

export const getSetupMinutes = (option?: EquipmentOption | null) => {
  switch (option?.kind) {
    case 'bodyweight':
      return 1
    case 'bench_press':
    case 'dumbbell':
    case 'kettlebell':
    case 'band':
      return 2
    case 'barbell':
    case 'machine':
      return 3
    default:
      return 2
  }
}

export const getWorkSeconds = (goal: Goal, exercise: Exercise) => {
  if (exercise.focus === 'cardio' || exercise.movementPattern === 'cardio') return 60
  if (goal === 'strength') return 50
  if (goal === 'endurance' || goal === 'cardio') return 60
  return 45
}

export const estimateExerciseMinutes = (
  exercise: Exercise,
  prescription: ExercisePrescription,
  option?: EquipmentOption | null,
  goal?: Goal
) => {
  const setupMinutes = getSetupMinutes(option)
  const workSeconds = getWorkSeconds(goal ?? 'general_fitness', exercise)
  // Robustly handle undefined restSeconds by defaulting to 90s (typical rest)
  const restSeconds = prescription.restSeconds ?? 90
  const workMinutes = (prescription.sets * (workSeconds + restSeconds)) / 60
  const fallbackPerSet = exercise.durationMinutes
    ? exercise.durationMinutes / Math.max(exercise.sets, 1)
    : null
  const fallbackMinutes = fallbackPerSet ? setupMinutes + prescription.sets * fallbackPerSet : 0
  const estimated = setupMinutes + workMinutes
  return Math.max(1, Math.round(Math.max(estimated, fallbackMinutes) * 10) / 10)
}

export const buildSessionName = (focus: FocusArea, exercises: Exercise[], goal: Goal) => {
  const goalLabel = formatGoalLabel(goal)
  const focusLabel = formatFocusLabel(focus)
  const movementCounts = exercises.reduce<Record<string, number>>((acc, exercise) => {
    if (exercise.movementPattern) {
      acc[exercise.movementPattern] = (acc[exercise.movementPattern] ?? 0) + 1
    }
    return acc
  }, {})

  // Special cases for distinct naming
  if (focus === 'mobility' || goal === 'range_of_motion') {
    return 'Yoga / Mobility Flow'
  }

  if (focus === 'cardio' || goal === 'endurance' || goal === 'cardio') {
    return 'Conditioning Circuit'
  }

  if (focus === 'upper') {
    const pushCount = movementCounts.push ?? 0
    const pullCount = movementCounts.pull ?? 0
    if (pushCount > pullCount) return 'Upper Body - Push Focus'
    if (pullCount > pushCount) return 'Upper Body - Pull Focus'
    return `Upper Body - ${goalLabel}`
  }

  if (focus === 'lower') {
    const squatCount = movementCounts.squat ?? 0
    const hingeCount = movementCounts.hinge ?? 0
    if (squatCount > hingeCount) return 'Lower Body - Squat Focus'
    if (hingeCount > squatCount) return 'Lower Body - Hinge Focus'
    return `Lower Body - ${goalLabel}`
  }

  if (focus === 'full_body') {
    return `Full Body - ${goalLabel}`
  }

  if (focus === 'core') {
    return 'Core - Stability Focus'
  }

  // Prevent redundant labels like "Chest Chest"
  if (focusLabel.toLowerCase().includes(goalLabel.toLowerCase())) {
    return focusLabel
  }

  return `${focusLabel} - ${goalLabel}`
}

export const buildPlanTitle = (focus: FocusArea, goal: Goal, intensity?: PlanInput['intensity'], minutes?: number) =>
  buildWorkoutDisplayName({
    focus,
    style: goal,
    intensity,
    minutes,
    fallback: formatFocusLabel(focus)
  })

export const buildFocusDistribution = (schedule: PlanDay[]) => schedule.reduce<Record<FocusArea, number>>((acc, day) => {
  acc[day.focus] = (acc[day.focus] ?? 0) + 1
  return acc
}, {
  upper: 0,
  lower: 0,
  full_body: 0,
  core: 0,
  cardio: 0,
  mobility: 0,
  arms: 0,
  legs: 0,
  biceps: 0,
  triceps: 0,
  chest: 0,
  back: 0,
  shoulders: 0
})

export const calculateExerciseImpact = (exercises: Exercise[]): WorkoutImpact => {
  let totalWorkload = 0
  let totalVolume = 0
  let totalDuration = 0
  let totalIntensity = 0

  exercises.forEach((exercise) => {
    const metrics = computeExerciseMetrics(exercise)
    totalWorkload += metrics.workload
    totalVolume += metrics.volume ?? 0
    totalIntensity += metrics.intensity ?? 0
    
    // Estimate duration for density calc
    const estimatedMinutes = estimateExerciseMinutes(
      exercise, 
      {
        sets: exercise.sets,
        reps: exercise.reps, // Reps string, not used in estimate directly but type compatibility
        rpe: exercise.rpe,
        restSeconds: exercise.restSeconds,
        load: exercise.load // might be undefined, fine
      },
      undefined, // equipment option
      undefined
    )
    totalDuration += estimatedMinutes
  })

  // Normalized scoring matching `workout-metrics.ts`
  // Score = Workload / 10
  const score = Math.round(totalWorkload / 10)
  
  // Calculate average intensity (RPE)
  const avgIntensity = exercises.length > 0 ? totalIntensity / exercises.length : 0
  
  // Calculate overall density (Volume KG / Minutes)
  const density = totalDuration > 0 ? totalVolume / totalDuration : 0

  return {
    score,
    breakdown: {
      volume: Math.round(totalVolume),
      intensity: Math.round(avgIntensity * 10), // Scale 0-100
      density: Math.round(density)
    }
  }
}

export const calculateWorkoutImpact = (schedule: PlanDay[]): WorkoutImpact =>
  calculateExerciseImpact(schedule.flatMap(day => day.exercises))

export const goalToFocus = (goal: Goal): FocusArea[] => {
  switch (goal) {
    case 'endurance':
    case 'cardio':
      return ['cardio', 'full_body', 'mobility']
    case 'hypertrophy':
      return ['upper', 'lower', 'full_body']
    case 'general_fitness':
      return ['full_body', 'cardio', 'mobility']
    default:
      return ['upper', 'lower', 'core']
  }
}

export const mergeFocusByPriority = (primary: FocusArea[], secondary: FocusArea[] | undefined, priority: GoalPriority) => {
  if (!secondary || priority === 'primary') {
    return primary
  }

  if (priority === 'secondary') {
    return [...secondary, ...secondary, ...primary]
  }

  return primary.flatMap((focus, index) => [focus, secondary[index % secondary.length]])
}

export const buildFocusSequence = (
  sessions: number,
  preferences: PlanInput['preferences'],
  goals: PlanInput['goals']
): FocusArea[] => {
  const preferencePool = preferences.focusAreas.length > 0 ? preferences.focusAreas : undefined
  const primaryPool = preferencePool ?? goalToFocus(goals.primary)
  const secondaryPool = goals.secondary ? goalToFocus(goals.secondary) : undefined
  const focusPool = preferencePool ?? mergeFocusByPriority(primaryPool, secondaryPool, goals.priority)

  const sequence: FocusArea[] = []
  for (let i = 0; i < sessions; i += 1) {
    sequence.push(focusPool[i % focusPool.length])
  }
  return sequence
}

export const buildRationale = (
  focus: FocusArea,
  duration: number,
  restPreference: PlanInput['preferences']['restPreference'],
  style: Goal
) => {
  const recoveryNote = restPreference === 'high_recovery'
    ? 'Extra recovery was prioritized between sessions.'
    : restPreference === 'minimal_rest'
      ? 'Sessions are designed for minimal rest between workouts.'
      : 'Recovery is balanced across the rotation.'
  const goalLabel = formatGoalLabel(style)
  const focusLabel = formatFocusLabel(focus)
  
  return `${duration} minute ${goalLabel} session focused on ${focusLabel}. ${recoveryNote}`
}
