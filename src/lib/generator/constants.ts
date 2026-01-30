import type { PlanInput, FocusArea, FocusConstraint } from '@/types/domain'
import { equipmentPresets } from '@/lib/equipment'

export const DEFAULT_INPUT: PlanInput = {
  intent: {
    mode: 'body_part',
    style: 'strength',
    bodyParts: ['chest']
  },
  goals: {
    primary: 'strength',
    priority: 'primary'
  },
  experienceLevel: 'intermediate',
  intensity: 'moderate',
  equipment: {
    preset: 'custom',
    inventory: equipmentPresets.custom
  },
  time: {
    minutesPerSession: 45
  },
  schedule: {
    daysAvailable: [0],
    minRestDays: 1,
    weeklyLayout: [
      { sessionIndex: 0, style: 'strength', focus: 'chest' }
    ]
  },
  preferences: {
    focusAreas: ['chest'],
    dislikedActivities: [],
    cardioActivities: [],
    accessibilityConstraints: [],
    restPreference: 'balanced'
  }
}

export const focusMuscleMap: Record<
  FocusArea,
  { primaryMuscles?: string[]; baseFocus?: FocusArea; constraint?: FocusConstraint }
> = {
  arms: {
    primaryMuscles: ['biceps', 'triceps', 'forearms', 'shoulders'],
    baseFocus: 'upper'
  },
  legs: {
    primaryMuscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'hip_flexors'],
    baseFocus: 'lower'
  },
  biceps: { primaryMuscles: ['biceps'], baseFocus: 'upper' },
  triceps: { primaryMuscles: ['triceps'], baseFocus: 'upper' },
  chest: { primaryMuscles: ['chest'], baseFocus: 'upper' },
  back: { primaryMuscles: ['back'], baseFocus: 'upper' },
  shoulders: { primaryMuscles: ['shoulders'], baseFocus: 'upper' },
  upper: {},
  lower: {},
  full_body: {},
  core: {},
  cardio: {},
  mobility: {}
}

export const focusAccessoryMap: Partial<Record<FocusArea, string[]>> = {
  chest: ['triceps', 'shoulders'],
  back: ['biceps', 'forearms'],
  biceps: ['forearms'],
  triceps: ['shoulders'],
  legs: ['core']
}

export const bandLoadMap: Record<string, number> = {
  light: 10,
  medium: 20,
  heavy: 30
}
