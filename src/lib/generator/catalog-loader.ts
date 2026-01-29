import { createClient } from '@/lib/supabase/server'
import type { Exercise } from '@/types/domain'
import { mapCatalogRowToExercise } from './mappers'

// Explicit column selection for exercise catalog queries
// Note: Many columns were removed in migration 20260530000000_refactor_exercise_catalog
const EXERCISE_CATALOG_COLUMNS = `
  id, name, category, focus, movement_pattern, metric_profile,
  primary_muscle, secondary_muscles, equipment,
  e1rm_eligible, is_interval, or_group
`

export async function fetchExerciseCatalog(): Promise<Exercise[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('exercise_catalog')
    .select(EXERCISE_CATALOG_COLUMNS)
  
  if (error) {
    console.error('Error fetching exercise catalog:', error.message, error.code)
    return []
  }

  if (!data || data.length === 0) return []

  return data.map(mapCatalogRowToExercise)
}
