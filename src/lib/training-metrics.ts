import type { Intensity } from '@/types/domain'
import {
  computeSetIntensity,
  computeSetLoad,
  computeSetTonnage,
  getEffortScore,
  getWeekKey,
  isHardSet,
  type MetricsSet
} from '@/lib/session-metrics'

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

type TrainingLoadSummary = {
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const getIntensityBaseline = (intensity?: Intensity | null) => {
  if (intensity === 'low') return 6
  if (intensity === 'high') return 8.5
  return 7
}

const weightedAverage = (values: Array<number | null>, weights: number[]) => {
  let total = 0
  let weightSum = 0
  values.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    const weight = Number.isFinite(weights[index]) && weights[index] > 0 ? weights[index] : 1
    total += value * weight
    weightSum += weight
  })
  if (!weightSum) return null
  return total / weightSum
}

const getPerformedAtWindowMinutes = (sets: MetricsSet[]) => {
  const timestamps = sets
    .map((set) => (set.performedAt ? new Date(set.performedAt).getTime() : NaN))
    .filter((value) => Number.isFinite(value))
  if (timestamps.length < 2) return null
  const minTime = Math.min(...timestamps)
  const maxTime = Math.max(...timestamps)
  const minutes = (maxTime - minTime) / 60000
  return minutes > 0 ? minutes : null
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
  const avgEffort = weightedAverage(sets.map(getEffortScore), tonnageWeights)
  const avgIntensity = weightedAverage(sets.map(computeSetIntensity), tonnageWeights)
  const avgRestSeconds = weightedAverage(
    sets.map((set) => (typeof set.restSecondsActual === 'number' ? set.restSecondsActual : null)),
    tonnageWeights
  )

  const performedMinutes = getPerformedAtWindowMinutes(sets)
  const durationMinutes = performedMinutes ?? (() => {
    if (!startedAt || !endedAt) return null
    const start = new Date(startedAt).getTime()
    const end = new Date(endedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    const minutes = (end - start) / 60000
    return minutes > 0 ? minutes : null
  })()

  const density = durationMinutes ? tonnage / durationMinutes : null
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
    density: density ? Number(density.toFixed(1)) : null,
    workload: Math.round(workload),
    sessionRpe: sessionRpe ? Number(sessionRpe.toFixed(1)) : null,
    sRpeLoad: sRpeLoad ? Math.round(sRpeLoad) : null
  }
}

export const computeReadinessScore = (survey: ReadinessSurvey) => {
  const values = Object.values(survey)
  if (values.some((value) => !Number.isFinite(value))) return null
  
  const normalize = (value: number) => clamp(value, 1, 5)
  
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
  if (score >= 70) return 'high'
  if (score < 40) return 'low'
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

  const sessionTimes = sessions.map((session) => new Date(session.startedAt).getTime()).filter(Number.isFinite)
  const lastSessionTime = sessionTimes.length ? Math.max(...sessionTimes) : null
  const firstSessionTime = sessionTimes.length ? Math.min(...sessionTimes) : null
  const daysSinceLast = lastSessionTime ? Math.max(0, (nowTime - lastSessionTime) / 86400000) : null
  const historyDays = firstSessionTime ? (nowTime - firstSessionTime) / 86400000 : 0
  const sessionCount = sessions.length

  sessions.forEach((session) => {
    const sessionMetrics = computeSessionMetrics(session)
    const dayKey = new Date(session.startedAt).toISOString().slice(0, 10)
    dailyLoads.set(dayKey, (dailyLoads.get(dayKey) ?? 0) + sessionMetrics.workload)

    const weekKey = getWeekKey(session.startedAt)
    weeklyLoads.set(weekKey, (weeklyLoads.get(weekKey) ?? 0) + sessionMetrics.workload)
  })

  const acuteWindow = 7 * 86400000
  const chronicWindow = 28 * 86400000
  let acuteLoad = 0
  let chronicLoad = 0

  sessions.forEach((session) => {
    const time = new Date(session.startedAt).getTime()
    if (!Number.isFinite(time)) return
    const delta = nowTime - time
    if (delta < 0) return // Skip future sessions relative to calculation date

    const sessionLoad = computeSessionMetrics(session).workload
    if (delta <= acuteWindow) acuteLoad += sessionLoad
    if (delta <= chronicWindow) chronicLoad += sessionLoad
  })

  const chronicWeeklyAverage = chronicLoad ? chronicLoad / 4 : 0
  const loadRatio = chronicWeeklyAverage ? acuteLoad / chronicWeeklyAverage : 0
  
  // ACR is statistically volatile until we have ~14 days of history and ~4 sessions.
  const isInitialPhase = historyDays < 14 || sessionCount < 4

  let status: 'undertraining' | 'balanced' | 'overreaching' = 'balanced'
  if (!isInitialPhase) {
    if (loadRatio >= 1.3) {
      status = 'overreaching'
    } else if (loadRatio <= 0.8 && chronicLoad > 0) {
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