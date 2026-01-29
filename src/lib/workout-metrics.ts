import type { FocusArea, PlanDay, WorkoutSession, MetricProfile } from '@/types/domain'
import { computeSetLoad, type MetricsSet } from '@/lib/session-metrics'
import { computeSessionMetrics } from '@/lib/training-metrics'

type ExerciseMetricsInput = {
  sets?: number
  reps?: string | number
  rpe?: number
  durationMinutes?: number
  restSeconds?: number
  loadTarget?: number
  metricProfile?: MetricProfile
}

const toTitleCase = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const focusLabelMap: Record<FocusArea, string> = {
  upper: 'Upper Body',
  lower: 'Lower Body',
  full_body: 'Full Body',
  core: 'Core',
  cardio: 'Conditioning',
  mobility: 'Yoga / Mobility',
  arms: 'Arms',
  legs: 'Legs',
  biceps: 'Biceps',
  triceps: 'Triceps',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders'
}

const goalLabelMap: Record<string, string> = {
  cardio: 'Conditioning',
  range_of_motion: 'Mobility & Flexibility'
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

const parseReps = (reps: ExerciseMetricsInput['reps']): number => {
  if (typeof reps === 'number' && Number.isFinite(reps)) return reps
  if (typeof reps !== 'string') return 10 // Default fallback for prediction
  const matches = reps.match(/\d+/g)
  if (!matches?.length) return 10
  const numbers = matches.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
  if (!numbers.length) return 10
  if (numbers.length === 1) return numbers[0]
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

/**

 * Predicts the impact of an exercise based on its prescription.

 * Uses the same `computeSetLoad` logic as actual session metrics.

 */

export const computeExerciseMetrics = (exercise: ExerciseMetricsInput) => {

  const repsValue = parseReps(exercise.reps)

  const setsCount = exercise.sets ?? 3

  // Keep loadTarget as LBS (internal standard for library data)

  const weightLbs = exercise.loadTarget ?? 0

  

  // Construct a "Predicted Set"

  const predictedSet: MetricsSet = {

    metricProfile: exercise.metricProfile ?? 'reps_weight',

    reps: repsValue,

    weight: weightLbs,

    weightUnit: 'lb',

    rpe: exercise.rpe ?? 7,

    completed: true,

    durationSeconds: exercise.durationMinutes ? exercise.durationMinutes * 60 : undefined

  }



  const setLoad = computeSetLoad(predictedSet)

  const totalLoad = setLoad * setsCount

  

  // Volume in LB

  const volume = (weightLbs * repsValue) * setsCount

  

  // Estimate time for density

  const estimatedMinutes =

    exercise.durationMinutes ??

    (exercise.restSeconds && setsCount ? (exercise.restSeconds * setsCount) / 60 : setsCount * 2)

  

  const density = estimatedMinutes > 0 ? volume / estimatedMinutes : 0



  return {

    volume, // LB

    intensity: exercise.rpe ?? 0,

    density,

    workload: totalLoad

  }

}



const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)



export const calculateSessionImpactFromSets = (

  session: WorkoutSession,

  endedAt?: string | null

) => {

  const sets = session.exercises.flatMap((exercise) =>

    exercise.sets

      .filter((set) => set.completed)

      .map((set) => ({ ...set, metricProfile: exercise.metricProfile }))

  )



  if (!sets.length) return null



  const metrics = computeSessionMetrics({

    startedAt: session.startedAt,

    endedAt: endedAt ?? session.endedAt,

    sets: sets.map((set) => ({

      reps: isNumber(set.reps) ? set.reps : null,

      weight: isNumber(set.weight) ? set.weight : null,

      implementCount: typeof set.implementCount === 'number' ? set.implementCount : null,

      loadType: (set.loadType as 'total' | 'per_implement' | null) ?? null,

      rpe: isNumber(set.rpe) ? set.rpe : null,

      rir: isNumber(set.rir) ? set.rir : null,

      failure: false,

      setType: null,

      performedAt: set.performedAt ?? null,

      weightUnit: set.weightUnit ?? null,

      durationSeconds: isNumber(set.durationSeconds) ? set.durationSeconds : null,

      metricProfile: set.metricProfile

    }))

  })



  // Unified Impact Score (Workload)

  // Scaling down by 10 to provide a readable "Score" (e.g., 150 instead of 1500)

  const score = Math.round(metrics.workload / 10)



  return {

    score,

    breakdown: {

      volume: Math.round(metrics.tonnage), // LB

      intensity: Math.round((metrics.avgEffort ?? 0) * 10), // Scaled 0-100 for display

      density: Math.round(metrics.density ?? 0)

    }

  }

}
