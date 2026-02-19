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
  focusMuscleMap,
  focusAccessoryMap
} from '@/lib/generator/constants'
import {
  clamp,
  createSeededRandom,
  normalizeExerciseKey,
  getPrimaryMuscleKey,
  getMovementFamilyFromName,
  getMovementFamily,
  matchesPrimaryMuscle,
  selectEquipmentOption,
  isExerciseEquipmentSatisfied,
  estimateExerciseMinutes,
  buildSessionName,
  buildRationale,
  buildPlanTitle,
  buildFocusDistribution,
  calculateWorkoutImpact,
  buildFocusSequence,
  formatFocusLabel,
  formatGoalLabel
} from '@/lib/generator/utils'
import {
  deriveReps,
  getIntensityRestModifier,
  getGoalAdjustedExerciseCaps,
  getSetCaps,
  getFamilyCaps,
  getRestModifier
} from '@/lib/generator/scoring'
import {
  validatePlanInput,
  normalizePlanInput,
  applyRestPreference,
  adjustMinutesPerSession
} from '@/lib/generator/validation'
import { filterExercises, orderPool, reorderForVariety } from '@/lib/generator/selection-logic'
import { createPlannedExercise, adjustSessionVolume } from '@/lib/generator/volume-math'
import { hasEquipment, bodyweightOnlyInventory } from '@/lib/equipment'

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
  let { min: minExercises, max: maxExercises } = getGoalAdjustedExerciseCaps(targetMinutes, goal)
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
      .filter((exercise) => isExerciseEquipmentSatisfied(input.equipment.inventory, exercise))
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
    const planned = createPlannedExercise(exercise, source, input, targetMinutes, minSetCap, maxSetCap, restModifier, reps ?? '8-12', goal)
    if (!planned) return false
    if (focusConstraint && !isAllowedFocusExercise(exercise)) return false
    if (focusConstraint && !isPrimaryMatch(exercise)) {
      const totals = getSetTotals(planned)
      const ratio = totals.total > 0 ? totals.primary / totals.total : 0
      if (ratio < focusConstraint.minPrimarySetRatio && !canMeetPrimaryRatio(planned)) return false
    }
    if (currentMinutes + planned.estimatedMinutes > targetMinutes + 8 && picks.length >= minExercises) {
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
  const sortedSeed = orderPool(seedPool, seedSource, input, hist, rng, goal)
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
    const orderedPool = orderPool(pool, source, input, hist, rng, goal)
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
      const selectedOption = selectEquipmentOption(input.equipment.inventory, planned.exercise.equipment, planned.exercise.orGroup)
      planned.estimatedMinutes = estimateExerciseMinutes(planned.exercise, planned.prescription, selectedOption, goal)
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      ratioCheck = getSetTotals()
      ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
      ratioCounter += 1
    }
  }

  const orderedAccessoryPool = orderPool(accessoryPool, 'accessory', input, hist, rng, goal)
  for (const exercise of orderedAccessoryPool) {
    if (picks.length >= maxExercises || totalMinutes >= targetMinutes - 5) break
    if (canAdd(exercise, 'accessory', totalMinutes)) {
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
    }
  }

  // Second enforcement pass: accessories added above may have dropped the
  // primary-set ratio below the threshold. Boost primary sets again if needed.
  if (focusConstraint) {
    let ratioCheck = getSetTotals()
    let ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
    let ratioCounter = 0
    while (ratio < focusConstraint.minPrimarySetRatio && ratioCounter < 200) {
      const planned = picks.find((item) => isPrimaryMatch(item.exercise) && item.prescription.sets < item.maxSets)
      if (!planned) break
      planned.prescription.sets += 1
      const selectedOption = selectEquipmentOption(input.equipment.inventory, planned.exercise.equipment, planned.exercise.orGroup)
      planned.estimatedMinutes = estimateExerciseMinutes(planned.exercise, planned.prescription, selectedOption, goal)
      totalMinutes = picks.reduce((sum, item) => sum + item.estimatedMinutes, 0)
      ratioCheck = getSetTotals()
      ratio = ratioCheck.total > 0 ? ratioCheck.primary / ratioCheck.total : 0
      ratioCounter += 1
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

  const orderedPicks = reorderForVariety(picks, rng, input, hist, goal)
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
  seed?: string,
  excludeAccessoryMuscles?: string[]
): { exercises: Exercise[]; error?: string } => {
  const targetGoal = goalOverride ?? input.goals.primary
  const baseFocus = focusMuscleMap[focus]?.baseFocus
  const focusConfig = focusMuscleMap[focus]
  // When running as part of a multi-focus session, exclude muscles that are
  // handled by a dedicated sub-session so they don't get poached as accessories
  // and then deduplicated during the merge step.
  const baseAccessoryMuscles = focusAccessoryMap[focus] ?? []
  const effectiveAccessoryMuscles = excludeAccessoryMuscles?.length
    ? baseAccessoryMuscles.filter(m => !excludeAccessoryMuscles.includes(m))
    : baseAccessoryMuscles
  const focusConstraint: FocusConstraint | null = focusConfig?.primaryMuscles?.length
    ? {
        focus,
        primaryMuscles: focusConfig.primaryMuscles,
        accessoryMuscles: effectiveAccessoryMuscles,
        minPrimarySetRatio: 0.75
      }
    : null

  // Bodyweight-only fallback: if the user has no equipment configured at all,
  // substitute a bodyweight-only inventory so the generator always produces
  // a non-empty exercise list instead of silently returning nothing.
  const effectiveInventory = hasEquipment(input.equipment.inventory)
    ? input.equipment.inventory
    : (() => {
        logEvent('info', 'generator_bodyweight_fallback', {
          reason: 'empty_equipment_inventory',
          focus,
          goal: targetGoal
        })
        return bodyweightOnlyInventory()
      })()

  const effectiveInput: PlanInput = effectiveInventory === input.equipment.inventory
    ? input
    : { ...input, equipment: { ...input.equipment, inventory: effectiveInventory } }

  let primaryPool = filterExercises(
    catalog,
    focus,
    effectiveInventory,
    effectiveInput.preferences.dislikedActivities,
    effectiveInput.preferences.accessibilityConstraints,
    targetGoal
  )
  const secondaryPool = filterExercises(
    catalog,
    focus,
    effectiveInventory,
    effectiveInput.preferences.dislikedActivities,
    effectiveInput.preferences.accessibilityConstraints,
    targetGoal === 'general_fitness' ? targetGoal : undefined
  )
  if (focusConstraint && primaryPool.length === 0) {
    primaryPool = secondaryPool
  }
  let accessoryPool = baseFocus && baseFocus !== focus
    ? filterExercises(
        catalog,
        baseFocus,
        effectiveInventory,
        effectiveInput.preferences.dislikedActivities,
        effectiveInput.preferences.accessibilityConstraints
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
    effectiveInput,
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
  options?: { seed?: string; history?: SessionHistory; excludeAccessoryMuscles?: string[] }
) => {
  const result = buildSessionExercises(
    catalog,
    focus,
    durationMinutes,
    input,
    goalOverride,
    options?.history,
    options?.seed,
    options?.excludeAccessoryMuscles
  )
  if (result.error) {
    logEvent('warn', 'focus_constraints_unsatisfied', { focus })
    if (result.exercises.length) return result.exercises
    return []
  }
  return result.exercises
}

export const generateSessionExercisesForFocusAreas = (
  catalog: Exercise[],
  input: PlanInput,
  focusAreas: FocusArea[],
  durationMinutes: number,
  goalOverride?: Goal,
  options?: { seed?: string; history?: SessionHistory }
) => {
  const normalizedFocusAreas = Array.from(new Set(focusAreas.filter(Boolean)))
  const fallbackFocus = normalizedFocusAreas[0] ?? 'full_body'

  if (normalizedFocusAreas.length <= 1) {
    return generateSessionExercises(
      catalog,
      input,
      fallbackFocus,
      durationMinutes,
      goalOverride,
      options
    )
  }

  const targetGoal = goalOverride ?? input.goals.primary
  // Give each focus area a generous time budget instead of strict 1/N division.
  // The merge step deduplicates exercises and the mergedCap limits the total,
  // so over-generation per sub-session is harmless. Strict equal splits cause
  // adjustSessionVolume to strip sets below usable thresholds.
  const perFocusDuration = Math.max(25, Math.round(durationMinutes * 0.8))

  // Collect primary muscles for each focus so sub-sessions don't poach exercises
  // that belong to another focus area's dedicated sub-session.
  const allPrimaryMuscles = normalizedFocusAreas.map(
    focus => focusMuscleMap[focus]?.primaryMuscles ?? []
  )
  const buckets = normalizedFocusAreas.map((focus, index) => {
    const otherPrimaryMuscles = allPrimaryMuscles
      .filter((_, i) => i !== index)
      .flat()
    return generateSessionExercises(catalog, input, focus, perFocusDuration, goalOverride, {
      seed: `${options?.seed ?? 'multi-focus'}-${focus}-${index}`,
      history: options?.history,
      excludeAccessoryMuscles: otherPrimaryMuscles
    })
  })

  const merged: Exercise[] = []
  const seen = new Set<string>()
  let hasRemaining = true

  while (hasRemaining) {
    hasRemaining = false
    buckets.forEach((bucket) => {
      const candidate = bucket.shift()
      if (!candidate) return
      hasRemaining = true
      const key = normalizeExerciseKey(candidate.name)
      if (seen.has(key)) return
      seen.add(key)
      merged.push(candidate)
    })
  }

  const { max } = getGoalAdjustedExerciseCaps(durationMinutes, targetGoal)
  const multiFocusBonus = Math.max(0, normalizedFocusAreas.length - 1)
  const mergedCap = max + multiFocusBonus
  if (merged.length > mergedCap) {
    return merged.slice(0, mergedCap)
  }

  if (!merged.length) {
    return generateSessionExercises(catalog, input, fallbackFocus, durationMinutes, goalOverride, options)
  }

  return merged
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
  const description = `${formatFocusLabel(focus)} focus · ${formatGoalLabel(normalized.goals.primary)} goal.`

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
      tags: [formatFocusLabel(focus), formatGoalLabel(normalized.goals.primary)],
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
