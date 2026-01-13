import type {
  Equipment,
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
  MachineType,
  LoadType
} from '@/types/domain'

const DEFAULT_INPUT: PlanInput = {
  goals: {
    primary: 'strength',
    priority: 'primary'
  },
  experienceLevel: 'intermediate',
  intensity: 'moderate',
  equipment: {
    bodyweight: true,
    dumbbells: [15, 25, 35],
    kettlebells: [18, 24],
    bands: ['light', 'medium'],
    barbell: {
      available: true,
      barWeight: 45,
      plates: [45, 25, 10, 5]
    },
    machines: {
      bench: true,
      lat_pulldown: true,
      cable: true,
      assault_bike: true,
      leg_press: true
    }
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

const EXERCISE_LIBRARY: Exercise[] = [
  {
    name: 'Barbell Back Squat',
    focus: 'lower',
    sets: 4,
    reps: '5-8',
    rpe: 8,
    equipment: ['barbell'],
    durationMinutes: 12,
    loadType: 'barbell'
  },
  {
    name: 'Dumbbell Goblet Squat',
    focus: 'lower',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: ['dumbbells'],
    durationMinutes: 10,
    loadType: 'dumbbell'
  },
  {
    name: 'Romanian Deadlift',
    focus: 'lower',
    sets: 3,
    reps: '8-10',
    rpe: 8,
    equipment: ['barbell', 'dumbbells'],
    durationMinutes: 10,
    loadType: 'barbell'
  },
  {
    name: 'Push-Up',
    focus: 'upper',
    sets: 3,
    reps: '10-15',
    rpe: 7,
    equipment: ['bodyweight'],
    durationMinutes: 8,
    loadType: 'bodyweight'
  },
  {
    name: 'Bench Press',
    focus: 'upper',
    sets: 4,
    reps: '5-8',
    rpe: 8,
    equipment: ['barbell'],
    durationMinutes: 12,
    loadType: 'barbell',
    machineRequirement: ['bench']
  },
  {
    name: 'Dumbbell Row',
    focus: 'upper',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: ['dumbbells'],
    durationMinutes: 10,
    loadType: 'dumbbell'
  },
  {
    name: 'Overhead Press',
    focus: 'upper',
    sets: 3,
    reps: '6-10',
    rpe: 8,
    equipment: ['barbell', 'dumbbells'],
    durationMinutes: 10,
    loadType: 'barbell'
  },
  {
    name: 'Walking Lunge',
    focus: 'lower',
    sets: 3,
    reps: '10-12',
    rpe: 7,
    equipment: ['dumbbells', 'bodyweight'],
    durationMinutes: 9,
    loadType: 'dumbbell'
  },
  {
    name: 'Plank Series',
    focus: 'core',
    sets: 3,
    reps: '30-45 sec',
    rpe: 7,
    equipment: ['bodyweight'],
    durationMinutes: 6,
    loadType: 'bodyweight'
  },
  {
    name: 'Dead Bug',
    focus: 'core',
    sets: 3,
    reps: '8-12',
    rpe: 6,
    equipment: ['bodyweight'],
    durationMinutes: 6,
    loadType: 'bodyweight'
  },
  {
    name: 'Incline Dumbbell Press',
    focus: 'upper',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: ['dumbbells'],
    durationMinutes: 9,
    loadType: 'dumbbell'
  },
  {
    name: 'Lat Pulldown',
    focus: 'upper',
    sets: 3,
    reps: '8-12',
    rpe: 7,
    equipment: ['machines'],
    durationMinutes: 9,
    loadType: 'machine',
    machineRequirement: ['lat_pulldown']
  },
  {
    name: 'Assault Bike Intervals',
    focus: 'cardio',
    sets: 6,
    reps: '30 sec on/30 sec off',
    rpe: 8,
    equipment: ['machines'],
    durationMinutes: 10,
    loadType: 'none',
    machineRequirement: ['assault_bike']
  },
  {
    name: 'Zone 2 Cardio',
    focus: 'cardio',
    sets: 1,
    reps: '20-30 min',
    rpe: 6,
    equipment: ['machines', 'bodyweight'],
    durationMinutes: 20,
    loadType: 'none',
    machineRequirement: ['assault_bike']
  },
  {
    name: 'Mobility Flow',
    focus: 'mobility',
    sets: 1,
    reps: '15-20 min',
    rpe: 5,
    equipment: ['bodyweight'],
    durationMinutes: 15,
    loadType: 'none'
  },
  {
    name: 'Kettlebell Swing',
    focus: 'cardio',
    sets: 4,
    reps: '12-15',
    rpe: 8,
    equipment: ['kettlebell'],
    durationMinutes: 8,
    loadType: 'kettlebell'
  },
  {
    name: 'Resistance Band Pull-Apart',
    focus: 'upper',
    sets: 3,
    reps: '12-15',
    rpe: 6,
    equipment: ['bands'],
    durationMinutes: 6,
    loadType: 'band'
  }
]

const buildAvailableEquipment = (equipment: EquipmentInventory): Equipment[] => {
  const available: Equipment[] = []
  if (equipment.bodyweight) available.push('bodyweight')
  if (equipment.dumbbells.length > 0) available.push('dumbbells')
  if (equipment.kettlebells.length > 0) available.push('kettlebell')
  if (equipment.bands.length > 0) available.push('bands')
  if (equipment.barbell.available) available.push('barbell')
  if (Object.values(equipment.machines).some(Boolean)) available.push('machines')
  return available
}

const hasRequiredMachines = (equipment: EquipmentInventory, requirement?: MachineType[]) => {
  if (!requirement || requirement.length === 0) return true
  return requirement.every(machine => equipment.machines[machine])
}

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

  if (buildAvailableEquipment(input.equipment).length === 0) {
    errors.push('Add at least one equipment option or enable bodyweight training.')
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

const parseRepRange = (reps: string) => {
  const range = reps.match(/(\d+)(?:\s*[-–]\s*(\d+))?/)
  if (!range) return null
  const min = Number(range[1])
  const max = range[2] ? Number(range[2]) : min
  return { min, max, average: (min + max) / 2 }
}

const selectWeightByIntensity = (weights: number[], intensity: Intensity) => {
  if (weights.length === 0) return null
  const sorted = [...weights].sort((a, b) => a - b)
  const index = intensity === 'high'
    ? Math.max(0, Math.floor(sorted.length * 0.75) - 1)
    : intensity === 'low'
      ? Math.max(0, Math.floor(sorted.length * 0.25))
      : Math.floor(sorted.length / 2)
  return sorted[index]
}

const buildBarbellTotals = (equipment: EquipmentInventory['barbell']) => {
  if (!equipment.available) return []
  const totals = new Set<number>([equipment.barWeight])
  let sums = new Set<number>([0])
  for (const plate of equipment.plates) {
    const next = new Set<number>(sums)
    for (const sum of sums) {
      next.add(sum + plate)
    }
    sums = next
  }
  for (const sum of sums) {
    totals.add(equipment.barWeight + sum * 2)
  }
  return [...totals].sort((a, b) => a - b)
}

const selectBarbellLoad = (equipment: EquipmentInventory, intensity: Intensity) => {
  const totals = buildBarbellTotals(equipment.barbell)
  if (totals.length === 0) return null
  const max = totals[totals.length - 1]
  const targetRatio = intensity === 'high' ? 0.75 : intensity === 'low' ? 0.55 : 0.65
  const target = max * targetRatio
  const selected = totals.reduce((closest, current) =>
    Math.abs(current - target) < Math.abs(closest - target) ? current : closest
  )
  return `Target ~${selected} total (max available ${max})`
}

const selectBandLoad = (bands: string[], intensity: Intensity) => {
  if (bands.length === 0) return null
  const index = intensity === 'high'
    ? bands.length - 1
    : intensity === 'low'
      ? 0
      : Math.floor(bands.length / 2)
  return `${bands[index]} band`
}

const resolveLoadType = (exercise: Exercise, input: PlanInput): LoadType => {
  const preferred = exercise.loadType
  if (preferred === 'barbell' && input.equipment.barbell.available) return 'barbell'
  if (preferred === 'dumbbell' && input.equipment.dumbbells.length > 0) return 'dumbbell'
  if (preferred === 'kettlebell' && input.equipment.kettlebells.length > 0) return 'kettlebell'
  if (preferred === 'band' && input.equipment.bands.length > 0) return 'band'
  if (preferred === 'machine' && Object.values(input.equipment.machines).some(Boolean)) return 'machine'
  if (preferred === 'bodyweight' && input.equipment.bodyweight) return 'bodyweight'

  if (exercise.equipment.includes('barbell') && input.equipment.barbell.available) return 'barbell'
  if (exercise.equipment.includes('dumbbells') && input.equipment.dumbbells.length > 0) return 'dumbbell'
  if (exercise.equipment.includes('kettlebell') && input.equipment.kettlebells.length > 0) return 'kettlebell'
  if (exercise.equipment.includes('bands') && input.equipment.bands.length > 0) return 'band'
  if (exercise.equipment.includes('machines') && Object.values(input.equipment.machines).some(Boolean)) return 'machine'
  if (exercise.equipment.includes('bodyweight') && input.equipment.bodyweight) return 'bodyweight'
  return 'none'
}

const suggestLoad = (exercise: Exercise, input: PlanInput) => {
  const loadType = resolveLoadType(exercise, input)
  switch (loadType) {
    case 'dumbbell': {
      const weight = selectWeightByIntensity(input.equipment.dumbbells, input.intensity)
      return weight ? `Pair of ${weight}` : null
    }
    case 'kettlebell': {
      const weight = selectWeightByIntensity(input.equipment.kettlebells, input.intensity)
      return weight ? `${weight} kettlebell` : null
    }
    case 'band': {
      return selectBandLoad(input.equipment.bands, input.intensity)
    }
    case 'barbell': {
      return selectBarbellLoad(input.equipment, input.intensity)
    }
    case 'machine':
      return 'Select a stack setting that matches the target RPE'
    case 'bodyweight':
      return 'Bodyweight'
    case 'none':
    default:
      return null
  }
}

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

const filterExercises = (
  focus: FocusArea,
  equipment: EquipmentInventory,
  disliked: string[],
  accessibility: string[]
) => EXERCISE_LIBRARY.filter(exercise => {
  const matchesFocus = focus === 'full_body' || exercise.focus === focus || (focus === 'cardio' && exercise.focus === 'cardio')
  const availableEquipment = buildAvailableEquipment(equipment)
  const matchesEquipment = exercise.equipment.some(item => availableEquipment.includes(item))
  const matchesMachines = hasRequiredMachines(equipment, exercise.machineRequirement)
  const isDisliked = disliked.some(activity => exercise.name.toLowerCase().includes(activity.toLowerCase()))
  const lowImpact = accessibility.includes('low-impact')
  const isHighImpact = exercise.name.toLowerCase().includes('jump') || exercise.name.toLowerCase().includes('interval')
  return matchesFocus && matchesEquipment && matchesMachines && !isDisliked && !(lowImpact && isHighImpact)
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
    input.equipment,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints
  )
  const availableEquipment = buildAvailableEquipment(input.equipment)
  const fallbackExercises = EXERCISE_LIBRARY.filter(exercise =>
    exercise.equipment.some(item => availableEquipment.includes(item)) &&
    hasRequiredMachines(input.equipment, exercise.machineRequirement)
  )
  const maxExercises = clamp(Math.floor(duration / 10), 3, 6)
  const primaryGoal = input.goals.primary
  const reps = deriveReps(primaryGoal, input.intensity)

  const picks = (exercises.length > 0 ? exercises : fallbackExercises).slice(0, maxExercises)
  return picks.map(exercise => ({
    ...exercise,
    sets: adjustSets(exercise.sets, input.experienceLevel),
    reps,
    rpe: adjustRpe(exercise.rpe, input.intensity),
    suggestedLoad: suggestLoad(exercise, input),
    notes: exercises.length === 0 ? 'Fallback to available equipment due to limited matches.' : exercise.notes
  }))
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

export const calculateWorkoutScore = (schedule: PlanDay[]) => {
  const volume = schedule.reduce((sum, day) => sum + day.exercises.reduce((inner, exercise) => {
    const reps = parseRepRange(exercise.reps)?.average ?? 8
    return inner + exercise.sets * reps
  }, 0), 0)

  const intensity = schedule.reduce((sum, day) => sum + day.exercises.reduce((inner, exercise) => inner + (exercise.rpe ?? 7), 0), 0)

  const density = schedule.reduce((sum, day) => {
    const totalSets = day.exercises.reduce((setsSum, exercise) => setsSum + exercise.sets, 0)
    return sum + (totalSets / Math.max(day.durationMinutes, 1)) * 10
  }, 0)

  const volumeScore = Math.round(volume / 10)
  const intensityScore = Math.round(intensity / 2)
  const densityScore = Math.round(density)

  return {
    total: volumeScore + intensityScore + densityScore,
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
  const workoutScore = calculateWorkoutScore(schedule)

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
      workoutScore
    }
  }

  return { plan, errors: [] }
}
