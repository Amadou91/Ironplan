import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mapCatalogRowToExercise } from '@/lib/generator/mappers'
import { exerciseCatalogRowSchema, safeParseArray } from '@/lib/validation/schemas'
import { DEFAULT_EXERCISES } from '@/lib/data/defaultExercises'
import type { Exercise } from '@/types/domain'

// Explicit column selection for exercise catalog queries
// Note: Many columns were removed in migration 20260530000000_refactor_exercise_catalog
const EXERCISE_CATALOG_COLUMNS = `
  id, name, category, focus, movement_pattern, metric_profile,
  primary_muscle, secondary_muscles, equipment,
  e1rm_eligible, is_interval, or_group
`

function getDefaultCatalog(): Exercise[] {
  return DEFAULT_EXERCISES
    .filter((exercise): exercise is Exercise => {
      return Boolean(exercise.name && Array.isArray(exercise.equipment) && exercise.equipment.length > 0)
    })
    .map((exercise) => ({
      category: 'Strength',
      isInterval: false,
      ...exercise,
    }))
}

export function useExerciseCatalog() {
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCatalog = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('exercise_catalog')
        .select(EXERCISE_CATALOG_COLUMNS)
      
      if (error) {
        console.error('Failed to fetch exercise catalog:', error)
        setCatalog(getDefaultCatalog())
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        setCatalog(getDefaultCatalog())
        setLoading(false)
        return
      }
      
      // Validate the response
      const validated = safeParseArray(exerciseCatalogRowSchema, data, 'exercise catalog')
      setCatalog(validated.map(mapCatalogRowToExercise))
      setLoading(false)
    }
    fetchCatalog()
  }, [])

  return { catalog, loading }
}
