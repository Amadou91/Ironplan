import type { FocusArea, PlanInput } from '@/types/domain'
import { formatFocusLabel, formatGoalLabel } from '@/lib/workout-metrics'

type WorkoutNamingInput = {
  focus?: FocusArea | null
  focusAreas?: FocusArea[] | null
  style?: string | null
  intensity?: PlanInput['intensity'] | null
  minutes?: number | null
  fallback?: string | null
  cardioExerciseName?: string | null
}

type TemplateNamingInput = {
  focus?: FocusArea | null
  fallback?: string | null
  cardioExerciseName?: string | null
}

const formatMinutes = (minutes?: number | null) => {
  if (!Number.isFinite(minutes ?? null)) return ''
  const rounded = Math.max(1, Math.round(minutes as number))
  return `${rounded} min`
}

const formatFocusAreas = (focus?: FocusArea | null, focusAreas?: FocusArea[] | null) => {
  const source = focusAreas?.length ? focusAreas : focus ? [focus] : []
  if (!source.length) return ''

  const labels = Array.from(new Set(source.map((item) => formatFocusLabel(item))))
  if (labels.length <= 1) return labels[0] ?? ''
  return labels.join(' + ')
}

/**
 * Builds a display name for templates/plans.
 * Templates represent reusable structure and should stay neutral (no training style).
 * Format: Focus Area only (e.g., "Arms", "Cardio", "Yoga / Mobility")
 */
export const buildTemplateDisplayName = ({
  focus,
  fallback,
  cardioExerciseName
}: TemplateNamingInput) => {
  // Special cases for Yoga and Cardio
  if (focus === 'mobility') {
    return 'Yoga / Mobility'
  }
  if (focus === 'cardio') {
    if (cardioExerciseName) {
      return `Cardio ${cardioExerciseName}`
    }
    return 'Cardio'
  }
  
  const focusLabel = focus ? formatFocusLabel(focus) : null
  return focusLabel || fallback || ''
}

/**
 * Builds a display name for workout sessions.
 * Sessions represent execution and include the selected training style for context.
 * Format: Focus Area · Style · Duration (e.g., "Arms · Strength · 45 min")
 */
export const buildWorkoutDisplayName = ({
  focus,
  focusAreas,
  style,
  minutes,
  fallback,
  cardioExerciseName
}: WorkoutNamingInput) => {
  const parts: string[] = []
  const styleLabel = formatGoalLabel(style)
  
  // Special cases for Yoga and Cardio to avoid redundancy
  if (style === 'mobility' || style === 'range_of_motion') {
     parts.push('Yoga / Mobility')
  } else if (style === 'cardio') {
     if (cardioExerciseName) {
       parts.push(`Cardio ${cardioExerciseName}`)
     } else {
       parts.push('Cardio')
     }
  } else {
    // Standard format: "[Focus] · [Style]"
    const focusLabel = formatFocusAreas(focus, focusAreas) || null
    
    if (focusLabel) parts.push(focusLabel)
    
    // Add style as a separate segment (not joined with focus)
    if (styleLabel && 
        styleLabel !== focusLabel && 
        !focusLabel?.toLowerCase().includes(styleLabel.toLowerCase()) &&
        !styleLabel.toLowerCase().includes(focusLabel?.toLowerCase() || '')) {
      parts.push(styleLabel)
    }
  }
  
  const minutesLabel = formatMinutes(minutes)
  if (minutesLabel) parts.push(minutesLabel)
  
  if (!parts.length) return fallback ?? ''
  return parts.join(' · ')
}

/**
 * Strips the planned duration suffix (e.g., " · 45 min") from a session name.
 * Used for completed sessions where actual duration should be shown instead.
 */
export const stripPlannedDuration = (name: string): string => {
  // Match patterns like " · 45 min" or " · 120 min" at end of string
  return name.replace(/\s*·\s*\d+\s*min$/i, '')
}

/**
 * Formats a session title for display by replacing planned duration with actual duration.
 * For completed sessions, this shows the real elapsed time instead of the intended time.
 */
export const formatSessionDisplayTitle = (
  name: string,
  startedAt?: string | null,
  endedAt?: string | null
): string => {
  const baseName = stripPlannedDuration(name)
  
  if (startedAt && endedAt) {
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const durationMinutes = Math.round((end - start) / 60000)
      return `${baseName} · ${durationMinutes} min`
    }
  }
  
  return baseName
}
