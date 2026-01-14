'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel } from '@/lib/muscle-utils'

type EditableSet = {
  id: string
  setNumber: number
  reps: number | ''
  weight: number | ''
  rpe: number | ''
  rir: number | ''
  notes: string
  completed: boolean
  performedAt?: string | null
}

type EditableExercise = {
  id: string
  name: string
  primaryMuscle: string | null
  secondaryMuscles: string[] | null
  orderIndex: number | null
  sets: EditableSet[]
}

type EditableSession = {
  id: string
  name: string
  startedAt: string
  endedAt: string | null
  exercises: EditableExercise[]
}

type SessionPayload = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    order_index: number | null
    sets: Array<{
      id: string
      set_number: number | null
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      notes: string | null
      completed: boolean | null
      performed_at: string | null
    }>
  }>
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

const normalizeNumber = (value: number | '') => (typeof value === 'number' && Number.isFinite(value) ? value : null)

export default function SessionEditPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [session, setSession] = useState<EditableSession | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const mapSession = useCallback((payload: SessionPayload): EditableSession => {
    return {
      id: payload.id,
      name: payload.name,
      startedAt: payload.started_at,
      endedAt: payload.ended_at,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, index) => ({
          id: exercise.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles,
          orderIndex: exercise.order_index ?? index,
          sets: (exercise.sets ?? [])
            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set, idx) => ({
              id: set.id,
              setNumber: set.set_number ?? idx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              notes: set.notes ?? '',
              completed: set.completed ?? false,
              performedAt: set.performed_at
            }))
        }))
    }
  }, [])

  const fetchSession = useCallback(async () => {
    if (!params?.id) return
    setLoading(true)
    setErrorMessage(null)
    const { data, error } = await supabase
      .from('sessions')
      .select(
        'id, name, started_at, ended_at, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, notes, completed, performed_at))'
      )
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Failed to load session', error)
      setErrorMessage('Unable to load session details. Please try again.')
    } else if (data) {
      const mapped = mapSession(data as SessionPayload)
      setSession(mapped)
      setInitialSnapshot(JSON.stringify(mapped))
      setDeletedSetIds([])
    }
    setLoading(false)
  }, [mapSession, params, supabase])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const hasChanges = useMemo(() => {
    if (!session || !initialSnapshot) return false
    return JSON.stringify(session) !== initialSnapshot || deletedSetIds.length > 0
  }, [session, initialSnapshot, deletedSetIds])

  const updateSessionName = (value: string) => {
    setSession((prev) => (prev ? { ...prev, name: value } : prev))
  }

  const updateSetField = (exerciseId: string, setId: string, field: keyof EditableSet, value: number | string | boolean) => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise
          return {
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setId
                ? {
                    ...set,
                    [field]: value
                  }
                : set
            )
          }
        })
      }
    })
  }

  const handleAddSet = (exerciseId: string) => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise
          const nextNumber = exercise.sets.length + 1
          return {
            ...exercise,
            sets: [
              ...exercise.sets,
              {
                id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                setNumber: nextNumber,
                reps: '',
                weight: '',
                rpe: '',
                rir: '',
                notes: '',
                completed: false,
                performedAt: new Date().toISOString()
              }
            ]
          }
        })
      }
    })
  }

  const handleDeleteSet = (exerciseId: string, setId: string) => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise
          return {
            ...exercise,
            sets: exercise.sets.filter((set) => set.id !== setId)
          }
        })
      }
    })
    if (!setId.startsWith('temp-')) {
      setDeletedSetIds((prev) => [...prev, setId])
    }
  }

  const validateSession = () => {
    if (!session) return 'No session to update.'
    if (!session.name.trim()) return 'Session name is required.'
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        const values = [set.weight, set.reps, set.rpe, set.rir]
        for (const value of values) {
          if (typeof value === 'number' && value < 0) {
            return 'Values cannot be negative.'
          }
        }
        if (typeof set.rpe === 'number' && set.rpe > 10) return 'RPE must be 10 or less.'
        if (typeof set.rir === 'number' && set.rir > 10) return 'RIR must be 10 or less.'
      }
    }
    return null
  }

  const handleCancel = () => {
    if (hasChanges && !confirm('Discard your changes?')) return
    router.push('/dashboard')
  }

  const handleSave = async () => {
    if (!session) return
    const validationError = validateSession()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error: sessionError } = await supabase
        .from('sessions')
        .update({ name: session.name })
        .eq('id', session.id)

      if (sessionError) throw sessionError

      if (deletedSetIds.length > 0) {
        const { error: deleteError } = await supabase.from('sets').delete().in('id', deletedSetIds)
        if (deleteError) throw deleteError
      }

      for (const exercise of session.exercises) {
        const normalizedSets = exercise.sets.map((set, idx) => ({
          ...set,
          setNumber: idx + 1
        }))

        for (const set of normalizedSets) {
          const payload = {
            session_exercise_id: exercise.id,
            set_number: set.setNumber,
            reps: normalizeNumber(set.reps),
            weight: normalizeNumber(set.weight),
            rpe: normalizeNumber(set.rpe),
            rir: normalizeNumber(set.rir),
            notes: set.notes ? set.notes.trim() : null,
            completed: set.completed,
            performed_at: set.performedAt ?? new Date().toISOString()
          }

          if (set.id.startsWith('temp-')) {
            const { error: insertError } = await supabase.from('sets').insert(payload)
            if (insertError) throw insertError
          } else {
            const { error: updateError } = await supabase.from('sets').update(payload).eq('id', set.id)
            if (updateError) throw updateError
          }
        }
      }

      setSuccessMessage('Changes saved successfully.')
      await fetchSession()
    } catch (error) {
      console.error('Failed to save session edits', error)
      setErrorMessage('Unable to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading session details...</div>
  }

  if (!session) {
    return (
      <div className="p-10 text-center text-slate-400">
        <p className="mb-4">Session not found.</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            onClick={handleCancel}
            className="text-xs text-slate-400 hover:text-white"
            type="button"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-semibold text-white mt-2">Edit Session</h1>
          <p className="text-sm text-slate-400">{formatDateTime(session.startedAt)} · Adjust logged sets, reps, and notes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={handleCancel} className="h-9 px-3">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges} className="h-9 px-4">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      {(errorMessage || successMessage) && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            errorMessage
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {errorMessage ?? successMessage}
        </div>
      )}

      <Card className="card-surface p-6">
        <label className="text-xs text-slate-400">Session name</label>
        <input
          type="text"
          value={session.name}
          onChange={(event) => updateSessionName(event.target.value)}
          className="input-base mt-2"
        />
      </Card>

      <div className="space-y-6">
        {session.exercises.map((exercise) => (
          <Card key={exercise.id} className="card-surface p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{exercise.name}</h2>
              <p className="text-xs text-slate-400">
                Primary: {exercise.primaryMuscle ? toMuscleLabel(exercise.primaryMuscle) : '—'}
                {exercise.secondaryMuscles?.length
                  ? ` · Secondary: ${exercise.secondaryMuscles.map((muscle) => toMuscleLabel(muscle)).join(', ')}`
                  : ''}
              </p>
            </div>

            <div className="space-y-3">
              {exercise.sets.length === 0 ? (
                <p className="text-sm text-slate-500">No sets logged yet.</p>
              ) : (
                exercise.sets.map((set) => (
                  <div key={set.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">Set {set.setNumber}</p>
                      <button
                        type="button"
                        onClick={() => handleDeleteSet(exercise.id, set.id)}
                        className="text-xs text-rose-300 hover:text-rose-200"
                      >
                        Delete set
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">Weight (lb)</label>
                        <input
                          type="number"
                          min={0}
                          value={set.weight}
                          onChange={(event) => updateSetField(exercise.id, set.id, 'weight', event.target.value === '' ? '' : Number(event.target.value))}
                          className="input-base mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">Reps</label>
                        <input
                          type="number"
                          min={0}
                          value={set.reps}
                          onChange={(event) => updateSetField(exercise.id, set.id, 'reps', event.target.value === '' ? '' : Number(event.target.value))}
                          className="input-base mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">RPE</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={set.rpe}
                          onChange={(event) => updateSetField(exercise.id, set.id, 'rpe', event.target.value === '' ? '' : Number(event.target.value))}
                          className="input-base mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">RIR</label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={set.rir}
                          onChange={(event) => updateSetField(exercise.id, set.id, 'rir', event.target.value === '' ? '' : Number(event.target.value))}
                          className="input-base mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider">Notes</label>
                      <input
                        type="text"
                        value={set.notes}
                        onChange={(event) => updateSetField(exercise.id, set.id, 'notes', event.target.value)}
                        className="input-base mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={set.completed}
                        onChange={(event) => updateSetField(exercise.id, set.id, 'completed', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                      />
                      <span>Mark as completed</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button variant="outline" className="w-full h-10" onClick={() => handleAddSet(exercise.id)}>
              Add set
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
