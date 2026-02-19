'use client'

import { useMemo } from 'react'
import { useRecoveryMetrics } from '@/hooks/useRecoveryMetrics'
import { analyzeTrainingStatus, getSuggestedWorkout, type WorkoutSuggestion } from '@/lib/suggestion-logic'
import type { SessionRow } from '@/lib/transformers/progress-data'

export function useWorkoutSuggestion(sessions: SessionRow[]) {
  const { readinessAverages } = useRecoveryMetrics({ sessions })

  const suggestion = useMemo(() => {
    if (!sessions.length) return null

    // Analyze history
    const analysis = analyzeTrainingStatus(sessions)

    // Get suggestion
    // We construct a partial ReadinessRow from averages if full row isn't available
    // In a real app we might want the *latest* readiness entry specifically, 
    // but averages over the last window is what useRecoveryMetrics returns easily.
    // Actually useRecoveryMetrics calculates averages for the *displayed* range.
    // We probably want the most recent readiness entry for "Today's" suggestion.
    
    // For now, let's use the average as a proxy or null if not available.
    // Ideally we'd fetch the specific latest entry.
    // Let's rely on the fact that analyzeTrainingStatus checks history 
    // and we can pass a mock readiness based on averages if needed.
    
    const mockReadiness = readinessAverages ? {
      readiness_score: readinessAverages.score,
      sleep_quality: readinessAverages.sleep,
      muscle_soreness: readinessAverages.soreness,
      stress_level: readinessAverages.stress,
      motivation: readinessAverages.motivation,
      id: 'avg',
      session_id: 'avg',
      recorded_at: new Date().toISOString(),
      readiness_level: readinessAverages.score ? (readinessAverages.score < 45 ? 'low' : readinessAverages.score > 70 ? 'high' : 'steady') : 'steady'
    } : null

    // We can interpret the readiness score from averages for now.
    // A better approach would be to expose `readinessEntries` from useRecoveryMetrics
    // and pick the latest one.
    
    return getSuggestedWorkout(analysis, mockReadiness as any)
  }, [sessions, readinessAverages])

  return suggestion
}
