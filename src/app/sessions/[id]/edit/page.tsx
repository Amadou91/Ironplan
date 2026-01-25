'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SetLogger } from '@/components/workout/SetLogger'
import { ReadinessSurvey } from '@/components/workout/ReadinessSurvey'
import { useSessionEditor } from '@/hooks/useSessionEditor'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { enhanceExerciseData, isTimeBasedExercise, toMuscleSlug } from '@/lib/muscle-utils'
import { buildWeightOptions } from '@/lib/equipment'
import type { WorkoutSet } from '@/types/domain'

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const toDateTimeInputValue = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function SessionEditPage() {
  const router = useRouter()
  const params = useParams()
  const {
    session,
    setSession,
    loading,
    saving,
    errorMessage,
    successMessage,
    preferredUnit,
    profileWeightLb,
    resolvedInventory,
    handleSave,
    setDeletedSetIds,
    setDeletedExerciseIds,
    hasChanges
  } = useSessionEditor(params?.id as string)

  const [newExerciseName, setNewExerciseName] = useState('')

  const exerciseLibraryByName = useMemo(() => new Map(EXERCISE_LIBRARY.map(ex => [ex.name.toLowerCase(), ex])), [])

  const getWeightOptions = (exerciseName: string) => {
    const match = exerciseLibraryByName.get(exerciseName.toLowerCase())
    if (!match?.equipment?.length) return []
    return buildWeightOptions(resolvedInventory, match.equipment, profileWeightLb, preferredUnit)
  }

  const handleAddExercise = () => {
    if (!newExerciseName.trim() || !session) return
    const match = exerciseLibraryByName.get(newExerciseName.toLowerCase())
    const base = match ?? enhanceExerciseData({ name: newExerciseName, focus: 'full_body' } as any)
    setSession({
      ...session,
      exercises: [...session.exercises, {
        id: `temp-exercise-${Date.now()}`,
        name: base.name,
        primaryMuscle: toMuscleSlug(base.primaryMuscle ?? 'full_body'),
        secondaryMuscles: base.secondaryMuscles?.map(m => toMuscleSlug(m)) ?? [],
        orderIndex: session.exercises.length,
        sets: []
      }]
    })
    setNewExerciseName('')
  }

  if (loading) return <div className="p-10 text-center text-muted">Loading session...</div>
  if (!session) return <div className="p-10 text-center text-muted"><p>Session not found.</p><Button onClick={() => router.push('/progress')}>Return</Button></div>

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-strong">Edit Session</h1>
            <p className="text-sm text-muted">{formatDateTime(session.startedAt)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push('/progress')}>Close</Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges}>{saving ? 'Saving...' : 'Save changes'}</Button>
          </div>
        </div>

        {(errorMessage || successMessage) && (
          <div className={`rounded-lg border p-4 text-sm ${errorMessage ? 'alert-error' : 'alert-success'}`}>{errorMessage ?? successMessage}</div>
        )}

        <Card className="p-6">
          <label className="text-xs text-subtle">Session name</label>
          <input type="text" value={session.name} onChange={e => setSession({...session, name: e.target.value})} className="input-base mt-2" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-subtle">Started at</label>
              <input type="datetime-local" value={toDateTimeInputValue(session.startedAt)} onChange={e => setSession({...session, startedAt: new Date(e.target.value).toISOString()})} className="input-base mt-2" />
            </div>
            <div>
              <label className="text-xs text-subtle">Body weight (lb)</label>
              <input type="text" value={session.bodyWeightLb ?? ''} onChange={e => setSession({...session, bodyWeightLb: parseFloat(e.target.value) || null})} className="input-base" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-strong mb-4">Readiness Survey</h2>
          <ReadinessSurvey data={session.readiness ?? null} onChange={r => setSession({...session, readiness: r})} />
        </Card>

        <div className="space-y-6">
          {session.exercises.map(exercise => (
            <Card key={exercise.id} className="p-6 space-y-4">
              <div className="flex justify-between">
                <h2 className="text-lg font-semibold text-strong">{exercise.name}</h2>
                <button onClick={() => {
                  setSession({...session, exercises: session.exercises.filter(e => e.id !== exercise.id)})
                  if (!exercise.id.startsWith('temp-')) setDeletedExerciseIds(prev => [...prev, exercise.id])
                }} className="text-xs text-[var(--color-danger)]">Delete</button>
              </div>
              <div className="space-y-3">
                {exercise.sets.map(set => (
                  <SetLogger
                    key={set.id}
                    set={set}
                    weightOptions={getWeightOptions(exercise.name)}
                    onUpdate={(f, v) => setSession({...session, exercises: session.exercises.map(e => e.id === exercise.id ? {...e, sets: e.sets.map(s => s.id === set.id ? {...s, [f]: v} : s)} : e)})}
                    onDelete={() => {
                      setSession({...session, exercises: session.exercises.map(e => e.id === exercise.id ? {...e, sets: e.sets.filter(s => s.id !== set.id)} : e)})
                      if (!set.id.startsWith('temp-')) setDeletedSetIds(prev => [...prev, set.id])
                    }}
                    onToggleComplete={() => setSession({...session, exercises: session.exercises.map(e => e.id === exercise.id ? {...e, sets: e.sets.map(s => s.id === set.id ? {...s, completed: !s.completed} : s)} : e)})}
                    metricProfile={exercise.metricProfile as any}
                    isTimeBased={isTimeBasedExercise(exercise.name, exerciseLibraryByName.get(exercise.name.toLowerCase())?.reps)}
                  />
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setSession({...session, exercises: session.exercises.map(e => e.id === exercise.id ? {...e, sets: [...e.sets, { id: `temp-${Date.now()}`, setNumber: e.sets.length + 1, reps: '', weight: '', completed: false, weightUnit: preferredUnit } as WorkoutSet]} : e)})}>Add set</Button>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <label className="text-xs text-subtle">Add exercise</label>
          <div className="mt-3 flex gap-3">
            <input type="text" value={newExerciseName} onChange={e => setNewExerciseName(e.target.value)} placeholder="Exercise name" className="input-base" />
            <Button variant="outline" onClick={handleAddExercise}>Add</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
