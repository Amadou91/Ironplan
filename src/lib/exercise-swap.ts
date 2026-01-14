import type { EquipmentInventory, Exercise, Goal } from '@/types/domain'
import { isExerciseEquipmentAvailable } from '@/lib/equipment'

type SwapSuggestion = {
  exercise: Exercise
  score: number
}

const normalizeName = (name: string) => name.trim().toLowerCase()
const normalizeMuscle = (muscle: string) => muscle.trim().toLowerCase()

const getExerciseMuscles = (exercise: Exercise) => {
  const muscles = new Set<string>()
  if (exercise.primaryMuscle) muscles.add(normalizeMuscle(exercise.primaryMuscle))
  exercise.secondaryMuscles?.forEach((muscle) => muscles.add(normalizeMuscle(muscle)))
  exercise.primaryBodyParts?.forEach((muscle) => muscles.add(normalizeMuscle(muscle)))
  exercise.secondaryBodyParts?.forEach((muscle) => muscles.add(normalizeMuscle(muscle)))
  return muscles
}

const buildAllowedMuscles = (current: Exercise, sessionExercises: Exercise[]) => {
  const currentMuscles = getExerciseMuscles(current)
  if (currentMuscles.size > 0) return currentMuscles

  const sessionMuscles = new Set<string>()
  sessionExercises.forEach((exercise) => {
    getExerciseMuscles(exercise).forEach((muscle) => sessionMuscles.add(muscle))
  })
  return sessionMuscles
}

const hasMuscleOverlap = (candidate: Set<string>, allowed: Set<string>) => {
  for (const muscle of candidate) {
    if (allowed.has(muscle)) return true
  }
  return false
}

const averageRepTarget = (reps: Exercise['reps']) => {
  if (typeof reps === 'number' && Number.isFinite(reps)) return reps
  if (typeof reps !== 'string') return null
  const matches = reps.match(/\d+/g)
  if (!matches?.length) return null
  const numbers = matches.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite)
  if (!numbers.length) return null
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

const inferGoalFromReps = (reps: Exercise['reps']): Goal | null => {
  const average = averageRepTarget(reps)
  if (!average) return null
  if (average <= 6) return 'strength'
  if (average <= 12) return 'hypertrophy'
  return 'endurance'
}

const equipmentOverlap = (current: Exercise, candidate: Exercise) => {
  const currentKinds = new Set(current.equipment.map((option) => option.kind))
  return candidate.equipment.some((option) => currentKinds.has(option.kind))
}

const scoreCandidate = (current: Exercise, candidate: Exercise) => {
  let score = 0

  if (candidate.primaryMuscle && current.primaryMuscle && candidate.primaryMuscle === current.primaryMuscle) {
    score += 4
  }
  if (candidate.movementPattern && current.movementPattern && candidate.movementPattern === current.movementPattern) {
    score += 3
  } else if (candidate.movementPattern && current.movementPattern) {
    score -= 2
  }
  if (candidate.focus === current.focus) {
    score += 2
  }
  if (equipmentOverlap(current, candidate)) {
    score += 2
  }
  if (candidate.difficulty && current.difficulty && candidate.difficulty === current.difficulty) {
    score += 1
  }

  const currentGoal = current.goal ?? inferGoalFromReps(current.reps)
  const candidateGoal = candidate.goal ?? inferGoalFromReps(candidate.reps)
  if (currentGoal && candidateGoal && currentGoal === candidateGoal) {
    score += 1
  }

  const currentReps = averageRepTarget(current.reps)
  const candidateReps = averageRepTarget(candidate.reps)
  if (currentReps && candidateReps) {
    const repDelta = Math.abs(currentReps - candidateReps)
    score += Math.max(0, 2 - repDelta / 4)
  }

  const currentDuration = current.durationMinutes
  const candidateDuration = candidate.durationMinutes
  if (currentDuration && candidateDuration) {
    const durationDelta = Math.abs(currentDuration - candidateDuration)
    score += Math.max(0, 2 - durationDelta / 5)
  }

  return score
}

export const getSwapSuggestions = ({
  current,
  sessionExercises,
  inventory,
  library,
  limit = 5
}: {
  current: Exercise
  sessionExercises: Exercise[]
  inventory: EquipmentInventory
  library: Exercise[]
  limit?: number
}) => {
  const sessionNames = new Set(sessionExercises.map((exercise) => normalizeName(exercise.name)))
  const candidates = library.filter((exercise) => normalizeName(exercise.name) !== normalizeName(current.name))
  const allowedMuscles = buildAllowedMuscles(current, sessionExercises)
  const filtered = candidates.filter(
    (exercise) => !sessionNames.has(normalizeName(exercise.name))
  )
  const muscleFiltered = allowedMuscles.size
    ? filtered.filter((exercise) => {
        const muscleGroups = getExerciseMuscles(exercise)
        return muscleGroups.size > 0 && hasMuscleOverlap(muscleGroups, allowedMuscles)
      })
    : filtered

  const compatible = muscleFiltered.filter((exercise) => isExerciseEquipmentAvailable(inventory, exercise.equipment))
  const scored = (compatible.length > 0 ? compatible : muscleFiltered)
    .map((exercise) => ({
      exercise,
      score: scoreCandidate(current, exercise)
    }))
    .sort((a, b) => b.score - a.score)

  return {
    suggestions: scored.slice(0, limit),
    usedFallback: compatible.length === 0
  }
}
