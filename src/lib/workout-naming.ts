import type { FocusArea, PlanInput } from '@/types/domain'
import { formatFocusLabel, formatGoalLabel } from '@/lib/workout-metrics'

type WorkoutNamingInput = {
  focus?: FocusArea | null
  style?: string | null
  intensity?: PlanInput['intensity'] | null
  minutes?: number | null
  fallback?: string | null
  cardioExerciseName?: string | null
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
  fallback,
  cardioExerciseName
}: WorkoutNamingInput) => {
  const parts: string[] = []
  const styleLabel = formatGoalLabel(style)
  
  // Special cases for Yoga and Cardio to avoid redundancy
  if (style === 'mobility') {
     parts.push('Yoga')
  } else if (style === 'cardio') {
     if (cardioExerciseName) {
       parts.push(`Cardio ${cardioExerciseName}`)
     } else {
       parts.push('Cardio')
     }
  } else {
    // Standard format: "[Focus] [Style]"
    const focusLabel = focus ? formatFocusLabel(focus) : null
    const nameParts = []
    if (focusLabel) nameParts.push(focusLabel)
    if (styleLabel && styleLabel !== focusLabel) nameParts.push(styleLabel)
    if (nameParts.length > 0) parts.push(nameParts.join(' '))
  }
  
  const minutesLabel = formatMinutes(minutes)
  if (minutesLabel) parts.push(minutesLabel)
  
  if (!parts.length) return fallback ?? ''
  return parts.join(' · ')
}
