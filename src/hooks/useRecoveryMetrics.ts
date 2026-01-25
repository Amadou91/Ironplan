'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { 
  transformSessionsToBodyWeightTrend,
  transformSessionsToReadinessTrend
} from '@/lib/transformers/chart-data'
import { type SessionRow } from '@/lib/transformers/progress-data'
import { computeSessionMetrics } from '@/lib/training-metrics'
import type { WeightUnit } from '@/types/domain'

export type ReadinessRow = {
  id: string
  session_id: string
  recorded_at: string
  sleep_quality: number
  muscle_soreness: number
  stress_level: number
  motivation: number
  readiness_score: number | null
  readiness_level: 'low' | 'steady' | 'high' | null
}

export function useRecoveryMetrics(options: { 
  startDate?: string; 
  endDate?: string;
  sessions: SessionRow[]
} = { sessions: [] }) {
  const { startDate, endDate, sessions } = options
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  
  const [readinessEntries, setReadinessEntries] = useState<ReadinessRow[]>([])
  const [bodyWeightHistory, setBodyWeightHistory] = useState<Array<{ recorded_at: string; weight_lb: number; source: string }>>([])

  useEffect(() => {
    if (userLoading || !user || !sessions.length) return

    const loadReadiness = async () => {
      const sessionIds = sessions.map(s => s.id)
      const { data, error } = await supabase
        .from('session_readiness')
        .select('*')
        .in('session_id', sessionIds)
        .order('recorded_at', { ascending: false })

      if (!error && data) {
        setReadinessEntries(data as ReadinessRow[])
      }
    }

    loadReadiness()
  }, [user, userLoading, sessions, supabase])

  useEffect(() => {
    if (userLoading || !user) return

    const loadBodyWeight = async () => {
      let query = supabase
        .from('body_measurements')
        .select('recorded_at, weight_lb, source')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: true })
      
      if (startDate) {
        const start = new Date(startDate)
        start.setDate(start.getDate() - 1)
        query = query.gte('recorded_at', start.toISOString())
      }

      const { data } = await query
      if (data) setBodyWeightHistory(data)
    }

    loadBodyWeight()
  }, [user, userLoading, supabase, startDate])

  const readinessBySessionId = useMemo(() => new Map(readinessEntries.map(e => [e.session_id, e])), [readinessEntries])

  const readinessSessions = useMemo(() => {
    return sessions.map(session => {
      const entry = readinessBySessionId.get(session.id)
      return entry ? { session, entry } : null
    }).filter((v): v is { session: SessionRow; entry: ReadinessRow } => Boolean(v))
  }, [sessions, readinessBySessionId])

  const readinessAverages = useMemo(() => {
    if (!readinessSessions.length) return null
    const totals = { sleep: 0, soreness: 0, stress: 0, motivation: 0, score: 0, scoreCount: 0, count: 0 }
    readinessSessions.forEach(({ entry }) => {
      totals.sleep += entry.sleep_quality
      totals.soreness += entry.muscle_soreness
      totals.stress += entry.stress_level
      totals.motivation += entry.motivation
      totals.count += 1
      if (typeof entry.readiness_score === 'number') {
        totals.score += entry.readiness_score
        totals.scoreCount += 1
      }
    })
    const d = totals.count || 1
    return {
      sleep: totals.sleep / d, soreness: totals.soreness / d,
      stress: totals.stress / d, motivation: totals.motivation / d,
      score: totals.scoreCount ? totals.score / totals.scoreCount : null,
      count: totals.count
    }
  }, [readinessSessions])

  const readinessCorrelation = useMemo(() => {
    return readinessSessions.map(({ session, entry }) => {
      const metricSets = session.session_exercises.flatMap(e => e.sets.filter(s => s.completed !== false).map(s => ({
        reps: s.reps ?? null, weight: s.weight ?? null,
        weightUnit: (s.weight_unit as WeightUnit) ?? null,
        rpe: typeof s.rpe === 'number' ? s.rpe : null,
        rir: typeof s.rir === 'number' ? s.rir : null,
        performedAt: s.performed_at ?? null
      })))
      const metrics = computeSessionMetrics({ startedAt: session.started_at, endedAt: session.ended_at, sets: metricSets })
      return { readiness: entry.readiness_score, effort: metrics.avgEffort, workload: metrics.workload }
    }).filter((p): p is { readiness: number; effort: number; workload: number } => typeof p.readiness === 'number' && typeof p.effort === 'number')
  }, [readinessSessions])

  const readinessTrendLine = useMemo(() => {
    if (readinessCorrelation.length < 2) return []
    const n = readinessCorrelation.length
    const sumX = readinessCorrelation.reduce((acc, p) => acc + p.readiness, 0)
    const sumY = readinessCorrelation.reduce((acc, p) => acc + p.effort, 0)
    const sumXY = readinessCorrelation.reduce((acc, p) => acc + p.readiness * p.effort, 0)
    const sumXX = readinessCorrelation.reduce((acc, p) => acc + p.readiness * p.readiness, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const minX = Math.min(...readinessCorrelation.map((p) => p.readiness))
    const maxX = Math.max(...readinessCorrelation.map((p) => p.readiness))

    return [
      { readiness: minX, effort: slope * minX + intercept },
      { readiness: maxX, effort: slope * maxX + intercept }
    ]
  }, [readinessCorrelation])

  return {
    readinessAverages,
    readinessSeries: useMemo(() => transformSessionsToReadinessTrend(readinessSessions), [readinessSessions]),
    readinessCorrelation,
    readinessTrendLine,
    bodyWeightData: useMemo(() => transformSessionsToBodyWeightTrend(sessions, bodyWeightHistory, { startDate, endDate }), [bodyWeightHistory, sessions, startDate, endDate]),
    readinessComponents: useMemo(() => {
      if (!readinessAverages) return []
      return [
        { metric: 'Sleep', value: Number(readinessAverages.sleep.toFixed(1)), ideal: 4.0 },
        { metric: 'Soreness', value: Number(readinessAverages.soreness.toFixed(1)), ideal: 2.0 },
        { metric: 'Stress', value: Number(readinessAverages.stress.toFixed(1)), ideal: 2.0 },
        { metric: 'Motivation', value: Number(readinessAverages.motivation.toFixed(1)), ideal: 4.0 }
      ]
    }, [readinessAverages])
  }
}
