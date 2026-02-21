import type { Intensity } from '@/types/domain'
import { defaultRpeBaselines, type CustomRpeBaselines } from '@/lib/preferences'
import { clamp, weightedAverage } from '@/lib/math'
import {
  computeSetIntensity,
  computeSetLoad,
  computeSetTonnage,
  getEffortScore,
  getWeekKey,
  isHardSet,
  type MetricsSet
} from '@/lib/session-metrics'
import {
  ACUTE_LOAD_WINDOW_DAYS,
  CHRONIC_LOAD_WINDOW_DAYS,
  MS_PER_DAY,
  ACR_THRESHOLDS,
  READINESS_MIN,
  READINESS_MAX,
  READINESS_HIGH_THRESHOLD,
  READINESS_LOW_THRESHOLD
} from '@/constants/training'

export type ReadinessSurvey = {
  sleep: number
  soreness: number
  stress: number
  motivation: number
}

export type ReadinessLevel = 'low' | 'steady' | 'high'

export type SessionMetrics = {
  totalSets: number
  totalReps: number
  tonnage: number
  hardSets: number
  avgEffort: number | null
  avgIntensity: number | null
  avgRestSeconds: number | null
  durationMinutes: number | null
  /**
   * Active training duration in seconds.
   * Calculated as (Reps * 3s execution time) + Rest timer.
   * More accurate than wall-clock duration as it excludes long pauses.
   */
  activeDurationSeconds: number | null
  density: number | null
  workload: number
  sessionRpe: number | null
  sRpeLoad: number | null
}

type SessionMetricsInput = {
  startedAt?: string | null
  endedAt?: string | null
  intensity?: Intensity | null
  sets: MetricsSet[]
}

type TrainingSession = SessionMetricsInput & {
  startedAt: string
}

export type TrainingLoadSummary = {
  acuteLoad: number
  chronicLoad: number
  chronicWeeklyAvg: number
  loadRatio: number
  status: 'undertraining' | 'balanced' | 'overreaching'
  daysSinceLast: number | null
  insufficientData: boolean
  isInitialPhase: boolean
  weeklyLoadTrend: Array<{ week: string; load: number }>
}

// clamp imported from @/lib/math

/**
 * @deprecated Use CustomRpeBaselines from preferences.ts instead
 */
export type IntensityBaselines = CustomRpeBaselines

/**
 * Returns RPE baseline for a given intensity level.
 * Accepts optional user-derived baselines from training history or preferences.
 * 
 * @param intensity - The intensity level ('low', 'moderate', 'high')
 * @param customBaselines - Optional custom RPE baselines from user preferences
 * @returns The RPE value for the given intensity
 */
export const getIntensityBaseline = (
  intensity?: Intensity | null,
  customBaselines?: Partial<CustomRpeBaselines>
): number => {
  const baselines = { ...defaultRpeBaselines, ...customBaselines }
  if (intensity === 'low') return baselines.low
  if (intensity === 'high') return baselines.high
  return baselines.moderate
}

// weightedAverage imported from @/lib/math

// Constants imported from @/constants/training
import {
  DEFAULT_REST_SECONDS,
  ESTIMATED_SET_TIME_SECONDS,
  SECONDS_PER_REP
} from '@/constants/training'

/**
 * Calculates wall-clock duration from timestamps (may include long pauses).
 */
const getWallClockMinutes = (sets: MetricsSet[]) => {
  const timestamps = sets
    .map((set) => (set.performedAt ? new Date(set.performedAt).getTime() : NaN))
    .filter((value) => Number.isFinite(value))
  if (timestamps.length < 2) return null
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const minutes = (maxTime - minTime) / 60000
  return minutes > 0 ? minutes : null
}

/**
 * Calculates active training duration by summing estimated set time + rest time.
 * This avoids penalizing density for long pauses (bathroom breaks, etc.).
 */
const getActiveDurationMinutes = (sets: MetricsSet[]) => {
  if (sets.length === 0) return null
  
  let totalSeconds = 0
  sets.forEach((set) => {
    // Add estimated time for the set itself
    totalSeconds += ESTIMATED_SET_TIME_SECONDS
    // Add rest time (use actual if available, otherwise default)
    const restSeconds = typeof set.restSecondsActual === 'number' && set.restSecondsActual > 0
      ? set.restSecondsActual
      : DEFAULT_REST_SECONDS
    totalSeconds += restSeconds
  })
  
  // Subtract rest from last set (no rest needed after final set)
  const lastSetRest = typeof sets[sets.length - 1]?.restSecondsActual === 'number'
    ? sets[sets.length - 1].restSecondsActual!
    : DEFAULT_REST_SECONDS
  totalSeconds -= lastSetRest
  
  return totalSeconds > 0 ? totalSeconds / 60 : null
}

export const computeSessionMetrics = ({
  startedAt,
  endedAt,
  intensity,
  sets
}: SessionMetricsInput): SessionMetrics => {
  const totalSets = sets.length
  const totalReps = sets.reduce((sum, set) => sum + (typeof set.reps === 'number' ? set.reps : 0), 0)
  const tonnage = sets.reduce((sum, set) => sum + computeSetTonnage(set), 0)
  const hardSets = sets.reduce((sum, set) => sum + (isHardSet(set) ? 1 : 0), 0)
  const workload = sets.reduce((sum, set) => sum + computeSetLoad(set), 0)
  const tonnageWeights = sets.map((set) => computeSetTonnage(set))
  const durationWeights = sets.map((set) => set.durationSeconds ?? 0)
  
  const totalTonnageWeight = tonnageWeights.reduce((a, b) => a + b, 0)
  const totalDurationWeight = durationWeights.reduce((a, b) => a + b, 0)
  
  const activeWeights = totalTonnageWeight > 0 
    ? tonnageWeights 
    : (totalDurationWeight > 0 ? durationWeights : sets.map(() => 1))

  const avgEffort = weightedAverage(sets.map(getEffortScore), activeWeights)
  const avgIntensity = weightedAverage(sets.map(computeSetIntensity), tonnageWeights)
  const avgRestSeconds = weightedAverage(
    sets.map((set) => (typeof set.restSecondsActual === 'number' ? set.restSecondsActual : null)),
    activeWeights
  )

  // Calculate active duration in seconds: (Reps * 3s execution time) + RestTimer
  // This is more accurate than wall-clock as it excludes long pauses (bathroom breaks, etc.)
  // SECONDS_PER_REP imported from @/constants/training
  const activeDurationSeconds = sets.reduce((total, set, index) => {
    // Add rep execution time: reps * 3 seconds
    const repTime = typeof set.reps === 'number' && set.reps > 0 
      ? set.reps * SECONDS_PER_REP 
      : (set.durationSeconds ?? ESTIMATED_SET_TIME_SECONDS)
    
    // Add rest time (except for last set)
    const isLastSet = index === sets.length - 1
    const restTime = isLastSet ? 0 : (
      typeof set.restSecondsActual === 'number' && set.restSecondsActual > 0
        ? set.restSecondsActual
        : DEFAULT_REST_SECONDS
    )
    
    return total + repTime + restTime
  }, 0)

  // Use active duration for density calculations to avoid penalizing for pauses
  const activeDurationMinutes = getActiveDurationMinutes(sets)
  // Use wall-clock for general session duration display
  const wallClockMinutes = getWallClockMinutes(sets)
  const durationMinutes = wallClockMinutes ?? (() => {
    if (!startedAt || !endedAt) return null
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    const minutes = (end - start) / 60000
    return minutes > 0 ? minutes : null
  })()

  // Density uses active duration (not wall-clock) to avoid long pause penalties
  const densityDuration = activeDurationMinutes ?? durationMinutes
  const density = densityDuration ? tonnage / densityDuration : null
  const sessionRpe = avgEffort ?? (sets.length ? getIntensityBaseline(intensity) : null)
  const sRpeLoad = sessionRpe && durationMinutes ? sessionRpe * durationMinutes : null

  return {
    totalSets,
    totalReps,
    tonnage: Math.round(tonnage),
    hardSets,
    avgEffort: avgEffort ? Number(avgEffort.toFixed(1)) : null,
    avgIntensity: avgIntensity ? Number(avgIntensity.toFixed(2)) : null,
    avgRestSeconds: avgRestSeconds ? Number(avgRestSeconds.toFixed(0)) : null,
    durationMinutes: durationMinutes ? Math.round(durationMinutes) : null,
    activeDurationSeconds: activeDurationSeconds > 0 ? Math.round(activeDurationSeconds) : null,
    density: density ? Number(density.toFixed(1)) : null,
    workload: Math.round(workload),
    sessionRpe: sessionRpe ? Number(sessionRpe.toFixed(1)) : null,
    sRpeLoad: sRpeLoad ? Math.round(sRpeLoad) : null
  }
}

export const computeReadinessScore = (survey: ReadinessSurvey) => {
  const values = Object.values(survey)
  if (values.some((value) => !Number.isFinite(value))) return null
  
  const normalize = (value: number) => clamp(value, READINESS_MIN, READINESS_MAX)
  
  // Raw sum range is 4 (all worst) to 20 (all best)
  const rawSum = 
    normalize(survey.sleep) +
    normalize(survey.motivation) +
    (6 - normalize(survey.soreness)) +
    (6 - normalize(survey.stress))
    
  // Map 4-20 to 0-100
  const score = ((rawSum - 4) / 16) * 100
  return Math.round(clamp(score, 0, 100))
}

export const getReadinessLevel = (score: number | null): ReadinessLevel => {
  if (typeof score !== 'number') return 'steady'
  if (score >= READINESS_HIGH_THRESHOLD) return 'high'
  if (score < READINESS_LOW_THRESHOLD) return 'low'
  return 'steady'
}

export const getReadinessIntensity = (level: ReadinessLevel): Intensity => {
  if (level === 'low') return 'low'
  if (level === 'high') return 'high'
  return 'moderate'
}

export const summarizeTrainingLoad = (sessions: TrainingSession[], now = new Date()): TrainingLoadSummary => {
  const nowTime = now.getTime()
  const dailyLoads = new Map<string, number>()
  const weeklyLoads = new Map<string, number>()
  const resolvedSessions = sessions
    .map((session) => {
      const time = new Date(session.startedAt).getTime()
      if (!Number.isFinite(time)) return null
      return {
        startedAt: session.startedAt,
        time,
        workload: computeSessionMetrics(session).workload
      }
    })
    .filter((session): session is { startedAt: string; time: number; workload: number } => session !== null)

  const sessionTimes = resolvedSessions.map((session) => session.time)
  const lastSessionTime = sessionTimes.length ? Math.max(...sessionTimes) : null
  const firstSessionTime = sessionTimes.length ? Math.min(...sessionTimes) : null
  const daysSinceLast = lastSessionTime ? Math.max(0, (nowTime - lastSessionTime) / MS_PER_DAY) : null
  const historyDays = firstSessionTime ? (nowTime - firstSessionTime) / MS_PER_DAY : 0
  const sessionCount = resolvedSessions.length

  resolvedSessions.forEach((session) => {
    const dayKey = new Date(session.startedAt).toISOString().slice(0, 10)
    dailyLoads.set(dayKey, (dailyLoads.get(dayKey) ?? 0) + session.workload)

    const weekKey = getWeekKey(session.startedAt)
    weeklyLoads.set(weekKey, (weeklyLoads.get(weekKey) ?? 0) + session.workload)
  })

  const acuteWindow = ACUTE_LOAD_WINDOW_DAYS * MS_PER_DAY
  const chronicWindow = CHRONIC_LOAD_WINDOW_DAYS * MS_PER_DAY
  let acuteLoad = 0
  let chronicLoad = 0

  resolvedSessions.forEach((session) => {
    const delta = nowTime - session.time
    if (delta < 0) return // Skip future sessions relative to calculation date

    if (delta <= acuteWindow) acuteLoad += session.workload
    if (delta <= chronicWindow) chronicLoad += session.workload
  })

  const chronicWeeklyAverage = chronicLoad ? chronicLoad / 4 : 0
  const loadRatio = chronicWeeklyAverage ? acuteLoad / chronicWeeklyAverage : 0
  
  // ACR is statistically volatile until we have ~14 days of history and ~4 sessions.
  const isInitialPhase = historyDays < 14 || sessionCount < 4

  let status: 'undertraining' | 'balanced' | 'overreaching' = 'balanced'
  if (!isInitialPhase) {
    if (loadRatio >= ACR_THRESHOLDS.overreaching) {
      status = 'overreaching'
    } else if (loadRatio <= ACR_THRESHOLDS.undertraining && chronicLoad > 0) {
      status = 'undertraining'
    }
  }

  const weeklyLoadTrend = Array.from(weeklyLoads.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, load]) => ({ week, load: Math.round(load) }))

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    chronicWeeklyAvg: Math.round(chronicWeeklyAverage),
    loadRatio: Number(loadRatio.toFixed(2)),
    status,
    daysSinceLast: typeof daysSinceLast === 'number' ? Number(daysSinceLast.toFixed(1)) : null,
    insufficientData: chronicLoad === 0,
    isInitialPhase,
    weeklyLoadTrend
  }
}

export const getLoadBasedReadiness = (summary: TrainingLoadSummary): ReadinessLevel => {
  if (summary.status === 'overreaching') return 'low'
  if (summary.status === 'undertraining') return 'high'
  if (summary.daysSinceLast !== null && summary.daysSinceLast <= 1) return 'low'
  return 'steady'
}
