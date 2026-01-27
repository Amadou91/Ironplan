import type { Exercise, MetricProfile, Goal } from '@/types/domain'

export const METRIC_PROFILES: { label: string; value: MetricProfile; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Sets × Reps × Load (RPE aware)' },
  { value: 'timed_strength', label: 'Timed Strength', description: 'Isometric holds, carries, planks' },
  { value: 'cardio_session', label: 'Cardio Session', description: 'Time-based endurance' },
  { value: 'mobility_session', label: 'Yoga / Mobility Session', description: 'Time-based, recovery focused' }
]

export const EXERCISE_GOALS: { label: string; value: Goal; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Maximize force production' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Muscle growth focus' },
  { value: 'endurance', label: 'Endurance', description: 'Sustained effort' },
  { value: 'range_of_motion', label: 'Range of Motion', description: 'Flexibility and mobility' }
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

  // Metric Profile Validation
  if (exercise.metricProfile === 'cardio_session' || exercise.metricProfile === 'mobility_session') {
    if (!exercise.durationMinutes || exercise.durationMinutes <= 0) {
      errors.push('Duration is required for time-based profiles')
    }
  } else {
    // Strength / Hypertrophy
    if (!exercise.sets || exercise.sets <= 0) {
      errors.push('Default sets must be greater than 0')
    }
    if (!exercise.reps) {
      errors.push('Default rep range is required')
    }
    if (!exercise.rpe || exercise.rpe < 1 || exercise.rpe > 10) {
      errors.push('Target RPE must be between 1 and 10')
    }
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
