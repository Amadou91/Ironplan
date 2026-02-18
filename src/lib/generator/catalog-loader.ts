import { createClient } from '@/lib/supabase/server'
import type { Exercise } from '@/types/domain'
import { mapCatalogRowToExercise } from './mappers'
import { DEFAULT_EXERCISES } from '@/lib/data/defaultExercises'

// Explicit column selection for exercise catalog queries
// Note: Many columns were removed in migration 20260530000000_refactor_exercise_catalog
const EXERCISE_CATALOG_COLUMNS = `
  id, name, category, focus, movement_pattern, metric_profile,
  primary_muscle, secondary_muscles, equipment,
  e1rm_eligible, is_interval, or_group
`

function getDefaultExerciseCatalog(): Exercise[] {
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

export async function fetchExerciseCatalog(): Promise<Exercise[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('exercise_catalog')
      .select(EXERCISE_CATALOG_COLUMNS)

    if (error) {
      const fallbackCatalog = getDefaultExerciseCatalog()
      console.warn(
        `Error fetching exercise catalog; using fallback (${fallbackCatalog.length} defaults):`,
        error.message,
        error.code
      )
      return fallbackCatalog
    }

    if (!data || data.length === 0) {
      return getDefaultExerciseCatalog()
    }

    return data.map(mapCatalogRowToExercise)
  } catch (error) {
    const fallbackCatalog = getDefaultExerciseCatalog()
    console.warn(
      `Exception fetching exercise catalog; using fallback (${fallbackCatalog.length} defaults):`,
      error
    )
    return fallbackCatalog
  }
}
