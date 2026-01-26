import { createClient } from '@/lib/supabase/server'
import type { Exercise } from '@/types/domain'
import { mapCatalogRowToExercise } from './mappers'

export async function fetchExerciseCatalog(): Promise<Exercise[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('exercise_catalog')
    .select('*')
  
  if (error) {
    console.error('Error fetching exercise catalog:', error)
    return []
  }

  if (!data) return []

  return data.map(mapCatalogRowToExercise)
}
