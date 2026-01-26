import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { mapCatalogRowToExercise } from '@/lib/generator/mappers'
import type { Exercise } from '@/types/domain'

export function useExerciseCatalog() {
  const [catalog, setCatalog] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCatalog = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('exercise_catalog').select('*')
      if (data) {
        setCatalog(data.map(mapCatalogRowToExercise))
      }
      setLoading(false)
    }
    fetchCatalog()
  }, [])

  return { catalog, loading }
}
