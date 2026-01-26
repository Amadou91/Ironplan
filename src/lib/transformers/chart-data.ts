import { computeSetLoad, computeSetTonnage, getWeekKey, getEffortScore, computeSetE1rm } from '@/lib/session-metrics'
import { toMuscleSlug, toMuscleLabel, PRESET_MAPPINGS } from '@/lib/muscle-utils'
import type { Goal, MetricProfile } from '@/types/domain'

export interface VolumeTrendPoint {
  label: string
  volume: number
  load: number
  volumeTrend: number | null
  loadTrend: number | null
  isDaily: boolean
  timestamp: number
}

export interface EffortTrendPoint {
  day: string
  effort: number
  timestamp: number
  trend: number | null
}

export interface ExerciseTrendPoint {
  day: string
  e1rm: number
  timestamp: number
  trend: number | null
}

export interface MuscleBreakdownItem {
  slug: string
  muscle: string
  volume: number
  relativePct: number
  imbalanceIndex: number | null
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
  trend: number | null
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
  weight_unit?: string | null
  weightUnit?: string | null
  rpe?: number | null
  rir?: number | null
  duration_seconds?: number | null
  exerciseName?: string
  primaryMuscle?: string | null
  secondaryMuscles?: string[] | null
}

/**
 * Calculates a linear regression best fit for a set of points.
 */
function calculateLinearRegression(points: { x: number; y: number }[]) {
  const n = points.length
  if (n < 2) return null

  const sumX = points.reduce((acc, p) => acc + p.x, 0)
  const sumY = points.reduce((acc, p) => acc + p.y, 0)
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0)
  const sumXX = points.reduce((acc, p) => acc + p.x * p.x, 0)

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

export const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString()
  }
  return date.toLocaleDateString()
}

export const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || value.endsWith('T00:00:00.000Z') || value.endsWith('T00:00:00Z')) {
    const [year, month, day] = value.split('T')[0].split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString([], { dateStyle: 'medium' })
  }
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return 'N/A'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'N/A'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

export const formatChartDate = (value: string | number) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const formatDateForInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
    
    const tonnage = computeSetTonnage({
      metricProfile: set.metricProfile as MetricProfile,
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: (set.weight_unit ?? set.weightUnit) as 'lb' | 'kg' | null
    })
    const load = computeSetLoad({
      metricProfile: set.metricProfile as MetricProfile,
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: (set.weight_unit ?? set.weightUnit) as 'lb' | 'kg' | null,
      rpe: typeof set.rpe === 'number' ? set.rpe : null,
      rir: typeof set.rir === 'number' ? set.rir : null,
      durationSeconds: set.duration_seconds ?? null
    })
    if (!tonnage && !load) return
    const entry = totals.get(key) ?? { volume: 0, load: 0 }
    entry.volume += tonnage
    entry.load += load
    totals.set(key, entry)
  })

  const results = Array.from(totals.entries())
    .sort(([a], [b]) => {
      if (useDaily) return new Date(a).getTime() - new Date(b).getTime()
      return a.localeCompare(b)
    })
    .map(([label, values], index) => ({ 
      label: useDaily ? formatChartDate(label) : label, 
      volume: Math.round(values.volume), 
      load: Math.round(values.load),
      volumeTrend: null as number | null,
      loadTrend: null as number | null,
      isDaily: useDaily,
      timestamp: index // Use index for regression to avoid issues with date gaps
    }))

  if (results.length >= 2) {
    const volFit = calculateLinearRegression(results.map(r => ({ x: r.timestamp, y: r.volume })))
    const loadFit = calculateLinearRegression(results.map(r => ({ x: r.timestamp, y: r.load })))
    
    if (volFit) {
      results.forEach(r => r.volumeTrend = Math.round(volFit.slope * r.timestamp + volFit.intercept))
    }
    if (loadFit) {
      results.forEach(r => r.loadTrend = Math.round(loadFit.slope * r.timestamp + loadFit.intercept))
    }
  }

  return results
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

  const sortedDaily = Array.from(daily.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value], index) => ({
      day: formatChartDate(day),
      effort: Number((value.total / value.count).toFixed(1)),
      timestamp: index,
      trend: null as number | null
    }))

  if (sortedDaily.length >= 2) {
    const fit = calculateLinearRegression(sortedDaily.map(d => ({ x: d.timestamp, y: d.effort })))
    if (fit) {
      sortedDaily.forEach(d => d.trend = Number((fit.slope * d.timestamp + fit.intercept).toFixed(1)))
    }
  }

  return sortedDaily
}

export function transformSessionsToExerciseTrend(
  allSets: AnalyzedSet[],
  sessions: { id: string; template_id: string | null }[],
  templateById: Map<string, { style: Goal }>,
  exerciseLibraryByName: Map<string, { e1rmEligible?: boolean }>,
  selectedExercise: string
): ExerciseTrendPoint[] {
  const daily = new Map<string, number>()
  allSets.forEach((set) => {
    if (selectedExercise !== 'all' && set.exerciseName !== selectedExercise) return
    if (!set.exerciseName) return

    const session = sessions.find((s) => s.id === set.sessionId)
    const template = session?.template_id ? templateById.get(session.template_id) : null
    const sessionGoal = template?.style
    const isEligible = exerciseLibraryByName.get(set.exerciseName.toLowerCase())?.e1rmEligible

    const e1rm = computeSetE1rm({
      ...set,
      metricProfile: set.metricProfile as MetricProfile,
      weightUnit: (set.weight_unit ?? set.weightUnit) as 'lb' | 'kg' | null
    }, sessionGoal, isEligible)
    if (!e1rm) return
    const date = set.performed_at ?? set.startedAt
    if (!date) return
    const key = formatDateForInput(new Date(date))
    const current = daily.get(key)
    daily.set(key, Math.max(current ?? 0, e1rm))
  })

  const sortedDaily = Array.from(daily.entries())
    .map(([day, e1rm], index) => ({ 
      day: formatChartDate(day), 
      e1rm: Math.round(e1rm), 
      timestamp: index, 
      trend: null as number | null 
    }))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (sortedDaily.length >= 2) {
    const fit = calculateLinearRegression(sortedDaily.map(d => ({ x: d.timestamp, y: d.e1rm })))
    if (fit) {
      sortedDaily.forEach(d => d.trend = Math.round(fit.slope * d.timestamp + fit.intercept))
    }
  }

  return sortedDaily
}

export function transformSetsToMuscleBreakdown(
  allSets: AnalyzedSet[],
  selectedMuscle: string
): MuscleBreakdownItem[] {
  const totals = new Map<string, number>()
  allSets.forEach((set) => {
    const tonnage = computeSetTonnage({
      metricProfile: set.metricProfile as MetricProfile,
      reps: set.reps ?? null,
      weight: set.weight ?? null,
      weightUnit: (set.weight_unit ?? set.weightUnit) as 'lb' | 'kg' | null
    })
    if (!tonnage) return
    
    const primary = toMuscleSlug(set.primaryMuscle ?? 'unknown')
    if (primary) {
      totals.set(primary, (totals.get(primary) ?? 0) + tonnage)
    }

    if (set.secondaryMuscles && Array.isArray(set.secondaryMuscles)) {
      set.secondaryMuscles.forEach(secondary => {
        if (secondary) {
          const secondarySlug = toMuscleSlug(secondary)
          if (secondarySlug) {
            totals.set(secondarySlug, (totals.get(secondarySlug) ?? 0) + (tonnage * 0.5))
          }
        }
      })
    }
  })

  const data = Array.from(totals.entries())
    .map(([muscleSlug, volume]) => ({
      slug: muscleSlug,
      muscle: toMuscleLabel(muscleSlug),
      volume: Math.round(volume)
    }))
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
    .map((p, index) => ({ ...p, trend: null as number | null, index }))

  if (combined.length >= 2) {
    const fit = calculateLinearRegression(combined.map(p => ({ x: p.index, y: p.weight })))
    if (fit) {
      combined.forEach(p => p.trend = fit.slope * p.index + fit.intercept)
    }
  }

  return combined.map(({ index, ...p }) => p)
}

export function transformSessionsToReadinessTrend(
  readinessSessions: { session: { started_at: string }; entry: { recorded_at: string; readiness_score: number | null; sleep_quality: number; muscle_soreness: number; stress_level: number; motivation: number } }[]
): ReadinessTrendPoint[] {
  const points = readinessSessions
    .map(({ session, entry }, index) => {
      const timestamp = new Date(entry.recorded_at || session.started_at).getTime()
      const dayKey = formatDateForInput(new Date(session.started_at))
      return {
        day: formatChartDate(dayKey),
        timestamp,
        score: entry.readiness_score,
        trend: null as number | null,
        sleep: entry.sleep_quality,
        soreness: entry.muscle_soreness,
        stress: entry.stress_level,
        motivation: entry.motivation,
        index
      }
    })
    .sort((a, b) => a.timestamp - b.timestamp)

  if (points.length >= 2) {
    const validPoints = points.filter(p => typeof p.score === 'number') as (typeof points[0] & { score: number })[]
    if (validPoints.length >= 2) {
      const fit = calculateLinearRegression(validPoints.map(p => ({ x: p.index, y: p.score })))
      if (fit) {
        points.forEach(p => p.trend = Math.round(fit.slope * p.index + fit.intercept))
      }
    }
  }

  return points.map(({ index, ...p }) => p)
}