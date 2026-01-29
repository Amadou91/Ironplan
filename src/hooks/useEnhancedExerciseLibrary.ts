'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog'
import { enhanceExerciseData } from '@/lib/muscle-utils'
import { fetchExerciseHistory, type ExerciseHistoryPoint } from '@/lib/session-history'
import type { Exercise } from '@/types/domain'

export type EnhancedExercise = Exercise & {
  movementPatternLabel?: string
  muscleRegion?: string
}

/**
 * Hook for managing the exercise library with enhanced data.
 * Provides memoized exercise lookup by name and exercise history.
 */
export function useEnhancedExerciseLibrary(userId?: string) {
  const supabase = createClient()
  const { catalog, loading: catalogLoading } = useExerciseCatalog()
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Enhance exercises with additional computed data
  const exerciseLibrary = useMemo<EnhancedExercise[]>(
    () => catalog.map((exercise) => enhanceExerciseData(exercise)),
    [catalog]
  )

  // Create case-insensitive name lookup map
  const exerciseLibraryByName = useMemo(
    () => new Map(exerciseLibrary.map((exercise) => [exercise.name.toLowerCase(), exercise])),
    [exerciseLibrary]
  )

  // Load exercise history for the user
  useEffect(() => {
    if (!userId) return
    
    let mounted = true
    const loadHistory = async () => {
      setHistoryLoading(true)
      try {
        const history = await fetchExerciseHistory(supabase, userId)
        if (mounted) {
          setExerciseHistory(history)
        }
      } catch (error) {
        console.error('Failed to load exercise history:', error)
      } finally {
        if (mounted) {
          setHistoryLoading(false)
        }
      }
    }
    
    loadHistory()
    return () => { mounted = false }
  }, [userId, supabase])

  // Helper to get exercise by name
  const getExerciseByName = useMemo(
    () => (name: string): EnhancedExercise | undefined => {
      return exerciseLibraryByName.get(name.toLowerCase())
    },
    [exerciseLibraryByName]
  )

  // Helper to check if exercise is dumbbell-based
  const isDumbbellExercise = useMemo(
    () => (exerciseName: string): boolean => {
      const exercise = exerciseLibraryByName.get(exerciseName.toLowerCase())
      return Boolean(exercise?.equipment?.some(option => option.kind === 'dumbbell'))
    },
    [exerciseLibraryByName]
  )

  // Get movement pattern for an exercise
  const getMovementPattern = useMemo(
    () => (exerciseName: string): string | undefined => {
      return exerciseLibraryByName.get(exerciseName.toLowerCase())?.movementPattern
    },
    [exerciseLibraryByName]
  )

  return {
    exerciseLibrary,
    exerciseLibraryByName,
    exerciseHistory,
    loading: catalogLoading || historyLoading,
    catalogLoading,
    historyLoading,
    getExerciseByName,
    isDumbbellExercise,
    getMovementPattern
  }
}
