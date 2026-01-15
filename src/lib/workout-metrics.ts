import type { FocusArea, PlanDay } from '@/types/domain'

type ExerciseMetricsInput = {
  sets?: number
  reps?: string | number
  rpe?: number
  durationMinutes?: number
  restSeconds?: number
}

const toTitleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const focusLabelMap: Record<FocusArea, string> = {
  upper: 'Upper Body',
  lower: 'Lower Body',
  full_body: 'Full Body',
  core: 'Core',
  cardio: 'Conditioning',
  mobility: 'Mobility',
  arms: 'Arms',
  legs: 'Legs',
  biceps: 'Biceps',
  triceps: 'Triceps',
  chest: 'Chest',
  back: 'Back'
}

const goalLabelMap: Record<string, string> = {
  cardio: 'Conditioning'
}

export const formatGoalLabel = (goal?: string | null) => {
  if (!goal) return ''
  return goalLabelMap[goal] ?? toTitleCase(goal)
}

export const formatFocusLabel = (focus: FocusArea) => focusLabelMap[focus] ?? toTitleCase(focus)

export const formatSessionName = (session: PlanDay, goal?: string | null) => {
  if (session.name) return session.name
  const focusLabel = formatFocusLabel(session.focus)
  const goalLabel = formatGoalLabel(goal)
  if (!goalLabel) return focusLabel
  const normalizedFocus = focusLabel.toLowerCase()
  const normalizedGoal = goalLabel.toLowerCase()
  if (normalizedFocus.includes(normalizedGoal)) {
    return focusLabel
  }
  return `${focusLabel} ${goalLabel}`.trim()
}


const parseReps = (reps: ExerciseMetricsInput['reps']) => {
  if (typeof reps === 'number' && Number.isFinite(reps)) return reps
  if (typeof reps !== 'string') return null
  const matches = reps.match(/\d+/g)
  if (!matches?.length) return null
  const numbers = matches.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
  if (!numbers.length) return null
  if (numbers.length === 1) return numbers[0]
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

export const computeExerciseMetrics = (exercise: ExerciseMetricsInput) => {
  const repsValue = parseReps(exercise.reps)
  const volume = repsValue && exercise.sets ? repsValue * exercise.sets : null
  const estimatedMinutes =
    exercise.durationMinutes ??
    (exercise.restSeconds && exercise.sets ? (exercise.restSeconds * exercise.sets) / 60 : exercise.sets ? exercise.sets * 2 : null)
  const density = volume && estimatedMinutes ? Number((volume / estimatedMinutes).toFixed(1)) : null
  const intensity = Number.isFinite(exercise.rpe) ? exercise.rpe : null
  return { volume, density, intensity }
}
