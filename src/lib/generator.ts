import type {
  CardioActivity,
  EquipmentInventory,
  EquipmentOption,
  Exercise,
  ExerciseLoad,
  FocusArea,
  GeneratedPlan,
  Goal,
  GoalPriority,
  Intensity,
  PlanDay,
  PlanInput,
  RestPreference,
  WorkoutImpact
} from '@/types/domain'
import { equipmentPresets, hasEquipment } from './equipment'
import { computeExerciseMetrics } from '@/lib/workout-metrics'
import { matchesCardioSelection } from '@/lib/cardio-activities'

const DEFAULT_INPUT: PlanInput = {
  intent: {
    mode: 'body_part',
    style: 'strength',
    bodyParts: ['chest']
  },
  goals: {
    primary: 'strength',
    priority: 'primary'
  },
  experienceLevel: 'intermediate',
  intensity: 'moderate',
  equipment: {
    preset: 'full_gym',
    inventory: equipmentPresets.full_gym
  },
  time: {
    minutesPerSession: 45
  },
  schedule: {
    daysAvailable: [0],
    minRestDays: 1,
    weeklyLayout: [
      { sessionIndex: 0, style: 'strength', focus: 'chest' }
    ]
  },
  preferences: {
    focusAreas: ['chest'],
    dislikedActivities: [],
    cardioActivities: [],
    accessibilityConstraints: [],
    restPreference: 'balanced'
  }
}

type ExerciseTemplate = Omit<Exercise, 'load'> & {
  loadTarget?: number
}

export const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  {
    name: 'Barbell Back Squat',
    focus: 'lower',
    movementPattern: 'squat',
    difficulty: 'intermediate',
    goal: 'strength',
    primaryMuscle: 'Quads',
    sets: 4,
    reps: '5-8',
    rpe: 8,
    equipment: [{ kind: 'barbell' }],
    durationMinutes: 12,
    loadTarget: 135,
    restSeconds: 120
  },
  {
    name: 'Dumbbell Goblet Squat',
    focus: 'lower',
    movementPattern: 'squat',
    difficulty: 'beginner',
    goal: 'hypertrophy',
    primaryMuscle: 'Quads',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }],
    durationMinutes: 10,
    loadTarget: 30,
    restSeconds: 90
  },
  {
    name: 'Romanian Deadlift',
    focus: 'lower',
    movementPattern: 'hinge',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Hamstrings',
    sets: 3,
    reps: '8-10',
    rpe: 8,
    equipment: [{ kind: 'barbell' }, { kind: 'dumbbell' }],
    durationMinutes: 10,
    loadTarget: 115,
    restSeconds: 120
  },
  {
    name: 'Push-Up',
    focus: 'upper',
    movementPattern: 'push',
    difficulty: 'beginner',
    goal: 'hypertrophy',
    primaryMuscle: 'Chest',
    sets: 3,
    reps: '10-15',
    rpe: 7,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 8,
    restSeconds: 75
  },
  {
    name: 'Bench Press',
    focus: 'upper',
    movementPattern: 'push',
    difficulty: 'intermediate',
    goal: 'strength',
    primaryMuscle: 'Chest',
    sets: 4,
    reps: '5-8',
    rpe: 8,
    equipment: [{ kind: 'barbell' }],
    durationMinutes: 12,
    loadTarget: 115,
    restSeconds: 120
  },
  {
    name: 'Dumbbell Row',
    focus: 'upper',
    movementPattern: 'pull',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Back',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }],
    durationMinutes: 10,
    loadTarget: 25,
    restSeconds: 90
  },
  {
    name: 'Overhead Press',
    focus: 'upper',
    movementPattern: 'push',
    difficulty: 'intermediate',
    goal: 'strength',
    primaryMuscle: 'Shoulders',
    sets: 3,
    reps: '6-10',
    rpe: 8,
    equipment: [{ kind: 'barbell' }, { kind: 'dumbbell' }],
    durationMinutes: 10,
    loadTarget: 75,
    restSeconds: 120
  },
  {
    name: 'Walking Lunge',
    focus: 'lower',
    movementPattern: 'squat',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Quads',
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }, { kind: 'bodyweight' }],
    durationMinutes: 9,
    loadTarget: 20,
    restSeconds: 75
  },
  {
    name: 'Dumbbell Biceps Curl',
    focus: 'upper',
    movementPattern: 'pull',
    difficulty: 'beginner',
    goal: 'hypertrophy',
    primaryMuscle: 'Biceps',
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }, { kind: 'band' }],
    durationMinutes: 8,
    loadTarget: 20,
    restSeconds: 60
  },
  {
    name: 'Hammer Curl',
    focus: 'upper',
    movementPattern: 'pull',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Biceps',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }, { kind: 'kettlebell' }],
    durationMinutes: 8,
    loadTarget: 25,
    restSeconds: 75
  },
  {
    name: 'Overhead Triceps Extension',
    focus: 'upper',
    movementPattern: 'push',
    difficulty: 'beginner',
    goal: 'hypertrophy',
    primaryMuscle: 'Triceps',
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }, { kind: 'band' }],
    durationMinutes: 8,
    loadTarget: 20,
    restSeconds: 60
  },
  {
    name: 'Triceps Rope Pushdown',
    focus: 'upper',
    movementPattern: 'push',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Triceps',
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: [{ kind: 'machine', machineType: 'cable' }],
    durationMinutes: 8,
    loadTarget: 40,
    restSeconds: 60
  },
  {
    name: 'Plank Series',
    focus: 'core',
    movementPattern: 'core',
    difficulty: 'beginner',
    goal: 'endurance',
    primaryMuscle: 'Core',
    sets: 3,
    reps: '30-45 sec',
    rpe: 7,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 6,
    restSeconds: 60
  },
  {
    name: 'Dead Bug',
    focus: 'core',
    movementPattern: 'core',
    difficulty: 'beginner',
    goal: 'endurance',
    primaryMuscle: 'Core',
    sets: 3,
    reps: '8-12',
    rpe: 6,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 6,
    restSeconds: 60
  },
  {
    name: 'Incline Dumbbell Press',
    focus: 'upper',
    movementPattern: 'push',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Chest',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }],
    durationMinutes: 9,
    loadTarget: 25,
    restSeconds: 90
  },
  {
    name: 'Lat Pulldown',
    focus: 'upper',
    movementPattern: 'pull',
    difficulty: 'beginner',
    goal: 'hypertrophy',
    primaryMuscle: 'Back',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: [{ kind: 'machine', machineType: 'cable' }],
    durationMinutes: 9,
    loadTarget: 70,
    restSeconds: 90
  },
  {
    name: 'Assault Bike Intervals',
    focus: 'cardio',
    movementPattern: 'cardio',
    difficulty: 'intermediate',
    goal: 'endurance',
    primaryMuscle: 'Cardio',
    sets: 6,
    reps: '30 sec on/30 sec off',
    rpe: 8,
    equipment: [{ kind: 'machine', machineType: 'treadmill' }, { kind: 'machine', machineType: 'rower' }],
    durationMinutes: 10,
    restSeconds: 60
  },
  {
    name: 'Skipping Intervals',
    focus: 'cardio',
    movementPattern: 'cardio',
    difficulty: 'beginner',
    goal: 'cardio',
    primaryMuscle: 'Cardio',
    sets: 6,
    reps: '45 sec on/15 sec off',
    rpe: 7,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 10,
    restSeconds: 45
  },
  {
    name: 'Indoor Cycling Tempo Ride',
    focus: 'cardio',
    movementPattern: 'cardio',
    difficulty: 'beginner',
    goal: 'cardio',
    primaryMuscle: 'Cardio',
    sets: 1,
    reps: '20-30 min',
    rpe: 6,
    equipment: [{ kind: 'machine' }],
    durationMinutes: 20,
    restSeconds: 60
  },
  {
    name: 'Outdoor Cycling Endurance Ride',
    focus: 'cardio',
    movementPattern: 'cardio',
    difficulty: 'intermediate',
    goal: 'cardio',
    primaryMuscle: 'Cardio',
    sets: 1,
    reps: '30-45 min',
    rpe: 6,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 30,
    restSeconds: 60
  },
  {
    name: 'Zone 2 Cardio',
    focus: 'cardio',
    movementPattern: 'cardio',
    difficulty: 'beginner',
    goal: 'endurance',
    primaryMuscle: 'Cardio',
    sets: 1,
    reps: '20-30 min',
    rpe: 6,
    equipment: [{ kind: 'machine', machineType: 'treadmill' }, { kind: 'bodyweight' }],
    durationMinutes: 20,
    restSeconds: 60
  },
  {
    name: 'Mobility Flow',
    focus: 'mobility',
    movementPattern: 'core',
    difficulty: 'beginner',
    goal: 'general_fitness',
    primaryMuscle: 'Full Body',
    sets: 1,
    reps: '15-20 min',
    rpe: 5,
    equipment: [{ kind: 'bodyweight' }],
    durationMinutes: 15,
    restSeconds: 45
  },
  {
    name: 'Kettlebell Swing',
    focus: 'cardio',
    movementPattern: 'hinge',
    difficulty: 'intermediate',
    goal: 'endurance',
    primaryMuscle: 'Glutes',
    sets: 4,
    reps: '12-15',
    rpe: 8,
    equipment: [{ kind: 'kettlebell' }],
    durationMinutes: 8,
    loadTarget: 35,
    restSeconds: 75
  },
  {
    name: 'Resistance Band Pull-Apart',
    focus: 'upper',
    movementPattern: 'pull',
    difficulty: 'beginner',
    goal: 'hypertrophy',
    primaryMuscle: 'Shoulders',
    sets: 3,
    reps: '12-15',
    rpe: 6,
    equipment: [{ kind: 'band' }],
    durationMinutes: 6,
    loadTarget: 20,
    restSeconds: 60
  },
  {
    name: 'Leg Press',
    focus: 'lower',
    movementPattern: 'squat',
    difficulty: 'intermediate',
    goal: 'hypertrophy',
    primaryMuscle: 'Quads',
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: [{ kind: 'machine', machineType: 'leg_press' }],
    durationMinutes: 10,
    loadTarget: 160,
    restSeconds: 90
  }
]

export const validatePlanInput = (input: PlanInput): string[] => {
  const errors: string[] = []

  if (input.time.minutesPerSession < 20 || input.time.minutesPerSession > 120) {
    errors.push('Minutes per session must be between 20 and 120.')
  }

  if (input.time.totalMinutesPerWeek !== undefined && input.time.totalMinutesPerWeek < 40) {
    errors.push('Total weekly minutes must be at least 40 when provided.')
  }

  if (input.intent.mode === 'style' && !input.intent.style) {
    errors.push('Select a workout style.')
  }

  if (input.intent.mode === 'body_part' && (!input.intent.bodyParts || input.intent.bodyParts.length === 0)) {
    errors.push('Select at least one body focus area.')
  }

  if (input.schedule.minRestDays < 0 || input.schedule.minRestDays > 2) {
    errors.push('Minimum rest days must be between 0 and 2.')
  }

  if (!hasEquipment(input.equipment.inventory)) {
    errors.push('Select at least one equipment option.')
  }

  return errors
}

export const normalizePlanInput = (input: Partial<PlanInput>): PlanInput => ({
  ...DEFAULT_INPUT,
  ...input,
  intent: {
    ...DEFAULT_INPUT.intent,
    ...input.intent
  },
  goals: {
    ...DEFAULT_INPUT.goals,
    ...input.goals
  },
  equipment: {
    ...DEFAULT_INPUT.equipment,
    ...input.equipment,
    inventory: {
      ...DEFAULT_INPUT.equipment.inventory,
      ...input.equipment?.inventory,
      barbell: {
        ...DEFAULT_INPUT.equipment.inventory.barbell,
        ...input.equipment?.inventory?.barbell
      },
      machines: {
        ...DEFAULT_INPUT.equipment.inventory.machines,
        ...input.equipment?.inventory?.machines
      }
    }
  },
  time: {
    ...DEFAULT_INPUT.time,
    ...input.time
  },
  schedule: {
    ...DEFAULT_INPUT.schedule,
    ...input.schedule
  },
  preferences: {
    ...DEFAULT_INPUT.preferences,
    ...input.preferences
  }
})

const applyRestPreference = (input: PlanInput): PlanInput => {
  if (input.preferences.restPreference === 'high_recovery') {
    return {
      ...input,
      schedule: { ...input.schedule, minRestDays: Math.max(input.schedule.minRestDays, 1) }
    }
  }
  if (input.preferences.restPreference === 'minimal_rest') {
    return {
      ...input,
      schedule: { ...input.schedule, minRestDays: 0 }
    }
  }
  return input
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const adjustMinutesPerSession = (input: PlanInput, sessionsPerWeek: number) => {
  if (!input.time.totalMinutesPerWeek) {
    return input.time.minutesPerSession
  }
  const perSession = Math.floor(input.time.totalMinutesPerWeek / sessionsPerWeek)
  return clamp(perSession, 20, 120)
}

const goalToFocus = (goal: Goal): FocusArea[] => {
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

const mergeFocusByPriority = (primary: FocusArea[], secondary: FocusArea[] | undefined, priority: GoalPriority) => {
  if (!secondary || priority === 'primary') {
    return primary
  }

  if (priority === 'secondary') {
    return [...secondary, ...secondary, ...primary]
  }

  return primary.flatMap((focus, index) => [focus, secondary[index % secondary.length]])
}

const buildFocusSequence = (
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

const focusMuscleMap: Record<
  FocusArea,
  { primaryMuscles?: string[]; baseFocus?: FocusArea }
> = {
  arms: {
    primaryMuscles: ['Biceps', 'Triceps', 'Forearms', 'Shoulders'],
    baseFocus: 'upper'
  },
  legs: {
    primaryMuscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors', 'Hip Flexors'],
    baseFocus: 'lower'
  },
  biceps: { primaryMuscles: ['Biceps'], baseFocus: 'upper' },
  triceps: { primaryMuscles: ['Triceps'], baseFocus: 'upper' },
  chest: { primaryMuscles: ['Chest'], baseFocus: 'upper' },
  back: { primaryMuscles: ['Back'], baseFocus: 'upper' },
  upper: {},
  lower: {},
  full_body: {},
  core: {},
  cardio: {},
  mobility: {}
}

const bandLoadMap = {
  light: 10,
  medium: 20,
  heavy: 30
}

const hasMachine = (inventory: EquipmentInventory, machineType?: keyof EquipmentInventory['machines']) =>
  machineType ? inventory.machines[machineType] : Object.values(inventory.machines).some(Boolean)

const isEquipmentOptionAvailable = (inventory: EquipmentInventory, option: Exercise['equipment'][number]) => {
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
      return hasMachine(inventory, option.machineType)
    default:
      return false
  }
}

const selectEquipmentOption = (inventory: EquipmentInventory, options: Exercise['equipment']) =>
  options.find(option => isEquipmentOptionAvailable(inventory, option))

const pickClosestWeight = (weights: number[], target: number) => {
  if (weights.length === 0) return undefined
  return weights.reduce((closest, weight) =>
    Math.abs(weight - target) < Math.abs(closest - target) ? weight : closest
  , weights[0])
}

const buildBarbellLoad = (target: number, inventory: EquipmentInventory) => {
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

const buildLoad = (
  option: Exercise['equipment'][number] | undefined,
  target: number | undefined,
  inventory: EquipmentInventory
) => {
  if (!option || !target) return undefined

  const adjustedTarget = option.kind === 'dumbbell' && target > 80 ? Math.round(target / 3) : target

  switch (option.kind) {
    case 'dumbbell': {
      const perHand = pickClosestWeight(inventory.dumbbells, adjustedTarget)
      if (!perHand) return undefined
      return { value: perHand * 2, unit: 'lb' as const, label: `2x${perHand} lb dumbbells` }
    }
    case 'kettlebell': {
      const weight = pickClosestWeight(inventory.kettlebells, target)
      if (!weight) return undefined
      return { value: weight, unit: 'lb' as const, label: `${weight} lb kettlebell` }
    }
    case 'band': {
      const band = inventory.bands.includes('heavy')
        ? 'heavy'
        : inventory.bands.includes('medium')
          ? 'medium'
          : inventory.bands[0]
      const value = bandLoadMap[band] ?? 10
      return { value, unit: 'lb' as const, label: `${band} band` }
    }
    case 'barbell': {
      const barbellLoad = buildBarbellLoad(target, inventory)
      return { value: barbellLoad.value, unit: 'lb' as const, label: barbellLoad.label }
    }
    case 'machine': {
      const stackValue = target
      return { value: stackValue, unit: 'lb' as const, label: `Select ~${stackValue} lb on the stack` }
    }
    default:
      return undefined
  }
}

const matchesFocusArea = (focus: FocusArea, exercise: Exercise) => {
  if (focus === 'full_body') return true
  if (focus === 'cardio') return exercise.focus === 'cardio'
  const focusConfig = focusMuscleMap[focus]
  if (focusConfig?.primaryMuscles?.length) {
    const primaryMuscle = typeof exercise.primaryMuscle === 'string' ? exercise.primaryMuscle : ''
    const matchesMuscle = focusConfig.primaryMuscles.some((muscle) =>
      primaryMuscle.toLowerCase().includes(muscle.toLowerCase())
    )
    const matchesBase = focusConfig.baseFocus ? exercise.focus === focusConfig.baseFocus : true
    return matchesMuscle && matchesBase
  }
  return exercise.focus === focus
}

const filterExercises = (
  focus: FocusArea,
  inventory: EquipmentInventory,
  disliked: string[],
  accessibility: string[],
  cardioActivities: CardioActivity[],
  goal?: Goal
) => EXERCISE_LIBRARY.filter(exercise => {
  const matchesFocus = matchesFocusArea(focus, exercise)
  const option = selectEquipmentOption(inventory, exercise.equipment)
  const isDisliked = disliked.some(activity => exercise.name.toLowerCase().includes(activity.toLowerCase()))
  const lowImpact = accessibility.includes('low-impact')
  const isHighImpact = exercise.name.toLowerCase().includes('jump') || exercise.name.toLowerCase().includes('interval')
  const matchesGoal = goal
    ? exercise.goal === goal || !exercise.goal || (goal === 'cardio' && exercise.goal === 'endurance')
    : true
  const matchesCardio = exercise.focus === 'cardio' ? matchesCardioSelection(exercise.name, cardioActivities) : true
  return matchesFocus && matchesGoal && matchesCardio && Boolean(option) && !isDisliked && !(lowImpact && isHighImpact)
})

const adjustRpe = (baseRpe: number, intensity: Intensity) => {
  if (intensity === 'low') return clamp(baseRpe - 1, 5, 9)
  if (intensity === 'high') return clamp(baseRpe + 1, 5, 9)
  return baseRpe
}

const adjustSets = (baseSets: number, experience: PlanInput['experienceLevel']) => {
  if (experience === 'beginner') return clamp(baseSets - 1, 2, 5)
  if (experience === 'advanced') return clamp(baseSets + 1, 3, 6)
  return baseSets
}

const deriveReps = (goal: Goal, intensity: Intensity) => {
  if (goal === 'strength') return intensity === 'high' ? '3-6' : '4-6'
  if (goal === 'endurance') return intensity === 'high' ? '15-20' : '12-15'
  return intensity === 'high' ? '8-10' : '8-12'
}

type ExerciseSource = 'primary' | 'secondary' | 'accessory'

type ExercisePrescription = {
  sets: number
  reps: string | number
  rpe: number
  restSeconds: number
  load?: ExerciseLoad
}

type PlannedExercise = {
  exercise: Exercise
  source: ExerciseSource
  prescription: ExercisePrescription
  estimatedMinutes: number
  minSets: number
  maxSets: number
}

const getExerciseCaps = (minutes: number) => {
  if (minutes <= 30) return { min: 3, max: 5 }
  if (minutes <= 45) return { min: 4, max: 6 }
  if (minutes <= 60) return { min: 5, max: 8 }
  if (minutes <= 90) return { min: 6, max: 9 }
  return { min: 6, max: 10 }
}

const getSetCaps = (minutes: number) => {
  if (minutes <= 30) return { min: 2, max: 4 }
  if (minutes <= 60) return { min: 2, max: 5 }
  return { min: 2, max: 6 }
}

const getRestModifier = (minutes: number, preference: RestPreference) => {
  let modifier = minutes <= 30 ? 0.8 : minutes <= 45 ? 0.9 : minutes >= 90 ? 1.1 : 1
  if (preference === 'minimal_rest') modifier -= 0.1
  if (preference === 'high_recovery') modifier += 0.1
  return clamp(modifier, 0.7, 1.3)
}

const getSetupMinutes = (option?: EquipmentOption | null) => {
  switch (option?.kind) {
    case 'bodyweight':
      return 1
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

const getWorkSeconds = (goal: Goal, exercise: Exercise) => {
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
  const workSeconds = getWorkSeconds(goal ?? exercise.goal ?? 'general_fitness', exercise)
  const workMinutes = (prescription.sets * (workSeconds + prescription.restSeconds)) / 60
  const fallbackPerSet = exercise.durationMinutes
    ? exercise.durationMinutes / Math.max(exercise.sets, 1)
    : null
  const fallbackMinutes = fallbackPerSet ? setupMinutes + prescription.sets * fallbackPerSet : 0
  const estimated = setupMinutes + workMinutes
  return Math.max(1, Math.round(Math.max(estimated, fallbackMinutes) * 10) / 10)
}

const buildSessionForTime = (
  primaryPool: Exercise[],
  secondaryPool: Exercise[],
  accessoryPool: Exercise[],
  input: PlanInput,
  duration: number,
  goal: Goal
) => {
  const targetMinutes = clamp(duration, 20, 120)
  const reps = deriveReps(goal, input.intensity)
  const { min: minExercises, max: maxExercises } = getExerciseCaps(targetMinutes)
  const { min: minSetCap, max: maxSetCap } = getSetCaps(targetMinutes)
  const restModifier = getRestModifier(targetMinutes, input.preferences.restPreference)
  const picks: PlannedExercise[] = []
  const usedPatterns = new Map<string, number>()
  const usedNames = new Set<string>()

  const createPlan = (exercise: Exercise, source: ExerciseSource): PlannedExercise | null => {
    const selectedOption = selectEquipmentOption(input.equipment.inventory, exercise.equipment)
    if (!selectedOption) return null
    const baseSets = adjustSets(exercise.sets, input.experienceLevel)
    const isCardio = exercise.focus === 'cardio'
    const minSets = isCardio ? 1 : minSetCap
    const maxSets = isCardio ? Math.max(minSets, Math.min(4, maxSetCap)) : maxSetCap
    let sets = clamp(baseSets, minSets, maxSets)
    if (targetMinutes <= 35 && (source === 'accessory' || source === 'secondary')) {
      sets = Math.max(minSets, sets - 1)
    }
    if (targetMinutes >= 90 && source === 'primary') {
      sets = Math.min(maxSets, sets + 1)
    }
    const restSeconds = clamp(Math.round(exercise.restSeconds * restModifier), isCardio ? 30 : 45, 150)
    const prescription: ExercisePrescription = {
      sets,
      reps: exercise.focus === 'cardio' ? exercise.reps : reps,
      rpe: adjustRpe(exercise.rpe, input.intensity),
      restSeconds,
      load: buildLoad(selectedOption, exercise.loadTarget, input.equipment.inventory)
    }
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

  const canAdd = (exercise: Exercise, source: ExerciseSource, currentMinutes: number) => {
    if (picks.length >= maxExercises || usedNames.has(exercise.name)) return false
    const pattern = exercise.movementPattern ?? 'accessory'
    if ((usedPatterns.get(pattern) ?? 0) >= 2) return false
    const planned = createPlan(exercise, source)
    if (!planned) return false
    if (currentMinutes + planned.estimatedMinutes > targetMinutes + 6 && picks.length >= minExercises) {
      return false
    }
    picks.push(planned)
    usedNames.add(exercise.name)
    usedPatterns.set(pattern, (usedPatterns.get(pattern) ?? 0) + 1)
    return true
  }

  const seedPool = primaryPool.length ? primaryPool : secondaryPool
  const sortedSeed = seedPool.slice().sort((a, b) => b.durationMinutes - a.durationMinutes)
  let totalMinutes = 0
  sortedSeed.some((exercise) => {
    const added = canAdd(exercise, primaryPool.includes(exercise) ? 'primary' : 'secondary', totalMinutes)
    if (added) {
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
    }
    return added
  })

  const fillPools: Array<{ source: ExerciseSource; pool: Exercise[] }> = [
    { source: 'secondary', pool: secondaryPool },
    { source: 'accessory', pool: accessoryPool },
    { source: 'secondary', pool: [...primaryPool, ...secondaryPool, ...accessoryPool] }
  ]

  fillPools.forEach(({ source, pool }) => {
    for (const exercise of pool) {
      if (picks.length >= minExercises) break
      if (canAdd(exercise, source, totalMinutes)) {
        totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      }
    }
  })

  const recalcTotals = () => {
    totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  }

  const adjustEstimate = (planned: PlannedExercise) => {
    const selectedOption = selectEquipmentOption(input.equipment.inventory, planned.exercise.equipment)
    planned.estimatedMinutes = estimateExerciseMinutes(
      planned.exercise,
      planned.prescription,
      selectedOption,
      goal
    )
  }

  const reduceOrder: ExerciseSource[] = ['accessory', 'secondary', 'primary']
  let safetyCounter = 0
  while (totalMinutes > targetMinutes && safetyCounter < 200) {
    let changed = false
    for (const source of reduceOrder) {
      const planned = picks.find((item) => item.source === source && item.prescription.sets > item.minSets)
      if (!planned) continue
      planned.prescription.sets -= 1
      adjustEstimate(planned)
      changed = true
      recalcTotals()
      if (totalMinutes <= targetMinutes) break
    }
    if (!changed) break
    safetyCounter += 1
  }

  const increaseOrder: ExerciseSource[] = ['primary', 'secondary', 'accessory']
  safetyCounter = 0
  while (totalMinutes < targetMinutes - 6 && safetyCounter < 200) {
    let increased = false
    for (const source of increaseOrder) {
      const planned = picks.find((item) => item.source === source && item.prescription.sets < item.maxSets)
      if (!planned) continue
      planned.prescription.sets += 1
      adjustEstimate(planned)
      recalcTotals()
      if (totalMinutes <= targetMinutes) {
        increased = true
        break
      }
      planned.prescription.sets -= 1
      adjustEstimate(planned)
      recalcTotals()
    }
    if (!increased) break
    safetyCounter += 1
  }

  for (const exercise of accessoryPool) {
    if (picks.length >= maxExercises || totalMinutes >= targetMinutes - 5) break
    if (canAdd(exercise, 'accessory', totalMinutes)) {
      recalcTotals()
    }
  }

  return picks.map(({ exercise, prescription }) => ({
    ...exercise,
    ...prescription
  }))
}

const buildSessionExercises = (
  focus: FocusArea,
  duration: number,
  input: PlanInput,
  goalOverride?: Goal
): Exercise[] => {
  const targetGoal = goalOverride ?? input.goals.primary
  const baseFocus = focusMuscleMap[focus]?.baseFocus
  const primaryPool = filterExercises(
    focus,
    input.equipment.inventory,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints,
    input.preferences.cardioActivities,
    targetGoal
  )
  const secondaryPool = filterExercises(
    focus,
    input.equipment.inventory,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints,
    input.preferences.cardioActivities
  )
  const accessoryPool = baseFocus && baseFocus !== focus
    ? filterExercises(
        baseFocus,
        input.equipment.inventory,
        input.preferences.dislikedActivities,
        input.preferences.accessibilityConstraints,
        input.preferences.cardioActivities
      )
    : []

  return buildSessionForTime(primaryPool, secondaryPool, accessoryPool, input, duration, targetGoal)
}

const formatFocusLabel = (focus: FocusArea) =>
  focus.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const buildRationale = (
  focus: FocusArea,
  duration: number,
  restPreference: RestPreference,
  style: Goal
) => {
  const recoveryNote = restPreference === 'high_recovery'
    ? 'Extra recovery was prioritized between sessions.'
    : restPreference === 'minimal_rest'
      ? 'Sessions are designed for minimal rest between workouts.'
      : 'Recovery is balanced across the rotation.'
  return `${duration} minute ${style.replace('_', ' ')} session focused on ${formatFocusLabel(focus)}. ${recoveryNote}`
}

const buildSessionName = (focus: FocusArea, exercises: Exercise[], goal: Goal) => {
  const goalLabel = goal.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  const movementCounts = exercises.reduce<Record<string, number>>((acc, exercise) => {
    if (exercise.movementPattern) {
      acc[exercise.movementPattern] = (acc[exercise.movementPattern] ?? 0) + 1
    }
    return acc
  }, {})

  if (focus === 'upper') {
    const pushCount = movementCounts.push ?? 0
    const pullCount = movementCounts.pull ?? 0
    if (pushCount > pullCount) return 'Push - Chest & Tris'
    if (pullCount > pushCount) return 'Pull - Back & Biceps'
    return `Upper Body - ${goalLabel} Focus`
  }

  if (focus === 'lower') {
    const squatCount = movementCounts.squat ?? 0
    const hingeCount = movementCounts.hinge ?? 0
    if (squatCount > hingeCount) return 'Legs - Squat Focus'
    if (hingeCount > squatCount) return 'Legs - Hinge Focus'
    return `Lower Body - ${goalLabel} Focus`
  }

  if (focus === 'full_body') {
    return `Full Body - ${goalLabel} Flow`
  }

  if (focus === 'core') {
    return 'Core - Stability Focus'
  }

  if (focus === 'cardio') {
    return `Conditioning - ${goalLabel} Circuit`
  }

  if (focus === 'mobility') {
    return 'Mobility - Recovery Flow'
  }

  return `${formatFocusLabel(focus)} - ${goalLabel} Focus`
}

const buildPlanTitle = (focus: FocusArea, goal: Goal) => {
  const goalLabel = goal.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  return `${formatFocusLabel(focus)} – ${goalLabel}`
}

const buildFocusDistribution = (schedule: PlanDay[]) => schedule.reduce<Record<FocusArea, number>>((acc, day) => {
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
  back: 0
})

export const calculateExerciseImpact = (exercises: Exercise[]): WorkoutImpact => {
  const totals = exercises.reduce(
    (acc, exercise) => {
      const metrics = computeExerciseMetrics(exercise)
      acc.volume += metrics.volume ?? 0
      acc.intensity += metrics.intensity ?? 0
      acc.density += metrics.density ?? 0
      return acc
    },
    { volume: 0, intensity: 0, density: 0 }
  )

  const volumeScore = Math.round(totals.volume)
  const intensityScore = Math.round(totals.intensity)
  const densityScore = Math.round(totals.density)

  return {
    score: volumeScore + intensityScore + densityScore,
    breakdown: {
      volume: volumeScore,
      intensity: intensityScore,
      density: densityScore
    }
  }
}

export const calculateWorkoutImpact = (schedule: PlanDay[]): WorkoutImpact =>
  calculateExerciseImpact(schedule.flatMap(day => day.exercises))

export const generateSessionExercises = (
  input: PlanInput,
  focus: FocusArea,
  durationMinutes: number,
  goalOverride?: Goal
) => buildSessionExercises(focus, durationMinutes, input, goalOverride)

export const generatePlan = (partialInput: Partial<PlanInput>): { plan?: GeneratedPlan; errors: string[] } => {
  const normalized = applyRestPreference(normalizePlanInput(partialInput))
  const errors = validatePlanInput(normalized)
  if (errors.length > 0) {
    return { errors }
  }

  const focusSequence = normalized.intent.mode === 'body_part' && normalized.intent.bodyParts?.length
    ? [normalized.intent.bodyParts[0]]
    : buildFocusSequence(1, normalized.preferences, normalized.goals)
  const sessionsPerWeek = 1
  const minutesPerSession = adjustMinutesPerSession(normalized, sessionsPerWeek)
  const schedule: PlanDay[] = Array.from({ length: sessionsPerWeek }, (_, index) => {
    const focus = focusSequence[index]
    const style = normalized.goals.primary
    const duration = clamp(minutesPerSession, 20, 120)
    const exercises = buildSessionExercises(focus, duration, normalized, style)
    const name = buildSessionName(focus, exercises, style)
    return {
      order: index,
      name,
      focus,
      durationMinutes: duration,
      exercises,
      rationale: buildRationale(focus, duration, normalized.preferences.restPreference, style)
    }
  })

  const totalMinutes = schedule.reduce((sum, day) => sum + day.durationMinutes, 0)
  const uniqueStyles = [normalized.goals.primary]
  const title = buildPlanTitle(focusSequence[0], normalized.goals.primary)
  const description =
    uniqueStyles.length === 1
      ? `${formatFocusLabel(focusSequence[0])} focus · ${uniqueStyles[0].replace('_', ' ')} goal.`
      : `Mixed styles across your focus rotation.`
  const impact = calculateWorkoutImpact(schedule)

  const plan: GeneratedPlan = {
    title,
    description,
    goal: normalized.goals.primary,
    level: normalized.experienceLevel,
    tags: [
      normalized.goals.primary,
      normalized.goals.secondary ?? 'none',
      normalized.intensity,
      normalized.experienceLevel
    ],
    schedule,
    inputs: normalized,
    summary: {
      sessionsPerWeek,
      totalMinutes,
      focusDistribution: buildFocusDistribution(schedule),
      impact
    }
  }

  return { plan, errors: [] }
}
