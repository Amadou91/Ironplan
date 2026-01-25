'use client'

import { useState } from 'react'
import { useStrengthMetrics } from './useStrengthMetrics'
import { useRecoveryMetrics } from './useRecoveryMetrics'

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