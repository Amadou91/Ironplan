'use client'

import { useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ExerciseForm } from '@/components/admin/exercise-form/ExerciseForm'
import type { Exercise } from '@/types/domain'

type Props = {
  initialExercises: Exercise[]
  muscleOptions: { slug: string; label: string }[]
}

export function ExerciseCatalogExplorer({ initialExercises, muscleOptions }: Props) {
  const [exercises, setExercises] = useState(initialExercises)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const supabase = useSupabase()

  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.primaryMuscle?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (updatedExercise: Exercise) => {
    // Convert domain Exercise back to DB fields
    const updates = {
      name: updatedExercise.name,
      movement_pattern: updatedExercise.movementPattern,
      primary_muscle: updatedExercise.primaryMuscle,
      secondary_muscles: updatedExercise.secondaryMuscles,
      equipment: updatedExercise.equipment, // stored as jsonb
      metric_profile: updatedExercise.metricProfile,
      e1rm_eligible: updatedExercise.e1rmEligible
    }

    const { error } = await supabase
      .from('exercise_catalog')
      .update(updates)
      .eq('id', updatedExercise.id)

    if (error) {
      throw new Error(error.message)
    }

    setExercises(prev => prev.map(e => e.id === updatedExercise.id ? updatedExercise : e))
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input 
          placeholder="Search exercises..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="max-w-md"
        />
      </div>

      <div className="grid gap-4">
        {filtered.map(ex => (
          <Card key={ex.id} className="p-6">
            {editingId === ex.id ? (
              <ExerciseForm 
                initialData={ex} 
                muscleOptions={muscleOptions}
                onSubmit={handleSave}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg">{ex.name}</h3>
                    {ex.movementPattern && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                        {ex.movementPattern}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted flex flex-wrap gap-2 mt-1">
                    <span className="bg-[var(--color-surface-muted)] px-2 py-0.5 rounded text-[var(--color-text)] font-medium">{ex.primaryMuscle}</span>
                    {ex.primaryMuscle !== 'full_body' && ex.secondaryMuscles && ex.secondaryMuscles.length > 0 && (
                      <span className="bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-0.5 rounded text-[var(--color-text-muted)] text-[11px]">
                        +{ex.secondaryMuscles.join(', ')}
                      </span>
                    )}
                    <span className="bg-[var(--color-surface-muted)] px-2 py-0.5 rounded text-[var(--color-text)]">{ex.focus}</span>
                    {ex.metricProfile && <span className="bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] px-2 py-0.5 rounded border border-[var(--color-primary-border)]">{ex.metricProfile}</span>}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditingId(ex.id!)}>Edit</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
