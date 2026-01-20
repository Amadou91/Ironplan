import type { FocusArea, PlanDay, WorkoutSession, WorkoutSet } from '@/types/domain'

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

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const getSetEffort = (set: WorkoutSet) => {
  if (isNumber(set.rpe)) return set.rpe
  if (isNumber(set.rir)) return Math.max(0, Math.min(10, 10 - set.rir))
  return null
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

export const calculateSessionImpactFromSets = (
  session: WorkoutSession,
  endedAt?: string | null
) => {
  const sessionEnd = endedAt ?? session.endedAt
  const sessionDurationMinutes = sessionEnd
    ? Math.max(1, (new Date(sessionEnd).getTime() - new Date(session.startedAt).getTime()) / 60000)
    : null

  const exercisesWithSets = session.exercises
    .map((exercise) => {
      const relevantSets = exercise.sets.filter((set) =>
        set.completed ||
        isNumber(set.reps) ||
        isNumber(set.weight) ||
        isNumber(set.rpe) ||
        isNumber(set.rir)
      )
      if (!relevantSets.length) return null
      return { exercise, sets: relevantSets }
    })
    .filter((entry): entry is { exercise: WorkoutSession['exercises'][number]; sets: WorkoutSet[] } => Boolean(entry))

  if (!exercisesWithSets.length) return null

  const totalSetCount = exercisesWithSets.reduce((sum, entry) => sum + entry.sets.length, 0)

  const totals = exercisesWithSets.reduce(
    (acc, entry) => {
      const repsValues = entry.sets.map((set) => (isNumber(set.reps) ? set.reps : null)).filter(isNumber)
      const effortValues = entry.sets.map(getSetEffort).filter(isNumber)
      const repsAverage = average(repsValues)
      const effortAverage = average(effortValues)
      const durationMinutes = sessionDurationMinutes && totalSetCount > 0
        ? sessionDurationMinutes * (entry.sets.length / totalSetCount)
        : undefined

      const metrics = computeExerciseMetrics({
        sets: entry.sets.length,
        reps: repsAverage ?? 0,
        rpe: effortAverage ?? undefined,
        durationMinutes
      })

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
