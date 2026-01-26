import type {
  Exercise,
  FocusArea,
  Goal,
  WorkoutTemplateDraft,
  GeneratedPlan,
  PlanInput,
  SessionHistory,
  FocusConstraint,
  PlannedExercise,
  ExerciseSource
} from '@/types/domain'
import { logEvent } from '@/lib/logger'
import {
  focusMuscleMap
} from './constants'
import {
  clamp,
  createSeededRandom,
  normalizeExerciseKey,
  getPrimaryMuscleKey,
  getMovementFamilyFromName,
  getMovementFamily,
  matchesPrimaryMuscle,
  selectEquipmentOption,
  estimateExerciseMinutes,
  buildSessionName,
  buildRationale,
  buildPlanTitle,
  buildFocusDistribution,
  calculateWorkoutImpact,
  buildFocusSequence,
  formatFocusLabel
} from './utils'
import {
  deriveReps,
  getIntensityRestModifier,
  getExerciseCaps,
  getSetCaps,
  getFamilyCaps,
  getRestModifier
} from './scoring'
import {
  validatePlanInput,
  normalizePlanInput,
  applyRestPreference,
  adjustMinutesPerSession
} from './validation'
import { filterExercises, orderPool, reorderForVariety } from './selection-logic'
import { createPlannedExercise, adjustSessionVolume } from './volume-math'

/**
 * Core generation logic for a single training session.
 * 
 * SEMANTICS OF PRESCRIPTIONS:
 * The 'sets', 'reps', and 'rpe' values from the exercise catalog are treated as
 * MODERATE INTENSITY BASELINES. 
 * 
 * During generation, these are adjusted by:
 * 1. Session Intensity: Low intensity reduces RPE/Sets, High intensity increases them.
 * 2. User Experience: Beginners get lower volume, Advanced users get higher volume.
 * 3. Time Constraints: If a session is running long, sets are reduced starting from 
 *    accessory movements to fit the target duration.
 * 4. Session Goal: Rep ranges are derived primarily from the goal (Strength/Hypertrophy/Endurance).
 * 
 * Once a session is generated, these prescriptions are RECOMMENDATIONS. Users can
 * always adjust them during workout execution.
 */
const buildSessionForTime = (
  primaryPool: Exercise[],
  secondaryPool: Exercise[],
  accessoryPool: Exercise[],
  input: PlanInput,
  duration: number,
  goal: Goal,
  focusConstraint?: FocusConstraint | null,
  history?: SessionHistory,
  seed?: string
): { exercises: Exercise[]; error?: string } => {
  const targetMinutes = clamp(duration, 20, 120)
  const reps = deriveReps(goal, input.intensity)
  let { min: minExercises, max: maxExercises } = getExerciseCaps(targetMinutes)
  const { min: minSetCap, max: maxSetCap } = getSetCaps(targetMinutes)
  const restModifier = getRestModifier(targetMinutes, input.preferences.restPreference) * getIntensityRestModifier(input.intensity)
  const picks: PlannedExercise[] = []
  const usedPatterns = new Map<string, number>()
  const usedNames = new Set<string>()
  const usedFamilies = new Map<string, number>()
  const rng = createSeededRandom(seed ?? `${input.goals.primary}-${targetMinutes}`)

  const hist = {
    recentNames: new Set((history?.recentExerciseNames ?? []).map(normalizeExerciseKey)),
    recentPatterns: new Set((history?.recentMovementPatterns ?? []).filter(Boolean)),
    recentPrimaryMuscles: new Set(
      (history?.recentPrimaryMuscles ?? []).map((muscle) => muscle.trim().toLowerCase())
    ),
    recentFamilies: new Set(
      (history?.recentExerciseNames ?? []).map((name) => getMovementFamilyFromName(name))
    )
  }

  const isPrimaryMatch = (exercise: Exercise) =>
    focusConstraint ? matchesPrimaryMuscle(exercise, focusConstraint.primaryMuscles) : false
  const isAccessoryMatch = (exercise: Exercise) =>
    focusConstraint ? matchesPrimaryMuscle(exercise, focusConstraint.accessoryMuscles) : false
  const isAllowedFocusExercise = (exercise: Exercise) =>
    focusConstraint ? (isPrimaryMatch(exercise) || isAccessoryMatch(exercise)) : true

  const availableExerciseCount = new Set(
    [...primaryPool, ...secondaryPool, ...accessoryPool]
      .filter((exercise) => isAllowedFocusExercise(exercise))
      .filter((exercise) => selectEquipmentOption(input.equipment.inventory, exercise.equipment))
      .map((exercise) => exercise.name)
  ).size

  if (availableExerciseCount > 0) {
    minExercises = Math.min(minExercises, availableExerciseCount)
    maxExercises = Math.min(maxExercises, availableExerciseCount)
  }

  const availableFamilies = new Set(
    [...primaryPool, ...secondaryPool, ...accessoryPool]
      .filter((exercise) => isAllowedFocusExercise(exercise))
      .map((exercise) => getMovementFamily(exercise))
      .filter(Boolean)
  )
  const familyCap = getFamilyCaps(targetMinutes)

  const getSetTotals = (extra?: PlannedExercise) => {
    const all = extra ? [...picks, extra] : picks
    const totals = all.reduce(
      (acc, item) => {
        acc.total += item.prescription.sets
        if (isPrimaryMatch(item.exercise)) acc.primary += item.prescription.sets
        return acc
      },
      { primary: 0, total: 0 }
    )
    return totals
  }

  const canMeetPrimaryRatio = (extra?: PlannedExercise) => {
    if (!focusConstraint) return true
    const all = extra ? [...picks, extra] : picks
    const maxPrimarySets = all.reduce((sum, item) =>
      isPrimaryMatch(item.exercise) ? sum + item.maxSets : sum
    , 0)
    const nonPrimarySets = all.reduce((sum, item) =>
      isPrimaryMatch(item.exercise) ? sum : sum + item.prescription.sets
    , 0)
    const potentialTotal = maxPrimarySets + nonPrimarySets
    if (potentialTotal === 0) return false
    return maxPrimarySets / potentialTotal >= focusConstraint.minPrimarySetRatio
  }

  const canAdd = (exercise: Exercise, source: ExerciseSource, currentMinutes: number) => {
    const allowDuplicatePrimary = focusConstraint && isPrimaryMatch(exercise) && primaryPool.length < minExercises
    if (picks.length >= maxExercises || (!allowDuplicatePrimary && usedNames.has(exercise.name))) return false
    const pattern = exercise.movementPattern ?? 'accessory'
    const lastPick = picks[picks.length - 1]
    const lastPattern = lastPick?.exercise.movementPattern ?? null
    const lastPrimary = lastPick ? getPrimaryMuscleKey(lastPick.exercise) : null
    const nextPrimary = getPrimaryMuscleKey(exercise)
    const isAdjacentRepeat = Boolean(
      lastPick && ((lastPattern && lastPattern === pattern) || (lastPrimary && lastPrimary === nextPrimary))
    )
    if (isAdjacentRepeat && picks.length >= minExercises) return false
    const maxPatternUsage = focusConstraint ? 4 : 2
    if ((usedPatterns.get(pattern) ?? 0) >= maxPatternUsage) return false
    const family = getMovementFamily(exercise)
    if (family) {
      const currentFamilyCount = usedFamilies.get(family) ?? 0
      if (currentFamilyCount >= familyCap && availableFamilies.size > 1 && picks.length >= minExercises - 1) {
        return false
      }
    }
    const planned = createPlannedExercise(exercise, source, input, targetMinutes, minSetCap, maxSetCap, restModifier, reps, goal)
    if (!planned) return false
    if (focusConstraint && !isAllowedFocusExercise(exercise)) return false
    if (focusConstraint && !isPrimaryMatch(exercise)) {
      const totals = getSetTotals(planned)
      const ratio = totals.total > 0 ? totals.primary / totals.total : 0
      if (ratio < focusConstraint.minPrimarySetRatio && !canMeetPrimaryRatio(planned)) return false
    }
    if (currentMinutes + planned.estimatedMinutes > targetMinutes + 6 && picks.length >= minExercises) {
      return false
    }
    picks.push(planned)
    usedNames.add(exercise.name)
    usedPatterns.set(pattern, (usedPatterns.get(pattern) ?? 0) + 1)
    if (family) {
      usedFamilies.set(family, (usedFamilies.get(family) ?? 0) + 1)
    }
    return true
  }

  const seedPool = primaryPool.length ? primaryPool : secondaryPool
  const seedSource: ExerciseSource = primaryPool.length ? 'primary' : 'secondary'
  const sortedSeed = orderPool(seedPool, seedSource, input, hist, rng)
  let totalMinutes = 0
  sortedSeed.some((exercise) => {
    const added = canAdd(exercise, primaryPool.includes(exercise) ? 'primary' : 'secondary', totalMinutes)
    if (added) {
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
    }
    return added
  })

  const fillPools: Array<{ source: ExerciseSource; pool: Exercise[] }> = [
    { source: 'secondary', pool: secondaryPool },
    { source: 'accessory', pool: accessoryPool },
    ...(focusConstraint ? [] : [{ source: 'secondary' as ExerciseSource, pool: [...primaryPool, ...secondaryPool, ...accessoryPool] }])
  ]

  fillPools.forEach(({ source, pool }) => {
    const orderedPool = orderPool(pool, source, input, hist, rng)
    for (const exercise of orderedPool) {
      if (picks.length >= minExercises) break
      if (canAdd(exercise, source, totalMinutes)) {
        totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      }
    }
  })

  totalMinutes = adjustSessionVolume(picks, targetMinutes, goal, input.equipment.inventory, 'decrease')
  totalMinutes = adjustSessionVolume(picks, targetMinutes, goal, input.equipment.inventory, 'increase')

  if (focusConstraint) {
    let ratioCheck = getSetTotals()
    let ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
    let ratioCounter = 0
    while (ratio < focusConstraint.minPrimarySetRatio && ratioCounter < 200) {
      const planned = picks.find((item) => isPrimaryMatch(item.exercise) && item.prescription.sets < item.maxSets)
      if (!planned) break
      planned.prescription.sets += 1
      const selectedOption = selectEquipmentOption(input.equipment.inventory, planned.exercise.equipment)
      planned.estimatedMinutes = estimateExerciseMinutes(planned.exercise, planned.prescription, selectedOption, goal)
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      ratioCheck = getSetTotals()
      ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
      ratioCounter += 1
    }
  }

  const orderedAccessoryPool = orderPool(accessoryPool, 'accessory', input, hist, rng)
  for (const exercise of orderedAccessoryPool) {
    if (picks.length >= maxExercises || totalMinutes >= targetMinutes - 5) break
    if (canAdd(exercise, 'accessory', totalMinutes)) {
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
    }
  }

  let focusConstraintRelaxed = false
  if (focusConstraint) {
    const totals = getSetTotals()
    const ratio = totals.total > 0 ? totals.primary / totals.total : 0
    if (totals.total === 0) {
      return { exercises: [], error: 'focus_constraints_unmet' }
    }
    if (ratio < focusConstraint.minPrimarySetRatio || picks.length < minExercises) {
      focusConstraintRelaxed = true
    }
  }

  const orderedPicks = reorderForVariety(picks, rng, input, hist)
  return {
    exercises: orderedPicks.map(({ exercise, prescription }) => ({
      ...exercise,
      ...prescription
    })),
    error: focusConstraintRelaxed ? 'focus_constraints_relaxed' : undefined
  }
}

export const buildSessionExercises = (
  catalog: Exercise[],
  focus: FocusArea,
  duration: number,
  input: PlanInput,
  goalOverride?: Goal,
  history?: SessionHistory,
  seed?: string
): { exercises: Exercise[]; error?: string } => {
  const targetGoal = goalOverride ?? input.goals.primary
  const baseFocus = focusMuscleMap[focus]?.baseFocus
  const focusConstraint = focusMuscleMap[focus]?.constraint
  let primaryPool = filterExercises(
    catalog,
    focus,
    input.equipment.inventory,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints,
    input.preferences.cardioActivities,
    targetGoal
  )
  const secondaryPool = filterExercises(
    catalog,
    focus,
    input.equipment.inventory,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints,
    input.preferences.cardioActivities,
    targetGoal === 'general_fitness' ? targetGoal : undefined
  )
  if (focusConstraint && primaryPool.length === 0) {
    primaryPool = secondaryPool
  }
  let accessoryPool = baseFocus && baseFocus !== focus
    ? filterExercises(
        catalog,
        baseFocus,
        input.equipment.inventory,
        input.preferences.dislikedActivities,
        input.preferences.accessibilityConstraints,
        input.preferences.cardioActivities
      )
    : []

  if (focusConstraint) {
    accessoryPool = focusConstraint.accessoryMuscles.length
      ? accessoryPool.filter(exercise =>
          matchesPrimaryMuscle(exercise, focusConstraint.accessoryMuscles)
        )
      : []
  }

  if (focusConstraint && primaryPool.length === 0) {
    return { exercises: [], error: 'focus_constraints_unmet' }
  }

  return buildSessionForTime(
    primaryPool,
    secondaryPool,
    accessoryPool,
    input,
    duration,
    targetGoal,
    focusConstraint,
    history,
    seed
  )
}

export const generateSessionExercises = (
  catalog: Exercise[],
  input: PlanInput,
  focus: FocusArea,
  durationMinutes: number,
  goalOverride?: Goal,
  options?: { seed?: string; history?: SessionHistory }
) => {
  const result = buildSessionExercises(
    catalog,
    focus,
    durationMinutes,
    input,
    goalOverride,
    options?.history,
    options?.seed
  )
  if (result.error) {
    logEvent('warn', 'focus_constraints_unsatisfied', { focus })
    if (result.exercises.length) return result.exercises
    return []
  }
  return result.exercises
}

export const buildWorkoutTemplate = (
  partialInput: Partial<PlanInput>
): { template?: WorkoutTemplateDraft; errors: string[] } => {
  const normalized = applyRestPreference(normalizePlanInput(partialInput))
  const errors = validatePlanInput(normalized)
  if (errors.length > 0) {
    return { errors }
  }

  const focusSequence = normalized.intent.mode === 'body_part' && normalized.intent.bodyParts?.length
    ? [normalized.intent.bodyParts[0]]
    : buildFocusSequence(1, normalized.preferences, normalized.goals)
  const focus = focusSequence[0]
  const title = buildPlanTitle(
    focus,
    normalized.goals.primary,
    normalized.intensity,
    normalized.time.minutesPerSession
  )
  const description = `${formatFocusLabel(focus)} focus · ${normalized.goals.primary.replace('_', ' ')} goal.`

  return {
    template: {
      title,
      description,
      focus,
      style: normalized.goals.primary,
      inputs: normalized
    },
    errors: []
  }
}

export const generateWorkoutPlan = (
  catalog: Exercise[],
  partialInput: Partial<PlanInput>
): { plan?: GeneratedPlan; errors: string[] } => {
  const normalized = applyRestPreference(normalizePlanInput(partialInput))
  const errors = validatePlanInput(normalized)
  const layoutCount = normalized.schedule.weeklyLayout?.length ?? 0
  const sessionsPerWeek = layoutCount || normalized.schedule.daysAvailable.length

  if (sessionsPerWeek === 0) {
    errors.push('Select at least one training day.')
  }

  if (errors.length > 0) {
    return { errors }
  }

  const layout = layoutCount > 0
    ? [...(normalized.schedule.weeklyLayout ?? [])].sort((a, b) => a.sessionIndex - b.sessionIndex)
    : buildFocusSequence(sessionsPerWeek, normalized.preferences, normalized.goals).map((focus, index) => ({
      sessionIndex: index,
      style: normalized.goals.primary,
      focus
    }))

  const durationMinutes = adjustMinutesPerSession(normalized, sessionsPerWeek)
  const schedule = layout.map((entry, index) => {
    const exercises = generateSessionExercises(
      catalog,
      normalized,
      entry.focus,
      durationMinutes,
      entry.style,
      { seed: `${entry.sessionIndex}-${entry.focus}-${entry.style}` }
    )
    return {
      order: entry.sessionIndex ?? index,
      name: buildSessionName(entry.focus, exercises, entry.style),
      focus: entry.focus,
      durationMinutes,
      rationale: buildRationale(entry.focus, durationMinutes, normalized.preferences.restPreference, entry.style),
      exercises
    }
  })

  const focus = layout[0]?.focus ?? normalized.preferences.focusAreas[0] ?? normalized.intent.bodyParts?.[0] ?? 'full_body'
  const title = buildPlanTitle(focus, normalized.goals.primary, normalized.intensity, durationMinutes)
  const description = `${sessionsPerWeek} sessions per week · ${formatFocusLabel(focus)} focus.`
  const impact = calculateWorkoutImpact(schedule)

  return {
    plan: {
      title,
      description,
      goal: normalized.goals.primary,
      level: normalized.experienceLevel,
      tags: [formatFocusLabel(focus), normalized.goals.primary.replace('_', ' ')],
      schedule,
      inputs: normalized,
      summary: {
        sessionsPerWeek,
        totalMinutes: durationMinutes * sessionsPerWeek,
        focusDistribution: buildFocusDistribution(schedule),
        impact
      }
    },
    errors: []
  }
}
