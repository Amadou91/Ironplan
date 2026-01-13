import type {
  EquipmentInventory,
  Exercise,
  FocusArea,
  GeneratedPlan,
  Goal,
  GoalPriority,
  Intensity,
  PlanDay,
  PlanInput,
  RestPreference,
  TimeWindow,
  WorkoutImpact
} from '@/types/domain'
import { equipmentPresets, hasEquipment } from './equipment'

const DEFAULT_INPUT: PlanInput = {
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
    daysAvailable: [1, 3, 5],
    timeWindows: ['evening'],
    minRestDays: 1
  },
  preferences: {
    focusAreas: [],
    dislikedActivities: [],
    accessibilityConstraints: [],
    restPreference: 'balanced'
  }
}

type ExerciseTemplate = Omit<Exercise, 'load'> & {
  loadTarget?: number
}

const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  {
    name: 'Barbell Back Squat',
    focus: 'lower',
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
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: [{ kind: 'dumbbell' }, { kind: 'bodyweight' }],
    durationMinutes: 9,
    loadTarget: 20,
    restSeconds: 75
  },
  {
    name: 'Plank Series',
    focus: 'core',
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
    sets: 6,
    reps: '30 sec on/30 sec off',
    rpe: 8,
    equipment: [{ kind: 'machine', machineType: 'treadmill' }, { kind: 'machine', machineType: 'rower' }],
    durationMinutes: 10,
    restSeconds: 60
  },
  {
    name: 'Zone 2 Cardio',
    focus: 'cardio',
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

  if (input.schedule.daysAvailable.length === 0) {
    errors.push('Select at least one available day.')
  }

  if (input.schedule.timeWindows.length === 0) {
    errors.push('Select at least one time window.')
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

const sortDays = (days: number[]) => [...days].sort((a, b) => a - b)

const deriveSessionsPerWeek = (input: PlanInput) => {
  const availableDays = sortDays(input.schedule.daysAvailable)
  if (input.time.totalMinutesPerWeek) {
    const byTime = Math.floor(input.time.totalMinutesPerWeek / input.time.minutesPerSession)
    return clamp(Math.min(byTime, availableDays.length), 1, availableDays.length)
  }
  return availableDays.length
}

const pickTrainingDays = (input: PlanInput, sessionsPerWeek: number): number[] => {
  const sorted = sortDays(input.schedule.daysAvailable)
  const minRest = input.schedule.minRestDays
  const selected: number[] = []

  for (const day of sorted) {
    if (selected.length === 0) {
      selected.push(day)
      continue
    }
    const last = selected[selected.length - 1]
    if (day - last > minRest) {
      selected.push(day)
    }
    if (selected.length >= sessionsPerWeek) {
      break
    }
  }

  if (selected.length < sessionsPerWeek) {
    return sorted.slice(0, sessionsPerWeek)
  }

  return selected
}

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

const filterExercises = (
  focus: FocusArea,
  inventory: EquipmentInventory,
  disliked: string[],
  accessibility: string[]
) => EXERCISE_LIBRARY.filter(exercise => {
  const matchesFocus = focus === 'full_body' || exercise.focus === focus || (focus === 'cardio' && exercise.focus === 'cardio')
  const option = selectEquipmentOption(inventory, exercise.equipment)
  const isDisliked = disliked.some(activity => exercise.name.toLowerCase().includes(activity.toLowerCase()))
  const lowImpact = accessibility.includes('low-impact')
  const isHighImpact = exercise.name.toLowerCase().includes('jump') || exercise.name.toLowerCase().includes('interval')
  return matchesFocus && Boolean(option) && !isDisliked && !(lowImpact && isHighImpact)
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

const buildSessionExercises = (
  focus: FocusArea,
  duration: number,
  input: PlanInput
): Exercise[] => {
  const exercises = filterExercises(
    focus,
    input.equipment.inventory,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints
  )
  const maxExercises = clamp(Math.floor(duration / 10), 3, 6)
  const primaryGoal = input.goals.primary
  const reps = deriveReps(primaryGoal, input.intensity)

  const picks = exercises.slice(0, maxExercises)
  return picks.map(exercise => {
    const selectedOption = selectEquipmentOption(input.equipment.inventory, exercise.equipment)
    const load = buildLoad(selectedOption, exercise.loadTarget, input.equipment.inventory)
    return {
      ...exercise,
      sets: adjustSets(exercise.sets, input.experienceLevel),
      reps,
      rpe: adjustRpe(exercise.rpe, input.intensity),
      load
    }
  })
}

const buildRationale = (
  day: number,
  timeWindow: TimeWindow,
  focus: FocusArea,
  duration: number,
  restPreference: RestPreference
) => {
  const dayLabel = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
  const recoveryNote = restPreference === 'high_recovery'
    ? 'Extra recovery spacing was prioritized.'
    : restPreference === 'minimal_rest'
      ? 'Sessions are packed with minimal rest days.'
      : 'Recovery is balanced across the week.'
  return `Scheduled for ${dayLabel} ${timeWindow} with a ${duration} minute focus on ${focus.replace('_', ' ')}. ${recoveryNote}`
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
  mobility: 0
})

const parseReps = (reps: string | number) => {
  if (typeof reps === 'number') return reps
  const matches = reps.match(/\d+/g)?.map(Number) ?? []
  if (matches.length === 0) return 10
  if (matches.length === 1) return matches[0]
  return Math.round(matches.reduce((sum, value) => sum + value, 0) / matches.length)
}

export const calculateWorkoutImpact = (schedule: PlanDay[]): WorkoutImpact => {
  const totals = schedule.flatMap(day => day.exercises).reduce(
    (acc, exercise) => {
      const repsValue = parseReps(exercise.reps)
      const loadValue = exercise.load?.value ?? 10
      acc.volume += exercise.sets * repsValue * (loadValue / 10)
      acc.intensity += exercise.rpe * exercise.sets
      acc.density += Math.max(1, Math.round(exercise.durationMinutes / 5))
      return acc
    },
    { volume: 0, intensity: 0, density: 0 }
  )

  const volumeScore = Math.round(totals.volume / 10)
  const intensityScore = Math.round(totals.intensity / 5)
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

export const generatePlan = (partialInput: Partial<PlanInput>): { plan?: GeneratedPlan; errors: string[] } => {
  const normalized = applyRestPreference(normalizePlanInput(partialInput))
  const errors = validatePlanInput(normalized)
  if (errors.length > 0) {
    return { errors }
  }

  const sessionsPerWeek = deriveSessionsPerWeek(normalized)
  const trainingDays = pickTrainingDays(normalized, sessionsPerWeek)
  const minutesPerSession = adjustMinutesPerSession(normalized, sessionsPerWeek)
  const timeWindows = normalized.schedule.timeWindows
  const focusSequence = buildFocusSequence(sessionsPerWeek, normalized.preferences, normalized.goals)
  const schedule: PlanDay[] = trainingDays.map((day, index) => {
    const focus = focusSequence[index]
    const duration = clamp(minutesPerSession, 20, 120)
    const exercises = buildSessionExercises(focus, duration, normalized)
    const timeWindow = timeWindows[index % timeWindows.length]
    return {
      dayOfWeek: day,
      timeWindow,
      focus,
      durationMinutes: duration,
      exercises,
      rationale: buildRationale(day, timeWindow, focus, duration, normalized.preferences.restPreference)
    }
  })

  const totalMinutes = schedule.reduce((sum, day) => sum + day.durationMinutes, 0)
  const title = `${normalized.goals.primary.replace('_', ' ').toUpperCase()} PLAN`
  const description = `${sessionsPerWeek} sessions/week · ${minutesPerSession} min/session · Focus on ${normalized.goals.primary.replace('_', ' ')}.`
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
