import type { SessionRow } from '@/lib/transformers/progress-data'
import type { ReadinessRow } from '@/hooks/useRecoveryMetrics'
import type { FocusArea, Intensity, SessionGoal } from '@/types/domain'
import { toMuscleSlug } from '@/lib/muscle-utils'
import { computeSetTonnage } from '@/lib/session-metrics'
import { mapSetLikeToMetricsSet } from '@/lib/transformers/metric-set'

export interface TrainingAnalysis {
  muscleFreshness: Record<string, number> // Hours since last trained
  muscleVolume7d: Record<string, number> // Volume in last 7 days
  muscleFrequency7d: Record<string, number> // Sessions in last 7 days
  lastSessionDate: Date | null
  daysSinceLastSession: number
}

export interface WorkoutSuggestion {
  type: 'strength' | 'cardio' | 'active_recovery' | 'rest'
  focus: FocusArea[]
  intensity: Intensity
  goal: SessionGoal
  reasoning: string[]
  score: number
}

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'legs', 'arms', 'core'
] as const

const RECOVERY_HOURS_FULL = 72
const RECOVERY_HOURS_PARTIAL = 48
const MS_PER_DAY = 24 * 60 * 60 * 1000

const differenceInDays = (a: Date, b: Date) => (a.getTime() - b.getTime()) / MS_PER_DAY
const subDays = (date: Date, days: number) => new Date(date.getTime() - days * MS_PER_DAY)

export function analyzeTrainingStatus(
  sessions: SessionRow[],
  now = new Date()
): TrainingAnalysis {
  const muscleFreshness: Record<string, number> = {}
  const muscleVolume7d: Record<string, number> = {}
  const muscleFrequency7d: Record<string, number> = {}
  
  // Initialize
  MUSCLE_GROUPS.forEach(m => {
    muscleFreshness[m] = 999 // High number = very fresh
    muscleVolume7d[m] = 0
    muscleFrequency7d[m] = 0
  })

  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )

  const lastSession = sortedSessions[0]
  const lastSessionDate = lastSession ? new Date(lastSession.started_at) : null
  const daysSinceLastSession = lastSessionDate 
    ? differenceInDays(now, lastSessionDate)
    : 999

  const sevenDaysAgo = subDays(now, 7)

  sortedSessions.forEach(session => {
    const sessionDate = new Date(session.started_at)
    const hoursSince = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60)
    const isRecent = sessionDate >= sevenDaysAgo

    const sessionMuscles = new Set<string>()

    session.session_exercises.forEach(ex => {
      const primary = toMuscleSlug(ex.primary_muscle || '') || 'other'
      
      // Simple mapping to major groups
      let group = 'other'
      if (['chest'].includes(primary)) group = 'chest'
      else if (['back', 'lats', 'traps'].includes(primary)) group = 'back'
      else if (['shoulders', 'delts'].includes(primary)) group = 'shoulders'
      else if (['quads', 'hamstrings', 'glutes', 'calves', 'legs'].includes(primary)) group = 'legs'
      else if (['biceps', 'triceps', 'arms', 'forearms'].includes(primary)) group = 'arms'
      else if (['core', 'abs'].includes(primary)) group = 'core'

      if (group === 'other') return

      // Update freshness (min hours since)
      if (hoursSince < muscleFreshness[group]) {
        muscleFreshness[group] = hoursSince
      }

      if (isRecent) {
        sessionMuscles.add(group)
        // Calculate volume
        const sets = ex.sets || []
        sets.forEach(set => {
          if (set.completed !== false) {
             const metricsSet = mapSetLikeToMetricsSet({
               reps: set.reps ?? null,
               weight: set.weight ?? null,
               weightUnit: (set.weight_unit as 'lb'|'kg'|null) ?? 'lb'
             })
             muscleVolume7d[group] = (muscleVolume7d[group] || 0) + computeSetTonnage(metricsSet)
          }
        })
      }
    })

    if (isRecent) {
      sessionMuscles.forEach(m => {
        muscleFrequency7d[m] = (muscleFrequency7d[m] || 0) + 1
      })
    }
  })

  return {
    muscleFreshness,
    muscleVolume7d,
    muscleFrequency7d,
    lastSessionDate,
    daysSinceLastSession
  }
}

export function getSuggestedWorkout(
  analysis: TrainingAnalysis,
  readiness: ReadinessRow | null,
  trainingStatus: 'undertraining' | 'balanced' | 'overreaching' = 'balanced'
): WorkoutSuggestion {
  const reasoning: string[] = []
  
  // 1. Check Readiness
  let readinessLevel: 'low' | 'moderate' | 'high' = 'moderate'
  const score = readiness?.readiness_score ?? 70 // Default to moderate if no data

  if (score < 45) readinessLevel = 'low'
  else if (score >= 75) readinessLevel = 'high'

  if (analysis.daysSinceLastSession > 4) {
    reasoning.push("It's been a while since your last workout.")
    // Boost readiness slightly if they are just de-trained but potentially fresh, 
    // unless they explicitly logged low readiness.
    if (!readiness && readinessLevel !== 'low') readinessLevel = 'high' 
  }

  // 2. Determine Intensity based on Readiness & Status
  let intensity: Intensity = 'moderate'
  if (readinessLevel === 'low') {
    intensity = 'low'
    reasoning.push("Your readiness is low. Prioritizing recovery.")
  } else if (readinessLevel === 'high') {
    intensity = 'high'
    reasoning.push("You're well recovered. Ready for a challenge.")
  } else if (trainingStatus === 'overreaching') {
    intensity = 'low'
    reasoning.push("High recent training load detected. Deload recommended.")
  }

  // 3. Determine Type & Focus
  if (intensity === 'low' && readinessLevel === 'low') {
    return {
      type: 'active_recovery',
      focus: ['mobility', 'core'],
      intensity: 'low',
      goal: 'general_fitness',
      reasoning,
      score: 100
    }
  }

  // Find gaps (Low frequency) and Fresh muscles
  const candidates: { group: string; score: number }[] = []

  MUSCLE_GROUPS.forEach(group => {
    let score = 0
    const fresh = analysis.muscleFreshness[group]
    const freq = analysis.muscleFrequency7d[group]
    
    // Recovery Check
    if (fresh < RECOVERY_HOURS_PARTIAL) {
      return // Skip unrecovered muscles
    }
    
    // Bonus for being fully recovered
    if (fresh > RECOVERY_HOURS_FULL) score += 5
    
    // Bonus for low frequency (Gap)
    if (freq === 0) score += 10
    else if (freq === 1) score += 5
    
    candidates.push({ group, score })
  })

  candidates.sort((a, b) => b.score - a.score)

  // Identify top candidates
  const topGroups = candidates.slice(0, 2).map(c => c.group)

  let focus: FocusArea[] = ['full_body']
  const type: WorkoutSuggestion['type'] = 'strength'

  if (topGroups.length > 0) {
    // Map internal groups back to FocusArea
    const mapped: FocusArea[] = topGroups.map(g => {
      if (g === 'legs') return 'legs'
      if (g === 'chest') return 'chest'
      if (g === 'back') return 'back'
      if (g === 'shoulders') return 'shoulders'
      if (g === 'arms') return 'arms'
      if (g === 'core') return 'core'
      return 'full_body'
    })
    focus = mapped
    
    if (focus.includes('legs') && focus.length === 1) {
      reasoning.push("Legs are fresh and due for training.")
    } else if (focus.includes('chest') || focus.includes('back')) {
      reasoning.push("Upper body muscles are recovered.")
    } else {
      reasoning.push("Targeting fresh muscle groups.")
    }
  } else {
    // If everything is hit recently or nothing is fresh
    if (Object.values(analysis.muscleFreshness).every(h => h < RECOVERY_HOURS_PARTIAL)) {
      // All sore?
      return {
        type: 'active_recovery',
        focus: ['mobility'],
        intensity: 'low',
        goal: 'general_fitness',
        reasoning: ["Systemic fatigue detected. Active recovery recommended."],
        score: 90
      }
    }
    // Fallback
    reasoning.push("General full body maintenance.")
  }

  return {
    type,
    focus,
    intensity,
    goal: 'hypertrophy', // Default for now
    reasoning,
    score: 80
  }
}
