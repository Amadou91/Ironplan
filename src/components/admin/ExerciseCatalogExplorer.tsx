'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()

  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.primaryMuscle?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (updatedExercise: Exercise) => {
    // Convert domain Exercise back to DB fields
    const updates = {
      name: updatedExercise.name,
      focus: updatedExercise.focus,
      movement_pattern: updatedExercise.movementPattern,
      difficulty: updatedExercise.difficulty,
      goal: updatedExercise.goal,
      primary_muscle: updatedExercise.primaryMuscle,
      secondary_muscles: updatedExercise.secondaryMuscles,
      equipment: updatedExercise.equipment, // stored as jsonb
      sets: updatedExercise.sets,
      reps: updatedExercise.reps,
      rpe: updatedExercise.rpe,
      duration_minutes: updatedExercise.durationMinutes,
      rest_seconds: updatedExercise.restSeconds,
      load_target: updatedExercise.loadTarget,
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
                  <h3 className="font-bold text-lg">{ex.name}</h3>
                  <div className="text-sm text-muted flex flex-wrap gap-2 mt-1">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">{ex.primaryMuscle}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ex.focus}</span>
                    {ex.goal && <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ex.goal}</span>}
                    {ex.metricProfile && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">{ex.metricProfile}</span>}
                  </div>
                  <div className="text-xs text-subtle mt-2 flex gap-4">
                     <span>Sets: <strong>{ex.sets}</strong></span>
                     {ex.reps && <span>Reps: <strong>{ex.reps}</strong></span>}
                     {ex.durationMinutes && <span>Time: <strong>{ex.durationMinutes}m</strong></span>}
                     <span>RPE: <strong>{ex.rpe}</strong></span>
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
