import type { Exercise, MetricProfile, Goal } from '@/types/domain'

export const METRIC_PROFILES: { label: string; value: MetricProfile; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Sets × Reps × Load' },
  { value: 'timed_strength', label: 'Timed Strength', description: 'Isometric holds, carries, planks' },
  { value: 'cardio_session', label: 'Cardio Session', description: 'Time-based endurance' },
  { value: 'mobility_session', label: 'Yoga / Mobility Session', description: 'Time-based recovery' }
]

export const EXERCISE_GOALS: { label: string; value: Goal; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Default for power/force focus (1-6 reps)' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Default for muscle growth (8-12 reps)' },
  { value: 'endurance', label: 'Endurance', description: 'Default for conditioning/high volume (15+ reps)' },
  { value: 'range_of_motion', label: 'Range of Motion', description: 'Default for mobility/yoga' }
]

export const FOCUS_AREAS = [
  { value: 'upper', label: 'Upper Body' },
  { value: 'lower', label: 'Lower Body' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' }
]

export const EQUIPMENT_OPTIONS = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' }
]

export function validateExercise(exercise: Partial<Exercise>): string[] {
  const errors: string[] = []

  if (!exercise.name?.trim()) {
    errors.push('Name is required')
  }

  if (!exercise.primaryMuscle) {
    errors.push('Primary muscle is required')
  }

  if (!exercise.focus) {
    errors.push('Focus area is required')
  }

  if (!exercise.goal) {
    errors.push('Goal is required')
  }

  return errors
}

export function getConstraintForProfile(profile?: MetricProfile) {
  switch (profile) {
    case 'cardio_session':
    case 'mobility_session':
      return {
        requiresDuration: true,
        requiresReps: false,
        allowLoad: false,
        defaultRpeRange: [3, 7]
      }
    case 'timed_strength':
      return {
        requiresDuration: true,
        requiresReps: false, // Duration serves as reps
        allowLoad: true,
        defaultRpeRange: [6, 9]
      }
    case 'strength':
    default:
      return {
        requiresDuration: false,
        requiresReps: true,
        allowLoad: true,
        defaultRpeRange: [6, 10]
      }
  }
}
