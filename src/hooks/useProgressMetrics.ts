'use client'

import { useMemo, useState } from 'react'
import { RECENT_ACTIVITY_WINDOW_DAYS } from '@/constants/training'
import { useStrengthMetrics } from './useStrengthMetrics'
import { useRecoveryMetrics } from './useRecoveryMetrics'
import { formatDateForInput, getNowET } from '@/lib/date-utils'

export const createPastRange = (days: number) => {
  const end = getNowET()
  end.setHours(23, 59, 59, 999)
  const start = new Date(end)
  start.setDate(end.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

export function useProgressMetrics() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedExercise, setSelectedExercise] = useState('all')

  const coachActionWindow = useMemo(() => {
    const { start, end } = createPastRange(RECENT_ACTIVITY_WINDOW_DAYS)
    return {
      startDate: formatDateForInput(start),
      endDate: formatDateForInput(end),
      timeHorizonLabel: `Last ${RECENT_ACTIVITY_WINDOW_DAYS} days`
    }
  }, [])

  const strength = useStrengthMetrics({ startDate, endDate, selectedMuscle, selectedExercise })
  const recovery = useRecoveryMetrics({ startDate, endDate, sessions: strength.sessions })
  const coachStrength = useStrengthMetrics({
    startDate: coachActionWindow.startDate,
    endDate: coachActionWindow.endDate,
    selectedMuscle,
    selectedExercise
  })
  const coachRecovery = useRecoveryMetrics({
    startDate: coachActionWindow.startDate,
    endDate: coachActionWindow.endDate,
    sessions: coachStrength.sessions
  })

  return {
    ...strength,
    ...recovery,
    user: strength.user,
    userLoading: strength.userLoading,
    setError: strength.setError,
    setSessions: strength.setSessions,
    setSessionPage: strength.setSessionPage,
    ensureSession: strength.ensureSession,
    getSessionTitle: strength.getSessionTitle,
    exerciseLibraryByName: strength.exerciseLibraryByName,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    selectedMuscle,
    setSelectedMuscle,
    selectedExercise,
    setSelectedExercise,
    coachActionScope: {
      loading: coachStrength.loading,
      timeHorizonLabel: coachActionWindow.timeHorizonLabel,
      filteredSessionCount: coachStrength.filteredSessions.length,
      sessionsPerWeek: coachStrength.sessionsPerWeek,
      readinessScore: coachRecovery.readinessAverages?.score ?? null,
      avgEffort: coachStrength.aggregateMetrics.avgEffort,
      hardSets: coachStrength.aggregateMetrics.hardSets,
      trainingLoadSummary: {
        status: coachStrength.trainingLoadSummary.status,
        loadRatio: coachStrength.trainingLoadSummary.loadRatio,
        insufficientData: coachStrength.trainingLoadSummary.insufficientData,
        isInitialPhase: coachStrength.trainingLoadSummary.isInitialPhase,
        daysSinceLast: coachStrength.trainingLoadSummary.daysSinceLast
      }
    }
  }
}
