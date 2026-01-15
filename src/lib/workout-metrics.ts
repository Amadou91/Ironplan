import { formatDayLabel } from '@/lib/schedule-utils'
import type { WorkoutLog, WorkoutPlan } from '@/types/domain'

type ExerciseMetricsInput = {
  sets?: number
  reps?: string | number
  rpe?: number
  durationMinutes?: number
  restSeconds?: number
}

const SESSION_LABEL_REGEX = /Session\s+(\d+)/i

const formatSessionId = (index: number) => `session-${index}`

export const formatSessionLabel = (index: number) => `Session ${index + 1}`

const getSessionIndexFromName = (sessionName: string | null, plan: WorkoutPlan) => {
  if (!sessionName) return null
  const match = sessionName.match(SESSION_LABEL_REGEX)
  if (match) {
    const parsed = Number.parseInt(match[1], 10)
    if (Number.isFinite(parsed)) {
      const index = parsed - 1
      if (index >= 0 && index < plan.sessions.length) return index
    }
  }

  const normalizedName = sessionName.toLowerCase()
  for (const [index, session] of plan.sessions.entries()) {
    const dayOfWeek = session.dayOfWeek
    if (dayOfWeek === undefined || dayOfWeek === null) continue
    const longLabel = formatDayLabel(dayOfWeek, 'long').toLowerCase()
    const shortLabel = formatDayLabel(dayOfWeek, 'short').toLowerCase()
    if (normalizedName.includes(longLabel) || normalizedName.includes(shortLabel)) {
      return index
    }
  }

  return null
}

export const getSuggestedSessionId = (plan: WorkoutPlan, history: WorkoutLog[]) => {
  if (!plan.sessions.length) return null

  const sortedHistory = [...history]
    .filter((log) => log.workoutId === plan.id && log.completedAt)
    .sort((a, b) => new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime())

  for (const log of sortedHistory) {
    const lastIndex = getSessionIndexFromName(log.sessionName, plan)
    if (lastIndex !== null) {
      const nextIndex = (lastIndex + 1) % plan.sessions.length
      return formatSessionId(nextIndex)
    }
  }

  return formatSessionId(0)
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
