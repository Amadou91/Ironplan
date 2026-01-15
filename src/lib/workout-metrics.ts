import type { FocusArea, PlanDay, WorkoutLog, WorkoutPlan } from '@/types/domain'

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
  mobility: 'Mobility'
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

const normalizeLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const getSessionIndexFromName = (sessionName: string | null, plan: WorkoutPlan) => {
  if (!sessionName) return null
  const normalizedName = normalizeLabel(sessionName)
  const sessionNames = plan.sessions.map((session, index) => ({
    index,
    label: normalizeLabel(formatSessionName(session, plan.goal))
  }))

  const directMatch = sessionNames.find((session) => normalizedName.includes(session.label))
  if (directMatch) return directMatch.index

  for (const [index, session] of plan.sessions.entries()) {
    const focusLabel = normalizeLabel(formatFocusLabel(session.focus))
    if (focusLabel && normalizedName.includes(focusLabel)) {
      return index
    }
  }

  return null
}

const focusPriority: Record<FocusArea, FocusArea[]> = {
  upper: ['lower', 'full_body', 'cardio', 'mobility', 'core'],
  lower: ['upper', 'full_body', 'cardio', 'mobility', 'core'],
  full_body: ['mobility', 'cardio', 'upper', 'lower', 'core'],
  core: ['upper', 'lower', 'full_body', 'cardio', 'mobility'],
  cardio: ['upper', 'lower', 'full_body', 'mobility', 'core'],
  mobility: ['upper', 'lower', 'full_body', 'cardio', 'core']
}

const findNextSessionByFocus = (sessions: PlanDay[], startIndex: number, focus: FocusArea) => {
  for (let offset = 1; offset <= sessions.length; offset += 1) {
    const index = (startIndex + offset) % sessions.length
    if (sessions[index]?.focus === focus) return index
  }
  return null
}

export const getSuggestedSessionIndex = (plan: WorkoutPlan, history: WorkoutLog[]) => {
  if (!plan.sessions.length) return null

  const sortedHistory = [...history]
    .filter((log) => log.workoutId === plan.id && log.completedAt)
    .sort((a, b) => new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime())

  for (const log of sortedHistory) {
    const lastIndex = getSessionIndexFromName(log.sessionName, plan)
    if (lastIndex !== null) {
      const lastFocus = plan.sessions[lastIndex]?.focus
      if (lastFocus) {
        const priorities = focusPriority[lastFocus] ?? []
        for (const focus of priorities) {
          const nextIndex = findNextSessionByFocus(plan.sessions, lastIndex, focus)
          if (nextIndex !== null) return nextIndex
        }
      }
      return (lastIndex + 1) % plan.sessions.length
    }
  }

  return 0
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
