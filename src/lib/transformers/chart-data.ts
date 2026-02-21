import {
  computeSetLoad,
  computeSetTonnage,
  getWeekKey,
  getEffortScore,
  computeSetE1rm,
  computeRelativeStrength
} from '@/lib/session-metrics'
import { mapSetLikeToMetricsSet } from '@/lib/transformers/metric-set'
import { toMuscleSlug, toMuscleLabel, PRESET_MAPPINGS } from '@/lib/muscle-utils'
import { clamp } from '@/lib/math'
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatChartDate,
  formatDateForInput
} from '@/lib/date-utils'

// Re-export date utilities for backwards compatibility
export { formatDate, formatDateTime, formatDuration, formatChartDate, formatDateForInput }

export interface VolumeTrendPoint {
  label: string
  volume: number
  load: number
  isDaily: boolean
}

export interface EffortTrendPoint {
  day: string
  effort: number
}

export interface ExerciseTrendPoint {
  day: string
  e1rm: number
  timestamp: number
  trend: number | null
  relativeE1rm: number | null
  momentum: number | null
}

export interface MuscleBreakdownItem {
  slug: string
  muscle: string
  volume: number
  relativePct: number
  imbalanceIndex: number | null
  daysPerWeek: number
  recoveryEstimate: number
}

export interface BodyWeightTrendPoint {
  day: string
  dayKey: string
  timestamp: number
  weight: number
  trend: number | null
}

export interface ReadinessTrendPoint {
  day: string
  timestamp: number
  score: number | null
  sleep: number
  soreness: number
  stress: number
  motivation: number
}

export type AnalyzedSet = {
  sessionId?: string
  startedAt?: string
  performed_at?: string | null
  performedAt?: string | null
  metricProfile?: string | null
  reps?: number | null
  weight?: number | null
  implement_count?: number | null
  load_type?: string | null
  weight_unit?: string | null
  weightUnit?: string | null
  rpe?: number | null
  rir?: number | null
  duration_seconds?: number | null
  exerciseName?: string
  primaryMuscle?: string | null
  secondaryMuscles?: string[] | null
}

// Date formatting functions imported from @/lib/date-utils and re-exported above

const MUSCLE_TARGET_DISTRIBUTION: Record<string, number> = {
  chest: 12,
  back: 18,
  shoulders: 8,
  quads: 20,
  hamstrings: 15,
  glutes: 12,
  biceps: 4,
  triceps: 4,
  core: 5,
  calves: 2
}

interface TransformOptions {
  startDate?: string
  endDate?: string
}

export function transformSessionsToVolumeTrend(
  allSets: AnalyzedSet[],
  filteredSessions: { started_at: string }[],
  options: TransformOptions = {}
): VolumeTrendPoint[] {
  const { startDate, endDate } = options
  const totals = new Map<string, { volume: number; load: number }>()
  
  let useDaily = false
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays < 14) useDaily = true
  } else if (startDate || endDate) {
    const dates = filteredSessions.map(s => new Date(s.started_at).getTime())
    if (dates.length > 0) {
      const min = Math.min(...dates)
      const max = Math.max(...dates)
      const diffDays = (max - min) / (1000 * 60 * 60 * 24)
      if (diffDays < 14) useDaily = true
    }
  } else if (filteredSessions.length > 0) {
    const dates = filteredSessions.map(s => new Date(s.started_at).getTime())
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    const diffDays = (max - min) / (1000 * 60 * 60 * 24)
    if (diffDays < 14) useDaily = true
  }

  allSets.forEach((set) => {
    const date = set.performed_at ?? set.startedAt
    if (!date) return
    const key = useDaily ? formatDate(date) : getWeekKey(date)

    const metricsSet = mapSetLikeToMetricsSet(set)
    const tonnage = computeSetTonnage(metricsSet)
    const load = computeSetLoad(metricsSet)
    if (!tonnage && !load) return
    const entry = totals.get(key) ?? { volume: 0, load: 0 }
    entry.volume += tonnage
    entry.load += load
    totals.set(key, entry)
  })

  return Array.from(totals.entries())
    .sort(([a], [b]) => {
      if (useDaily) return new Date(a).getTime() - new Date(b).getTime()
      return a.localeCompare(b)
    })
    .map(([label, values]) => ({ 
      label: useDaily ? formatChartDate(label) : label, 
      volume: Math.round(values.volume), 
      load: Math.round(values.load),
      isDaily: useDaily
    }))
}

export function transformSessionsToEffortTrend(allSets: AnalyzedSet[]): EffortTrendPoint[] {
  const daily = new Map<string, { total: number; count: number }>()
  allSets.forEach((set) => {
    const raw = getEffortScore({
      rpe: typeof set.rpe === 'number' ? set.rpe : null,
      rir: typeof set.rir === 'number' ? set.rir : null
    })
    if (raw === null) return
    const date = set.performed_at ?? set.startedAt
    if (!date) return
    const key = formatDateForInput(new Date(date))
    const current = daily.get(key) ?? { total: 0, count: 0 }
    daily.set(key, { total: current.total + raw, count: current.count + 1 })
  })
  return Array.from(daily.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({
      day: formatChartDate(day),
      effort: Number((value.total / value.count).toFixed(1))
    }))
}

export function transformSessionsToExerciseTrend(
  allSets: AnalyzedSet[],
  exerciseLibraryByName: Map<string, { e1rmEligible?: boolean; movementPattern?: string }>,
  selectedExercise: string,
  bodyWeightBySessionId: Map<string, number> = new Map()
): ExerciseTrendPoint[] {
  const daily = new Map<string, { e1rm: number; sessionId: string }>()
  allSets.forEach((set) => {
    if (selectedExercise !== 'all' && set.exerciseName !== selectedExercise) return
    if (!set.exerciseName) return

    const libEntry = exerciseLibraryByName.get(set.exerciseName.toLowerCase())
    const isEligible = libEntry?.e1rmEligible
    const movementPattern = libEntry?.movementPattern

    const e1rm = computeSetE1rm(mapSetLikeToMetricsSet(set), null, isEligible, movementPattern)
    if (!e1rm) return
    const date = set.performed_at ?? set.startedAt
    if (!date) return
    const key = formatDateForInput(new Date(date))
    const current = daily.get(key)
    if (!current || e1rm > current.e1rm) {
      daily.set(key, { e1rm, sessionId: set.sessionId ?? '' })
    }
  })

  const sortedDaily = Array.from(daily.entries())
    .map(([day, val]) => {
      const bodyWeight = bodyWeightBySessionId.get(val.sessionId)
      return { 
        day: formatChartDate(day), 
        e1rm: Math.round(val.e1rm), 
        timestamp: new Date(day).getTime(), 
        trend: null as number | null,
        relativeE1rm: (() => {
          const relative = computeRelativeStrength(val.e1rm, bodyWeight ?? null)
          return typeof relative === 'number' ? Number(relative.toFixed(2)) : null
        })(),
        momentum: null as number | null
      }
    })
    .sort((a, b) => a.timestamp - b.timestamp)

  if (sortedDaily.length >= 3) {
    sortedDaily.forEach((point, idx) => {
      const windowSize = 7 * 86400000 
      const window = sortedDaily.filter(p => p.timestamp <= point.timestamp && p.timestamp > point.timestamp - windowSize)
      if (window.length > 0) {
        const sum = window.reduce((acc, p) => acc + p.e1rm, 0)
        point.trend = Math.round(sum / window.length)
      }

      // Calculate momentum (slope of trend between current and 2 points back)
      if (idx >= 2 && point.trend !== null && sortedDaily[idx - 2].trend !== null) {
        const prevTrend = sortedDaily[idx - 2].trend!
        const delta = point.trend - prevTrend
        const dayDelta = (point.timestamp - sortedDaily[idx - 2].timestamp) / (86400000)
        if (dayDelta > 0) {
          point.momentum = Number((delta / dayDelta).toFixed(2))
        }
      }
    })
  }

  return sortedDaily
}

export function transformSetsToMuscleBreakdown(
  allSets: AnalyzedSet[],
  selectedMuscle: string,
  options: { startDate?: string; endDate?: string } = {}
): MuscleBreakdownItem[] {
  const totals = new Map<string, number>()
  const uniqueDays = new Map<string, Set<string>>()
  const fatigueByMuscle = new Map<string, number>()
  const now = new Date().getTime()
  
  // Recovery decay: 40% every 24 hours (e^-0.51 per day)
  const DECAY_CONSTANT = 0.51 / (24 * 60 * 60 * 1000)

  allSets.forEach((set) => {
    const tonnage = computeSetTonnage(mapSetLikeToMetricsSet(set))
    if (!tonnage) return
    
    const dateStr = set.performed_at ?? set.startedAt
    if (!dateStr) return
    const dayKey = formatDateForInput(new Date(dateStr))
    const timestamp = new Date(dateStr).getTime()
    const ageMs = now - timestamp

    const processMuscle = (slug: string, weight: number) => {
      totals.set(slug, (totals.get(slug) ?? 0) + (tonnage * weight))
      
      const days = uniqueDays.get(slug) ?? new Set()
      days.add(dayKey)
      uniqueDays.set(slug, days)

      // Simple fatigue contribution (tonnage-based, decayed to now)
      // Normalize tonnage so ~10,000 lbs in a session = 100% fatigue
      const sessionFatigue = (tonnage * weight) / 100
      const decayedFatigue = sessionFatigue * Math.exp(-DECAY_CONSTANT * ageMs)
      fatigueByMuscle.set(slug, (fatigueByMuscle.get(slug) ?? 0) + decayedFatigue)
    }

    const primary = toMuscleSlug(set.primaryMuscle ?? 'unknown')
    if (primary) processMuscle(primary, 1.0)

    if (set.secondaryMuscles && Array.isArray(set.secondaryMuscles)) {
      set.secondaryMuscles.forEach(secondary => {
        if (secondary) {
          const secondarySlug = toMuscleSlug(secondary)
          if (secondarySlug) processMuscle(secondarySlug, 0.5)
        }
      })
    }
  })

  // Calculate week range for daysPerWeek
  let numWeeks = 1
  if (options.startDate && options.endDate) {
    const start = new Date(options.startDate).getTime()
    const end = new Date(options.endDate).getTime()
    numWeeks = Math.max(1, (end - start) / (7 * 86400000))
  } else {
    const dates = allSets.map(s => new Date(s.performed_at ?? s.startedAt ?? 0).getTime()).filter(t => t > 0)
    if (dates.length > 1) {
      numWeeks = Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (7 * 86400000))
    }
  }

  const data = Array.from(totals.entries())
    .map(([muscleSlug, volume]) => {
      const daysCount = uniqueDays.get(muscleSlug)?.size ?? 0
      const fatigue = fatigueByMuscle.get(muscleSlug) ?? 0
      
      return {
        slug: muscleSlug,
        muscle: toMuscleLabel(muscleSlug),
        volume: Math.round(volume),
        daysPerWeek: Number((daysCount / numWeeks).toFixed(1)),
        recoveryEstimate: Math.round(clamp(100 - fatigue, 0, 100))
      }
    })
    .filter((item) => {
      if (selectedMuscle === 'all') return true
      const targetMuscles = PRESET_MAPPINGS[selectedMuscle] || [selectedMuscle]
      return targetMuscles.includes(item.slug.toLowerCase())
    })

  const totalVolume = data.reduce((sum, item) => sum + item.volume, 0)
  const totalTargetPct = data.reduce((sum, item) => sum + (MUSCLE_TARGET_DISTRIBUTION[item.slug] || 0), 0)

  return data.map(item => {
    const relativePct = totalVolume > 0 ? (item.volume / totalVolume) * 100 : 0
    const rawTarget = MUSCLE_TARGET_DISTRIBUTION[item.slug] || 0
    const normalizedTarget = totalTargetPct > 0 ? (rawTarget / totalTargetPct) * 100 : 0
    const imbalanceIndex = normalizedTarget > 0 ? (relativePct / normalizedTarget) * 100 : null

    return {
      ...item,
      relativePct: Number(relativePct.toFixed(1)),
      imbalanceIndex: imbalanceIndex !== null ? Math.round(imbalanceIndex) : null,
    }
  })
}

export function transformSessionsToBodyWeightTrend(
  filteredSessions: { started_at: string; body_weight_lb?: number | null }[],
  bodyWeightHistory: { recorded_at: string; weight_lb: number; source: string }[],
  options: TransformOptions = {}
): BodyWeightTrendPoint[] {
  const { startDate, endDate } = options
  const rawPoints: Array<{ dayKey: string; timestamp: number; weight: number; source: string }> = []
  
  filteredSessions.forEach(session => {
    if (session.body_weight_lb) {
      const date = new Date(session.started_at)
      rawPoints.push({
        dayKey: formatDateForInput(date),
        timestamp: date.getTime(),
        weight: Number(session.body_weight_lb),
        source: 'session'
      })
    }
  })

  bodyWeightHistory.forEach(entry => {
    const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(entry.recorded_at) 
      ? entry.recorded_at.split('T')[0]
      : (entry.recorded_at.endsWith('T00:00:00.000Z') || entry.recorded_at.endsWith('T00:00:00Z'))
        ? entry.recorded_at.split('T')[0]
        : formatDateForInput(new Date(entry.recorded_at))

    const [year, month, day] = dayKey.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    rawPoints.push({
      dayKey,
      timestamp: date.getTime(),
      weight: Number(entry.weight_lb),
      source: entry.source || 'history'
    })
  })

  if (rawPoints.length === 0) return []

  const consolidated = new Map<string, typeof rawPoints[0]>()
  rawPoints.sort((a, b) => a.timestamp - b.timestamp).forEach(p => {
    const existing = consolidated.get(p.dayKey)
    
    const getPriority = (source: string) => {
      if (source === 'user') return 10
      if (source === 'session') return 5
      return 1
    }

    if (!existing || getPriority(p.source) > getPriority(existing.source) || (p.source === existing.source && p.timestamp >= existing.timestamp)) {
      consolidated.set(p.dayKey, p)
    }
  })

  const sortedUniqueMeasurements = Array.from(consolidated.values()).sort((a, b) => a.timestamp - b.timestamp)

  const allPointsByDay = new Map<string, { day: string; dayKey: string; timestamp: number; weight: number }>()
  
  sortedUniqueMeasurements.forEach(p => {
    if (startDate && p.dayKey < startDate) return
    if (endDate && p.dayKey > endDate) return

    const [year, month, day] = p.dayKey.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    allPointsByDay.set(p.dayKey, {
      day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      dayKey: p.dayKey,
      timestamp: p.timestamp,
      weight: p.weight
    })
  })

  filteredSessions.forEach(session => {
    const date = new Date(session.started_at)
    const dayKey = formatDateForInput(date)
    if (allPointsByDay.has(dayKey)) return
    if (startDate && dayKey < startDate) return
    if (endDate && dayKey > endDate) return

    const last = sortedUniqueMeasurements.filter(p => p.timestamp <= date.getTime()).pop()
    if (last) {
      allPointsByDay.set(dayKey, {
        day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        dayKey: dayKey,
        timestamp: date.getTime(),
        weight: last.weight
      })
    }
  })

  const combined = Array.from(allPointsByDay.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(p => ({ ...p, trend: null as number | null }))

  if (combined.length >= 2) {
    const n = combined.length
    const sumX = combined.reduce((acc, p) => acc + p.timestamp, 0)
    const sumY = combined.reduce((acc, p) => acc + p.weight, 0)
    const sumXY = combined.reduce((acc, p) => acc + p.timestamp * p.weight, 0)
    const sumXX = combined.reduce((acc, p) => acc + p.timestamp * p.timestamp, 0)

    const denominator = (n * sumXX - sumX * sumX)
    if (denominator !== 0) {
      const slope = (n * sumXY - sumX * sumY) / denominator
      const intercept = (sumY - slope * sumX) / n
      combined.forEach(p => {
        p.trend = slope * p.timestamp + intercept
      })
    }
  }

  return combined
}

export function transformSessionsToReadinessTrend(
  readinessSessions: { session: { started_at: string }; entry: { recorded_at: string; readiness_score: number | null; sleep_quality: number; muscle_soreness: number; stress_level: number; motivation: number } }[]
): ReadinessTrendPoint[] {
  return readinessSessions
    .map(({ session, entry }) => {
      const timestamp = new Date(entry.recorded_at || session.started_at).getTime()
      const dayKey = formatDateForInput(new Date(session.started_at))
      return {
        day: formatChartDate(dayKey),
        timestamp,
        score: entry.readiness_score,
        sleep: entry.sleep_quality,
        soreness: entry.muscle_soreness,
        stress: entry.stress_level,
        motivation: entry.motivation
      }
    })
    .sort((a, b) => a.timestamp - b.timestamp)
}
