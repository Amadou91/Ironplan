import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mapCatalogRowToExercise } from '@/lib/generator/mappers'
import { exerciseCatalogRowSchema, safeParseArray } from '@/lib/validation/schemas'
import type { Exercise } from '@/types/domain'

// Explicit column selection for exercise catalog queries
const EXERCISE_CATALOG_COLUMNS = `
  id, name, category, focus, movement_pattern, metric_profile,
  sets, reps, rpe, duration_minutes, rest_seconds, load_target,
  primary_muscle, secondary_muscles, instructions, video_url,
  equipment, e1rm_eligible, is_interval, interval_duration,
  interval_rest, or_group
`

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
