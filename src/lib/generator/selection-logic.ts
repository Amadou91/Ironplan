import type {
  Exercise,
  FocusArea,
  Goal,
  CardioActivity,
  EquipmentInventory,
  ExerciseSource,
  SessionHistory,
  FocusConstraint,
  PlannedExercise,
  PlanInput
} from '@/types/domain'
import { matchesCardioSelection } from '@/lib/cardio-activities'
import {
  EXERCISE_LIBRARY
} from './constants'
import {
  normalizeExerciseKey,
  getPrimaryMuscleKey,
  getMovementFamilyFromName,
  getMovementFamily,
  matchesFocusArea,
  selectEquipmentOption
} from './utils'
import {
  getExperienceScore,
  getIntensityScore
} from './scoring'

export const filterExercises = (
  focus: FocusArea,
  inventory: EquipmentInventory,
  disliked: string[],
  accessibility: string[],
  cardioActivities: CardioActivity[],
  goal?: Goal
) => EXERCISE_LIBRARY.filter(exercise => {
  const matchesFocus = matchesFocusArea(focus, exercise)
  const option = selectEquipmentOption(inventory, exercise.equipment)
  const isDisliked = disliked.some(activity => exercise.name.toLowerCase().includes(activity.toLowerCase()))
  const lowImpact = accessibility.includes('low-impact')
  const isHighImpact = exercise.name.toLowerCase().includes('jump') || exercise.name.toLowerCase().includes('interval')
  const matchesGoal = goal
    ? exercise.goal === goal || !exercise.goal || (goal === 'cardio' && exercise.goal === 'endurance')
    : true
  const matchesCardio = exercise.focus === 'cardio' ? matchesCardioSelection(exercise.name, cardioActivities) : true

  // Strict filter for Yoga/Mobility
  const isYogaOrMobility = exercise.goal === 'general_fitness' || exercise.focus === 'mobility'
  if (isYogaOrMobility && goal !== 'general_fitness') {
    return false
  }

  return matchesFocus && matchesGoal && matchesCardio && Boolean(option) && !isDisliked && !(lowImpact && isHighImpact)
})

export const scoreExercise = (
  exercise: Exercise,
  source: ExerciseSource,
  input: Pick<PlanInput, 'experienceLevel' | 'intensity'>,
  history: {
    recentNames: Set<string>
    recentPatterns: Set<string>
    recentPrimaryMuscles: Set<string>
    recentFamilies: Set<string | null>
  }
) => {
  let score = 0
  const nameKey = normalizeExerciseKey(exercise.name)
  if (history.recentNames.has(nameKey)) score -= 3
  if (!history.recentNames.has(nameKey)) score += 2
  if (exercise.movementPattern && history.recentPatterns.has(exercise.movementPattern)) score -= 1
  const primaryKey = getPrimaryMuscleKey(exercise)
  if (primaryKey && history.recentPrimaryMuscles.has(primaryKey)) score -= 1
  const family = getMovementFamily(exercise)
  if (family && history.recentFamilies.has(family)) score -= 1
  if (family && !history.recentFamilies.has(family)) score += 0.5
  score += getExperienceScore(exercise, input.experienceLevel)
  score += getIntensityScore(exercise, input.intensity)
  if (source === 'primary') score += 1
  return score
}

export const orderPool = (
  pool: Exercise[],
  source: ExerciseSource,
  input: Pick<PlanInput, 'experienceLevel' | 'intensity'>,
  history: {
    recentNames: Set<string>
    recentPatterns: Set<string>
    recentPrimaryMuscles: Set<string>
    recentFamilies: Set<string | null>
  },
  rng: () => number
) =>
  pool
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, source, input, history) + rng() * 0.2
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.exercise)

export const reorderForVariety = (
  picks: PlannedExercise[],
  rng: () => number,
  input: Pick<PlanInput, 'experienceLevel' | 'intensity'>,
  history: {
    recentNames: Set<string>
    recentPatterns: Set<string>
    recentPrimaryMuscles: Set<string>
    recentFamilies: Set<string | null>
  }
) => {
  const remaining = [...picks]
  const ordered: PlannedExercise[] = []

  const isAdjacentRepeat = (prev: PlannedExercise | undefined, next: PlannedExercise) => {
    if (!prev) return false
    const prevPattern = prev.exercise.movementPattern ?? null
    const nextPattern = next.exercise.movementPattern ?? null
    const prevPrimary = getPrimaryMuscleKey(prev.exercise)
    const nextPrimary = getPrimaryMuscleKey(next.exercise)
    const prevFamily = getMovementFamily(prev.exercise)
    const nextFamily = getMovementFamily(next.exercise)
    return Boolean(
      (prevPattern && nextPattern && prevPattern === nextPattern) ||
      (prevPrimary && nextPrimary && prevPrimary === nextPrimary) ||
      (prevFamily && nextFamily && prevFamily === nextFamily)
    )
  }

  while (remaining.length) {
    const previous = ordered[ordered.length - 1]
    const candidates = remaining.filter((item) => !isAdjacentRepeat(previous, item))
    const primaryVariedCandidates = remaining.filter((item) => {
      if (!previous) return true
      const prevPrimary = getPrimaryMuscleKey(previous.exercise)
      const nextPrimary = getPrimaryMuscleKey(item.exercise)
      return prevPrimary && nextPrimary && prevPrimary !== nextPrimary
    })
    const pickPool =
      candidates.length > 0
        ? candidates
        : primaryVariedCandidates.length > 0
          ? primaryVariedCandidates
          : remaining
    let best: PlannedExercise | null = null
    let bestScore = -Infinity
    pickPool.forEach((item) => {
      const itemScore = scoreExercise(item.exercise, item.source, input, history) + rng() * 0.1
      if (itemScore > bestScore) {
        bestScore = itemScore
        best = item
      }
    })
    const selected = best ?? pickPool[0]
    ordered.push(selected)
    const index = remaining.indexOf(selected)
    if (index >= 0) remaining.splice(index, 1)
  }

  return ordered
}
