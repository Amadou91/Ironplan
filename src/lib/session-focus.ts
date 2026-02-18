import type { FocusArea } from '@/types/domain'

export type ArmFocusArea = Extract<FocusArea, 'biceps' | 'triceps'>

export const SESSION_FOCUS_OPTIONS: Array<{ value: FocusArea; label: string }> = [
  { value: 'upper', label: 'Upper Body' },
  { value: 'lower', label: 'Lower Body' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Yoga / Mobility' }
]

export const SESSION_FOCUS_SELECTION_OPTIONS = SESSION_FOCUS_OPTIONS.filter((option) =>
  ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'mobility'].includes(option.value)
)

export const SESSION_ARM_FOCUS_OPTIONS: Array<{ value: ArmFocusArea; label: string }> = [
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' }
]

export const EXCLUSIVE_SESSION_FOCUS_AREAS: FocusArea[] = ['cardio', 'mobility']

export const isExclusiveSessionFocus = (focus: FocusArea) =>
  EXCLUSIVE_SESSION_FOCUS_AREAS.includes(focus)

const FOCUS_LOOKUP = new Set<FocusArea>(SESSION_FOCUS_OPTIONS.map((option) => option.value))

export const normalizeFocusAreas = (
  values: Array<FocusArea | string | null | undefined> | null | undefined,
  fallback: FocusArea = 'full_body'
): FocusArea[] => {
  if (!values?.length) {
    return [fallback]
  }

  const normalized = values
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    .filter((value): value is FocusArea => Boolean(value) && FOCUS_LOOKUP.has(value as FocusArea))

  if (!normalized.length) {
    return [fallback]
  }

  return Array.from(new Set(normalized))
}

/**
 * Enforces focus selection rules:
 * - Cardio OR Mobility are exclusive modes.
 * - Strength focus groups can be multi-selected together.
 */
export const resolveSessionFocusAreas = (
  values: Array<FocusArea | string | null | undefined> | null | undefined,
  fallback: FocusArea = 'full_body'
): FocusArea[] => {
  const normalized = normalizeFocusAreas(values, fallback)
  const strengthFocuses = normalized.filter((focus) => !isExclusiveSessionFocus(focus))
  const exclusive = normalized.find((focus) => isExclusiveSessionFocus(focus))

  if (exclusive) {
    return [exclusive]
  }

  if (strengthFocuses.length) {
    return strengthFocuses
  }

  return [fallback]
}

export const toggleSessionFocusSelection = (current: FocusArea[], next: FocusArea): FocusArea[] => {
  const normalizedCurrent = resolveSessionFocusAreas(current, 'chest')

  if (isExclusiveSessionFocus(next)) {
    return [next]
  }

  const strengthCurrent = normalizedCurrent.filter((focus) => !isExclusiveSessionFocus(focus))
  if (strengthCurrent.includes(next)) {
    return strengthCurrent.filter((focus) => focus !== next)
  }

  return [...strengthCurrent, next]
}

export const getPrimaryFocusArea = (
  focusAreas: Array<FocusArea | string | null | undefined> | null | undefined,
  fallback: FocusArea = 'full_body'
): FocusArea => {
  return resolveSessionFocusAreas(focusAreas, fallback)[0]
}

export const formatFocusAreasLabel = (
  focusAreas: FocusArea[],
  formatter: (focus: FocusArea) => string
): string => {
  if (!focusAreas.length) return formatter('full_body')
  if (focusAreas.length === 1) return formatter(focusAreas[0])
  return focusAreas.map((focus) => formatter(focus)).join(' + ')
}

export const resolveArmFocusTargets = (
  focusAreas: Array<FocusArea | string | null | undefined>,
  armTargets: Array<ArmFocusArea | string | null | undefined>
): FocusArea[] => {
  const normalizedFocus = resolveSessionFocusAreas(focusAreas)
  if (!normalizedFocus.includes('arms')) {
    return normalizedFocus
  }

  const normalizedTargets = Array.from(
    new Set(
      armTargets
        .map((target) => (typeof target === 'string' ? target.trim().toLowerCase() : target))
        .filter((target): target is ArmFocusArea => target === 'biceps' || target === 'triceps')
    )
  )

  if (!normalizedTargets.length) {
    return normalizedFocus
  }

  return normalizedFocus.flatMap((focus) => (focus === 'arms' ? normalizedTargets : [focus]))
}
