import type {
  Equipment,
  Exercise,
  FocusArea,
  GeneratedPlan,
  Goal,
  GoalPriority,
  Intensity,
  PlanDay,
  PlanInput,
  RestPreference,
  TimeWindow
} from '@/types/domain'

const DEFAULT_INPUT: PlanInput = {
  goals: {
    primary: 'strength',
    priority: 'primary'
  },
  experienceLevel: 'intermediate',
  intensity: 'moderate',
  equipment: ['gym'],
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
  { name: 'Barbell Back Squat', focus: 'lower', sets: 4, reps: '5-8', rpe: 8, equipment: ['gym'], durationMinutes: 12 },
  { name: 'Dumbbell Goblet Squat', focus: 'lower', sets: 3, reps: '8-12', rpe: 7, equipment: ['dumbbells'], durationMinutes: 10 },
  { name: 'Romanian Deadlift', focus: 'lower', sets: 3, reps: '8-10', rpe: 8, equipment: ['gym', 'dumbbells'], durationMinutes: 10 },
  { name: 'Push-Up', focus: 'upper', sets: 3, reps: '10-15', rpe: 7, equipment: ['bodyweight'], durationMinutes: 8 },
  { name: 'Bench Press', focus: 'upper', sets: 4, reps: '5-8', rpe: 8, equipment: ['gym'], durationMinutes: 12 },
  { name: 'Dumbbell Row', focus: 'upper', sets: 3, reps: '8-12', rpe: 7, equipment: ['dumbbells'], durationMinutes: 10 },
  { name: 'Overhead Press', focus: 'upper', sets: 3, reps: '6-10', rpe: 8, equipment: ['gym', 'dumbbells'], durationMinutes: 10 },
  { name: 'Walking Lunge', focus: 'lower', sets: 3, reps: '10-12', rpe: 7, equipment: ['dumbbells', 'bodyweight'], durationMinutes: 9 },
  { name: 'Plank Series', focus: 'core', sets: 3, reps: '30-45 sec', rpe: 7, equipment: ['bodyweight'], durationMinutes: 6 },
  { name: 'Dead Bug', focus: 'core', sets: 3, reps: '8-12', rpe: 6, equipment: ['bodyweight'], durationMinutes: 6 },
  { name: 'Incline Dumbbell Press', focus: 'upper', sets: 3, reps: '8-12', rpe: 7, equipment: ['dumbbells'], durationMinutes: 9 },
  { name: 'Lat Pulldown', focus: 'upper', sets: 3, reps: '8-12', rpe: 7, equipment: ['gym'], durationMinutes: 9 },
  { name: 'Assault Bike Intervals', focus: 'cardio', sets: 6, reps: '30 sec on/30 sec off', rpe: 8, equipment: ['gym'], durationMinutes: 10 },
  { name: 'Zone 2 Cardio', focus: 'cardio', sets: 1, reps: '20-30 min', rpe: 6, equipment: ['gym', 'bodyweight'], durationMinutes: 20 },
  { name: 'Mobility Flow', focus: 'mobility', sets: 1, reps: '15-20 min', rpe: 5, equipment: ['bodyweight'], durationMinutes: 15 },
  { name: 'Kettlebell Swing', focus: 'cardio', sets: 4, reps: '12-15', rpe: 8, equipment: ['kettlebell'], durationMinutes: 8 },
  { name: 'Resistance Band Pull-Apart', focus: 'upper', sets: 3, reps: '12-15', rpe: 6, equipment: ['bands'], durationMinutes: 6 }
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

  if (input.equipment.length === 0) {
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

const filterExercises = (
  focus: FocusArea,
  equipment: Equipment[],
  disliked: string[],
  accessibility: string[]
) => EXERCISE_LIBRARY.filter(exercise => {
  const matchesFocus = focus === 'full_body' || exercise.focus === focus || (focus === 'cardio' && exercise.focus === 'cardio')
  const matchesEquipment = exercise.equipment.some(item => equipment.includes(item))
  const isDisliked = disliked.some(activity => exercise.name.toLowerCase().includes(activity.toLowerCase()))
  const lowImpact = accessibility.includes('low-impact')
  const isHighImpact = exercise.name.toLowerCase().includes('jump') || exercise.name.toLowerCase().includes('interval')
  return matchesFocus && matchesEquipment && !isDisliked && !(lowImpact && isHighImpact)
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
  const maxExercises = clamp(Math.floor(duration / 10), 3, 6)
  const primaryGoal = input.goals.primary
  const reps = deriveReps(primaryGoal, input.intensity)

  const picks = exercises.slice(0, maxExercises)
  return picks.map(exercise => ({
    ...exercise,
    sets: adjustSets(exercise.sets, input.experienceLevel),
    reps,
    rpe: adjustRpe(exercise.rpe, input.intensity)
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
      focusDistribution: buildFocusDistribution(schedule)
    }
  }

  return { plan, errors: [] }
}
