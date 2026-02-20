'use client'

import { useState } from 'react'
import { useStrengthMetrics } from './useStrengthMetrics'
import { useRecoveryMetrics } from './useRecoveryMetrics'
import { getNowET, formatDateForInput } from '@/lib/date-utils'

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

  const strength = useStrengthMetrics({ startDate, endDate, selectedMuscle, selectedExercise })
  const recovery = useRecoveryMetrics({ startDate, endDate, sessions: strength.sessions })

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
    setSelectedExercise
  }
}
