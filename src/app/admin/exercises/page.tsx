import { fetchExerciseCatalog } from '@/lib/generator/catalog-loader'
import { ExerciseCatalogExplorer } from '@/components/admin/ExerciseCatalogExplorer'

export default async function AdminExercisesPage() {
  const exercises = await fetchExerciseCatalog()
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Exercise Catalog</h1>
      <ExerciseCatalogExplorer initialExercises={exercises} />
    </div>
  )
}
