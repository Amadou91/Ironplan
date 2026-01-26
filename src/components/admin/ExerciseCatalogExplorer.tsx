'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import type { Exercise, FocusArea, MovementPattern, Difficulty, Goal, MetricProfile } from '@/types/domain'

type Props = {
  initialExercises: Exercise[]
}

export function ExerciseCatalogExplorer({ initialExercises }: Props) {
  const [exercises, setExercises] = useState(initialExercises)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Exercise>>({})
  const supabase = createClient()

  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.primaryMuscle?.toLowerCase().includes(search.toLowerCase())
  )

  const handleEdit = (ex: Exercise) => {
    setEditingId(ex.id!)
    setEditForm(ex)
  }

  const handleSave = async () => {
    if (!editingId) return

    // Convert domain Exercise back to DB fields
    const updates = {
      name: editForm.name,
      focus: editForm.focus,
      movement_pattern: editForm.movementPattern,
      difficulty: editForm.difficulty,
      goal: editForm.goal,
      primary_muscle: editForm.primaryMuscle,
      equipment: editForm.equipment, // stored as jsonb
      sets: editForm.sets,
      reps: editForm.reps,
      rpe: editForm.rpe,
      duration_minutes: editForm.durationMinutes,
      rest_seconds: editForm.restSeconds,
      load_target: editForm.loadTarget,
      metric_profile: editForm.metricProfile,
      e1rm_eligible: editForm.e1rmEligible
    }

    const { error } = await supabase
      .from('exercise_catalog')
      .update(updates)
      .eq('id', editingId)

    if (error) {
      alert('Failed to save: ' + error.message)
      return
    }

    setExercises(prev => prev.map(e => e.id === editingId ? { ...e, ...editForm } as Exercise : e))
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
          <Card key={ex.id} className="p-4">
            {editingId === ex.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  </div>
                  <div>
                    <Label>Primary Muscle</Label>
                    <Input value={editForm.primaryMuscle as string} onChange={e => setEditForm({...editForm, primaryMuscle: e.target.value})} />
                  </div>
                  <div>
                    <Label>Focus</Label>
                    <Select value={editForm.focus} onChange={e => setEditForm({...editForm, focus: e.target.value as FocusArea})}>
                      <option value="upper">Upper</option>
                      <option value="lower">Lower</option>
                      <option value="core">Core</option>
                      <option value="cardio">Cardio</option>
                      <option value="mobility">Mobility</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Goal</Label>
                    <Select value={editForm.goal} onChange={e => setEditForm({...editForm, goal: e.target.value as Goal})}>
                      <option value="strength">Strength</option>
                      <option value="hypertrophy">Hypertrophy</option>
                      <option value="endurance">Endurance</option>
                      <option value="cardio">Cardio</option>
                      <option value="general_fitness">General Fitness</option>
                    </Select>
                  </div>
                  <div>
                     <Label>Metric Profile</Label>
                     <Select value={editForm.metricProfile ?? ''} onChange={e => setEditForm({...editForm, metricProfile: (e.target.value || undefined) as MetricProfile})}>
                       <option value="">None</option>
                       <option value="strength">Strength</option>
                       <option value="timed_strength">Timed Strength</option>
                       <option value="cardio_session">Cardio Session</option>
                       <option value="yoga_session">Yoga Session</option>
                       <option value="mobility_session">Mobility Session</option>
                     </Select>
                  </div>
                   <div className="flex items-center gap-2 mt-6">
                    <Checkbox 
                      checked={editForm.e1rmEligible ?? false} 
                      onCheckedChange={(c) => setEditForm({...editForm, e1rmEligible: c === true})} 
                    />
                    <Label>E1RM Eligible</Label>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                   <div>
                    <Label>Sets</Label>
                    <Input type="number" value={editForm.sets} onChange={e => setEditForm({...editForm, sets: Number(e.target.value)})} />
                   </div>
                   <div>
                    <Label>Reps</Label>
                    <Input value={editForm.reps} onChange={e => setEditForm({...editForm, reps: e.target.value})} />
                   </div>
                   <div>
                    <Label>RPE</Label>
                    <Input type="number" value={editForm.rpe} onChange={e => setEditForm({...editForm, rpe: Number(e.target.value)})} />
                   </div>
                   <div>
                    <Label>Rest (sec)</Label>
                    <Input type="number" value={editForm.restSeconds} onChange={e => setEditForm({...editForm, restSeconds: Number(e.target.value)})} />
                   </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button onClick={handleSave}>Save Changes</Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{ex.name}</h3>
                  <div className="text-sm text-muted flex gap-2">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ex.primaryMuscle}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ex.focus}</span>
                    {ex.goal && <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ex.goal}</span>}
                  </div>
                  <div className="text-xs text-subtle mt-1">
                     Default: {ex.sets} x {ex.reps} @ RPE {ex.rpe}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => handleEdit(ex)}>Edit</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
