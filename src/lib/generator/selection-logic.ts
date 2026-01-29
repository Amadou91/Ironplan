import type {
  Exercise,
  FocusArea,
  Goal,
  EquipmentInventory,
  ExerciseSource,
  PlannedExercise,
  PlanInput
} from '@/types/domain'
import {
  normalizeExerciseKey,
  getPrimaryMuscleKey,
  getMovementFamily,
  selectEquipmentOption,
  isExerciseEquipmentSatisfied
} from './utils'
import {
  getIntensityScore
} from './scoring'

/**
 * Narrow down the exercise catalog to a valid pool for the current session.
 * 
 * Filters applied:
 * 1. Focus: Ensures exercise aligns with target body part or session type.
 * 2. Equipment: Strictly enforces the user's available inventory.
 * 3. User Preferences: Removes disliked activities or high-impact moves if constrained.
 * 4. Goal Alignment: Special handling for Cardio vs Yoga vs Strength goals.
 */
export const filterExercises = (
  catalog: Exercise[],
  focus: FocusArea,
  inventory: EquipmentInventory,
  disliked: string[],
  accessibility: string[],
  goal?: Goal
) => catalog.filter(exercise => {
  // 1. Focus Mapping (User Input -> DB Fields)
  let matchesFocus = false
  
  if (focus === 'mobility') {
    matchesFocus = exercise.category === 'Mobility'
  } else if (focus === 'cardio') {
    matchesFocus = exercise.category === 'Cardio'
  } else if (focus === 'full_body') {
    matchesFocus = true
  } else if (exercise.category === 'Strength') {
    // Strength Category: Check Muscle Mapping
    const primary = exercise.primaryMuscle?.toLowerCase() || ''
    
    switch (focus) {
      case 'legs':
      case 'lower': // Backward compat
        matchesFocus = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'hip_flexors'].includes(primary)
        break
      case 'arms':
        matchesFocus = ['biceps', 'triceps', 'forearms'].includes(primary)
        break
      case 'chest':
      case 'back':
      case 'shoulders':
      case 'core':
        matchesFocus = primary === focus
        break
      case 'upper': // Backward compat
         matchesFocus = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'].includes(primary)
         break
      default:
        matchesFocus = false
    }
  }

  // 2. Equipment Check - evaluates OR-groups and AND requirements
  const hasEquipment = isExerciseEquipmentSatisfied(inventory, exercise)
  
  // 3. Preferences
  const isDisliked = disliked.some(activity => exercise.name.toLowerCase().includes(activity.toLowerCase()))
  const lowImpact = accessibility.includes('low-impact')
  const isHighImpact = exercise.name.toLowerCase().includes('jump') || exercise.name.toLowerCase().includes('interval')

  // 4. Goal Alignment (Softened for Option B)
  let matchesGoal = true
  if (goal) {
    // Fundamental Category Mismatches
    if (exercise.category === 'Cardio' && (goal !== 'endurance' && goal !== 'cardio' && goal !== 'general_fitness')) {
      matchesGoal = false
    }
    else if (exercise.category === 'Mobility' && (goal !== 'range_of_motion' && focus !== 'mobility')) {
      matchesGoal = false
    }
    // Strength exercises are versatile and can be used for any strength/hypertrophy/endurance goal.
    // We only hard-filter if it's explicitly NOT eligible (which is rare).
    else if (exercise.category === 'Strength' && (goal === 'cardio' || goal === 'range_of_motion')) {
      matchesGoal = false
    }
    // Otherwise, we allow it but will score it based on alignment in scoreExercise
  }

  return matchesFocus && matchesGoal && hasEquipment && !isDisliked && !(lowImpact && isHighImpact)
})

/**
 * Ranks exercises for selection based on multiple factors.
 * 
 * Scoring components:
 * 1. Freshness: Penalizes exercises performed very recently (-3).
 * 2. Muscle/Pattern Variety: Penalizes repeating the same primary muscle or pattern (-1).
 * 3. Profile Match: Bonus for exercises matching the session intensity.
 * 4. Goal Alignment: Bonus for exercises that natively match the session goal.
 * 5. Source Priority: Bonus for exercises that are 'primary' for the session focus.
 */
export const scoreExercise = (
  exercise: Exercise,
  source: ExerciseSource,
  input: Pick<PlanInput, 'experienceLevel' | 'intensity' | 'goals'>,
  history: {
    recentNames: Set<string>
    recentPatterns: Set<string>
    recentPrimaryMuscles: Set<string>
    recentFamilies: Set<string | null>
  },
  goalOverride?: Goal
) => {
  let score = 0
  const targetGoal = goalOverride ?? input.goals.primary

  const nameKey = normalizeExerciseKey(exercise.name)
  if (history.recentNames.has(nameKey)) score -= 3
  if (!history.recentNames.has(nameKey)) score += 2
  if (exercise.movementPattern && history.recentPatterns.has(exercise.movementPattern)) score -= 1
  const primaryKey = getPrimaryMuscleKey(exercise)
  if (primaryKey && history.recentPrimaryMuscles.has(primaryKey)) score -= 1
  const family = getMovementFamily(exercise)
  if (family && history.recentFamilies.has(family)) score -= 1
  if (family && !history.recentFamilies.has(family)) score += 0.5
  
  // Goal Alignment Bonus
  // Strength exercises are versatile, so they get a baseline bonus for any strength-related goal.
  if (exercise.category === 'Strength' && (targetGoal === 'strength' || targetGoal === 'hypertrophy' || targetGoal === 'endurance')) {
    score += 1
  } else if (exercise.category === 'Cardio' && targetGoal === 'endurance') {
    score += 1
  } else if (exercise.category === 'Mobility' && targetGoal === 'range_of_motion') {
    score += 1
  } else if (targetGoal === 'general_fitness') {
    score += 0.5
  }

  score += getIntensityScore(exercise, input.intensity)
  if (source === 'primary') score += 1
  return score
}

/**
 * Sorts a pool of exercises by their calculated score, with a small random factor.
 */
export const orderPool = (
  pool: Exercise[],
  source: ExerciseSource,
  input: Pick<PlanInput, 'experienceLevel' | 'intensity' | 'goals'>,
  history: {
    recentNames: Set<string>
    recentPatterns: Set<string>
    recentPrimaryMuscles: Set<string>
    recentFamilies: Set<string | null>
  },
  rng: () => number,
  goalOverride?: Goal
) =>
  pool
    .map((exercise) => ({
      exercise,
      score: scoreExercise(exercise, source, input, history, goalOverride) + rng() * 0.2
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.exercise)

/**
 * Final pass to reorder exercises for a better workout flow.
 * 
 * Rules:
 * - Avoid adjacent exercises with the same movement pattern (e.g., two heavy pushes).
 * - Avoid adjacent exercises targeting the same primary muscle.
 * - Prioritize variety in movement "families" (e.g., rotate between press, squat, pull).
 */
export const reorderForVariety = (
  picks: PlannedExercise[],
  rng: () => number,
  input: Pick<PlanInput, 'experienceLevel' | 'intensity' | 'goals'>,
  history: {
    recentNames: Set<string>
    recentPatterns: Set<string>
    recentPrimaryMuscles: Set<string>
    recentFamilies: Set<string | null>
  },
  goalOverride?: Goal
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
      const itemScore = scoreExercise(item.exercise, item.source, input, history, goalOverride) + rng() * 0.1
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
