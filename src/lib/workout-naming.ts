import type { FocusArea, PlanInput } from '@/types/domain'
import { formatFocusLabel, formatGoalLabel } from '@/lib/workout-metrics'

type WorkoutNamingInput = {
  focus?: FocusArea | null
  style?: string | null
  intensity?: PlanInput['intensity'] | null
  minutes?: number | null
  fallback?: string | null
}

const formatMinutes = (minutes?: number | null) => {
  if (!Number.isFinite(minutes ?? null)) return ''
  const rounded = Math.max(1, Math.round(minutes as number))
  return `${rounded} min`
}

export const buildWorkoutDisplayName = ({
  focus,
  style,
  minutes,
  fallback
}: WorkoutNamingInput) => {
  const parts: string[] = []
  if (focus) parts.push(formatFocusLabel(focus))
  const styleLabel = formatGoalLabel(style)
  if (styleLabel) parts.push(styleLabel)
  const minutesLabel = formatMinutes(minutes)
  if (minutesLabel) parts.push(minutesLabel)
  if (!parts.length) return fallback ?? ''
  return parts.join(' · ')
}
