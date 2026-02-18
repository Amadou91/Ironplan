'use client'

import { useCallback, useRef, useState } from 'react'
import { useWorkoutStore } from '@/store/useWorkoutStore'
import { useSetPersistence } from '@/hooks/useSetPersistence'
import { convertWeight, roundWeight } from '@/lib/units'
import type { WorkoutSession, WorkoutSet } from '@/types/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Handles set CRUD operations, body weight updates, exercise reordering,
 * and unit toggling with optimistic updates and rollback on failure.
 */
export function useSetOperations(
  activeSession: WorkoutSession | null,
  preferredUnit: 'lb' | 'kg',
  sessionBodyWeight: string,
  setSessionBodyWeight: (v: string) => void,
  setErrorMessage: (msg: string | null) => void,
  supabase: SupabaseClient
) {
  const {
    addSet, removeSet, updateSet, updateSession,
    replaceSessionExercise, removeSessionExercise,
    addSessionExercise, reorderExercises
  } = useWorkoutStore()

  const { persistSet, persistSessionBodyWeight, isPersisting } = useSetPersistence()
  const [isUpdating, setIsUpdating] = useState(false)
  const creationPromises = useRef<Map<string, Promise<string | undefined>>>(new Map())

  const handleSetUpdate = useCallback(async (
    exIdx: number, setIdx: number, field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]
  ) => {
    if (!activeSession) return
    const exercise = activeSession.exercises[exIdx]
    if (!exercise) return
    const currentSet = exercise.sets[setIdx]
    if (!currentSet) return
    const previousValue = currentSet[field]
    updateSet(exIdx, setIdx, field, value)
    setIsUpdating(true)
    try {
      let targetSetId = currentSet.id
      if (targetSetId.startsWith('temp-') && creationPromises.current.has(targetSetId)) {
        const realId = await creationPromises.current.get(targetSetId)
        if (realId) targetSetId = realId
      }
      const nextSet = { ...currentSet, [field]: value, id: targetSetId }
      let result
      if (targetSetId.startsWith('temp-')) {
        const promise = persistSet(exercise, nextSet).then(res => res.id)
        creationPromises.current.set(targetSetId, promise)
        const newId = await promise
        creationPromises.current.delete(targetSetId)
        if (newId) {
          updateSet(exIdx, setIdx, 'id', newId)
          result = { success: true, id: newId, performedAt: nextSet.performedAt }
        } else {
          result = { success: false, error: 'Failed to create set' }
        }
      } else {
        result = await persistSet(exercise, nextSet)
      }
      if (!result.success) {
        updateSet(exIdx, setIdx, field, previousValue)
        setErrorMessage(result.error ?? 'Failed to save changes. Please try again.')
        return
      }
      if (result.performedAt && result.performedAt !== currentSet.performedAt) {
        updateSet(exIdx, setIdx, 'performedAt', result.performedAt)
      }
    } catch (error) {
      updateSet(exIdx, setIdx, field, previousValue)
      setErrorMessage('An unexpected error occurred. Please try again.')
      console.error('handleSetUpdate error:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [activeSession, persistSet, updateSet, setErrorMessage])

  const togglePreferredUnit = useCallback(() => {
    const nextUnit = preferredUnit === 'lb' ? 'kg' : 'lb'
    updateSession({ weightUnit: nextUnit })
    if (sessionBodyWeight) {
      const val = parseFloat(sessionBodyWeight)
      if (!isNaN(val)) {
        const converted = roundWeight(convertWeight(val, preferredUnit, nextUnit))
        setSessionBodyWeight(String(converted))
      }
    }
  }, [preferredUnit, sessionBodyWeight, updateSession, setSessionBodyWeight])

  const handleBodyWeightUpdate = useCallback(async (weightValue: number | null) => {
    if (!activeSession) return
    const result = await persistSessionBodyWeight(activeSession.id, weightValue)
    if (!result.success) setErrorMessage(result.error ?? 'Failed to update body weight.')
  }, [activeSession, persistSessionBodyWeight, setErrorMessage])

  const handleReorderExercises = useCallback(async (reorderedExercises: { id: string; orderIndex: number }[]) => {
    if (!activeSession) return { success: false, error: 'No active session' }
    setIsUpdating(true)
    try {
      const updates = reorderedExercises.map(({ id, orderIndex }) =>
        supabase.from('session_exercises').update({ order_index: orderIndex })
          .eq('id', id).eq('session_id', activeSession.id)
      )
      const results = await Promise.all(updates)
      if (results.some(r => r.error)) {
        setErrorMessage('Failed to save exercise order. Please try again.')
        return { success: false, error: 'Database update failed' }
      }
      for (let i = 0; i < reorderedExercises.length; i++) {
        const targetExercise = reorderedExercises[i]
        const currentIndex = activeSession.exercises.findIndex(e => e.id === targetExercise.id)
        if (currentIndex !== i && currentIndex !== -1) reorderExercises(currentIndex, i)
      }
      return { success: true }
    } catch (error) {
      console.error('handleReorderExercises error:', error)
      setErrorMessage('An unexpected error occurred. Please try again.')
      return { success: false, error: 'Unexpected error' }
    } finally {
      setIsUpdating(false)
    }
  }, [activeSession, supabase, reorderExercises, setErrorMessage])

  return {
    handleSetUpdate,
    handleBodyWeightUpdate,
    handleReorderExercises,
    togglePreferredUnit,
    addSet,
    removeSet,
    updateSet,
    replaceSessionExercise,
    removeSessionExercise,
    addSessionExercise,
    isUpdating: isUpdating || isPersisting
  }
}
