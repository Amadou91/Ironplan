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
    addSessionExercise
  } = useWorkoutStore()

  const { persistSet, deleteSet, persistSessionBodyWeight, isPersisting } = useSetPersistence()
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
    if (result.success) {
      updateSession({ bodyWeightLb: weightValue })
      setSessionBodyWeight(weightValue != null ? String(weightValue) : '')
    } else {
      setErrorMessage(result.error ?? 'Failed to update body weight.')
    }
  }, [activeSession, persistSessionBodyWeight, updateSession, setSessionBodyWeight, setErrorMessage])

  const handleStartTimeUpdate = useCallback(async (newStartTime: string) => {
    if (!activeSession) return
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ started_at: newStartTime })
        .eq('id', activeSession.id)
      
      if (error) throw error
      updateSession({ startedAt: newStartTime })
    } catch (error) {
      console.error('Failed to update start time:', error)
      setErrorMessage('Failed to update start time. Please try again.')
    }
  }, [activeSession, supabase, updateSession, setErrorMessage])

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
      // Build the full reordered exercises array atomically (avoids stale-index loop bug)
      const idToOrder = new Map(reorderedExercises.map(({ id, orderIndex }) => [id, orderIndex]))
      const reorderedList = activeSession.exercises
        .map(ex => ({ ...ex, orderIndex: idToOrder.get(ex.id) ?? ex.orderIndex }))
        .sort((a, b) => a.orderIndex - b.orderIndex)
      updateSession({ exercises: reorderedList })
      return { success: true }
    } catch (error) {
      console.error('handleReorderExercises error:', error)
      setErrorMessage('An unexpected error occurred. Please try again.')
      return { success: false, error: 'Unexpected error' }
    } finally {
      setIsUpdating(false)
    }
  }, [activeSession, supabase, updateSession, setErrorMessage])

  const handleRemoveSet = useCallback(async (exIdx: number, setIdx: number) => {
    if (!activeSession) return
    const exercise = activeSession.exercises[exIdx]
    if (!exercise) return
    const set = exercise.sets[setIdx]
    if (!set) return
    // Delete from DB first (skip for temp/unsaved sets)
    if (set.id && !set.id.startsWith('temp-')) {
      const result = await deleteSet(set.id)
      if (!result.success) {
        setErrorMessage(result.error ?? 'Failed to delete set.')
        return
      }
    }
    removeSet(exIdx, setIdx)
  }, [activeSession, deleteSet, removeSet, setErrorMessage])

  const handleRemoveExercise = useCallback(async (exerciseIndex: number) => {
    if (!activeSession) return
    const exercise = activeSession.exercises[exerciseIndex]
    if (!exercise) return
    // Delete from DB (cascade will remove child sets)
    if (exercise.id && !exercise.id.startsWith('temp-')) {
      const { error } = await supabase
        .from('session_exercises')
        .delete()
        .eq('id', exercise.id)
      if (error) {
        setErrorMessage('Failed to remove exercise. Please try again.')
        return
      }
    }
    removeSessionExercise(exerciseIndex)
  }, [activeSession, supabase, removeSessionExercise, setErrorMessage])

  return {
    handleSetUpdate,
    handleBodyWeightUpdate,
    handleStartTimeUpdate,
    handleReorderExercises,
    handleRemoveSet,
    handleRemoveExercise,
    togglePreferredUnit,
    addSet,
    updateSet,
    replaceSessionExercise,
    addSessionExercise,
    isUpdating: isUpdating || isPersisting
  }
}
