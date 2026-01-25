import type {
  Exercise,
  FocusArea,
  Goal,
  CardioActivity,
  EquipmentInventory,
  WorkoutTemplateDraft,
  GeneratedPlan,
  PlanInput
} from '@/types/domain'
import { logEvent } from '@/lib/logger'
import { matchesCardioSelection } from '@/lib/cardio-activities'
import type {
  ExercisePrescription,
  PlannedExercise,
  ExerciseSource,
  FocusConstraint,
  SessionHistory
} from './types'
import {
  EXERCISE_LIBRARY,
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
  matchesFocusArea,
  getFocusConstraint,
  selectEquipmentOption,
  buildLoad,
  estimateExerciseMinutes,
  buildSessionName,
  buildRationale,
  buildPlanTitle,
  buildFocusDistribution,
  calculateWorkoutImpact,
  buildFocusSequence,
  isEquipmentOptionAvailable
} from './utils'
import {
  getExperienceScore,
  getIntensityScore,
  adjustRpe,
  adjustSets,
  adjustSetsForIntensity,
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

const filterExercises = (
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
  const recentNames = new Set((history?.recentExerciseNames ?? []).map(normalizeExerciseKey))
  const recentPatterns = new Set((history?.recentMovementPatterns ?? []).filter(Boolean))
  const recentPrimaryMuscles = new Set(
    (history?.recentPrimaryMuscles ?? []).map((muscle) => muscle.trim().toLowerCase())
  )
  const recentFamilies = new Set(
    (history?.recentExerciseNames ?? []).map((name) => getMovementFamilyFromName(name))
  )

  const scoreExercise = (exercise: Exercise, source: ExerciseSource) => {
    let score = 0
    const nameKey = normalizeExerciseKey(exercise.name)
    if (recentNames.has(nameKey)) score -= 3
    if (!recentNames.has(nameKey)) score += 2
    if (exercise.movementPattern && recentPatterns.has(exercise.movementPattern)) score -= 1
    const primaryKey = getPrimaryMuscleKey(exercise)
    if (primaryKey && recentPrimaryMuscles.has(primaryKey)) score -= 1
    const family = getMovementFamily(exercise)
    if (family && recentFamilies.has(family)) score -= 1
    if (family && !recentFamilies.has(family)) score += 0.5
    score += getExperienceScore(exercise, input.experienceLevel)
    score += getIntensityScore(exercise, input.intensity)
    if (source === 'primary') score += 1
    return score
  }

  const orderPool = (pool: Exercise[], source: ExerciseSource) =>
    pool
      .map((exercise) => ({
        exercise,
        score: scoreExercise(exercise, source) + rng() * 0.2
      }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.exercise)

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

  const createPlan = (exercise: Exercise, source: ExerciseSource): PlannedExercise | null => {
    const selectedOption = selectEquipmentOption(input.equipment.inventory, exercise.equipment)
    if (!selectedOption) return null
    const baseSets = adjustSetsForIntensity(adjustSets(exercise.sets, input.experienceLevel), input.intensity)
    const isCardio = exercise.focus === 'cardio'
    const minSets = isCardio ? 1 : minSetCap
    const maxSets = isCardio ? Math.max(minSets, Math.min(4, maxSetCap)) : maxSetCap
    let sets = clamp(baseSets, minSets, maxSets)
    if (targetMinutes <= 35 && (source === 'accessory' || source === 'secondary')) {
      sets = Math.max(minSets, sets - 1)
    }
    if (targetMinutes >= 90 && source === 'primary') {
      sets = Math.min(maxSets, sets + 1)
    }
    const restSeconds = clamp(Math.round(exercise.restSeconds * restModifier), isCardio ? 30 : 45, 150)
    const prescription: ExercisePrescription = {
      sets,
      reps: exercise.focus === 'cardio' ? exercise.reps : reps,
      rpe: adjustRpe(exercise.rpe, input.intensity),
      restSeconds,
      load: buildLoad(selectedOption, exercise.loadTarget, input.equipment.inventory)
    }
    const estimatedMinutes = estimateExerciseMinutes(exercise, prescription, selectedOption, goal)
    return {
      exercise,
      source,
      prescription,
      estimatedMinutes,
      minSets,
      maxSets
    }
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
    const planned = createPlan(exercise, source)
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
  const sortedSeed = orderPool(seedPool, seedSource)
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
    const orderedPool = orderPool(pool, source)
    for (const exercise of orderedPool) {
      if (picks.length >= minExercises) break
      if (canAdd(exercise, source, totalMinutes)) {
        totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      }
    }
  })

  const recalcTotals = () => {
    totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  }

  const adjustEstimate = (planned: PlannedExercise) => {
    const selectedOption = selectEquipmentOption(input.equipment.inventory, planned.exercise.equipment)
    planned.estimatedMinutes = estimateExerciseMinutes(
      planned.exercise,
      planned.prescription,
      selectedOption,
      goal
    )
  }

  const reduceOrder: ExerciseSource[] = ['accessory', 'secondary', 'primary']
  let safetyCounter = 0
  while (totalMinutes > targetMinutes && safetyCounter < 200) {
    let changed = false
    for (const source of reduceOrder) {
      const planned = picks.find((item) => item.source === source && item.prescription.sets > item.minSets)
      if (!planned) continue
      planned.prescription.sets -= 1
      adjustEstimate(planned)
      changed = true
      recalcTotals()
      if (totalMinutes <= targetMinutes) break
    }
    if (!changed) break
    safetyCounter += 1
  }

  const increaseOrder: ExerciseSource[] = ['primary', 'secondary', 'accessory']
  safetyCounter = 0
  while (totalMinutes < targetMinutes - 6 && safetyCounter < 200) {
    let increased = false
    for (const source of increaseOrder) {
      const planned = picks.find((item) => item.source === source && item.prescription.sets < item.maxSets)
      if (!planned) continue
      if (focusConstraint && !isAllowedFocusExercise(planned.exercise)) continue
      if (focusConstraint && !isPrimaryMatch(planned.exercise)) {
        const totals = getSetTotals({ ...planned, prescription: { ...planned.prescription, sets: planned.prescription.sets + 1 } })
        const ratio = totals.total > 0 ? totals.primary / totals.total : 0
        if (ratio < focusConstraint.minPrimarySetRatio) continue
      }
      planned.prescription.sets += 1
      adjustEstimate(planned)
      recalcTotals()
      if (totalMinutes <= targetMinutes) {
        increased = true
        break
      }
      planned.prescription.sets -= 1
      adjustEstimate(planned)
      recalcTotals()
    }
    if (!increased) break
    safetyCounter += 1
  }

  if (focusConstraint) {
    let ratioCheck = getSetTotals()
    let ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
    let ratioCounter = 0
    while (ratio < focusConstraint.minPrimarySetRatio && ratioCounter < 200) {
      const planned = picks.find((item) => isPrimaryMatch(item.exercise) && item.prescription.sets < item.maxSets)
      if (!planned) break
      planned.prescription.sets += 1
      adjustEstimate(planned)
      recalcTotals()
      ratioCheck = getSetTotals()
      ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
      ratioCounter += 1
    }
  }

  const orderedAccessoryPool = orderPool(accessoryPool, 'accessory')
  for (const exercise of orderedAccessoryPool) {
    if (picks.length >= maxExercises || totalMinutes >= targetMinutes - 5) break
    if (canAdd(exercise, 'accessory', totalMinutes)) {
      recalcTotals()
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

  const reorderForVariety = () => {
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
        const itemScore = scoreExercise(item.exercise, item.source) + rng() * 0.1
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

  const orderedPicks = reorderForVariety()
  return {
    exercises: orderedPicks.map(({ exercise, prescription }) => ({
      ...exercise,
      ...prescription
    })),
    error: focusConstraintRelaxed ? 'focus_constraints_relaxed' : undefined
  }
}

const buildSessionExercises = (
  focus: FocusArea,
  duration: number,
  input: PlanInput,
  goalOverride?: Goal,
  history?: SessionHistory,
  seed?: string
): { exercises: Exercise[]; error?: string } => {
  const targetGoal = goalOverride ?? input.goals.primary
  const baseFocus = focusMuscleMap[focus]?.baseFocus
  const focusConstraint = getFocusConstraint(focus)
  let primaryPool = filterExercises(
    focus,
    input.equipment.inventory,
    input.preferences.dislikedActivities,
    input.preferences.accessibilityConstraints,
    input.preferences.cardioActivities,
    targetGoal
  )
  const secondaryPool = filterExercises(
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
  input: PlanInput,
  focus: FocusArea,
  durationMinutes: number,
  goalOverride?: Goal,
  options?: { seed?: string; history?: SessionHistory }
) => {
  const result = buildSessionExercises(
    focus,
    durationMinutes,
    input,
    goalOverride,
    options?.history,
    options?.seed
  )
  if (result.error) {
    const accessoryEligible = focusMuscleMap[focus]?.baseFocus
      ? filterExercises(
          focusMuscleMap[focus]?.baseFocus ?? focus,
          input.equipment.inventory,
          input.preferences.dislikedActivities,
          input.preferences.accessibilityConstraints,
          input.preferences.cardioActivities
        ).length
      : 0
    logEvent('warn', 'focus_constraints_unsatisfied', {
      focus,
      primaryEligible: filterExercises(
        focus,
        input.equipment.inventory,
        input.preferences.dislikedActivities,
        input.preferences.accessibilityConstraints,
        input.preferences.cardioActivities,
        goalOverride ?? input.goals.primary
      ).length,
      accessoryEligible
    })
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
