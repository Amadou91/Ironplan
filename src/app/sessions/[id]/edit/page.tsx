'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel } from '@/lib/muscle-utils'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { buildWeightOptions } from '@/lib/equipment'
import { INTENSITY_RECOMMENDATION, RIR_HELPER_TEXT, RIR_OPTIONS, RPE_HELPER_TEXT, RPE_OPTIONS } from '@/constants/intensityOptions'
import type { EquipmentInventory } from '@/types/domain'

type EditableSet = {
  id: string
  setNumber: number
  reps: number | ''
  weight: number | ''
  rpe: number | ''
  rir: number | ''
  completed: boolean
  performedAt?: string | null
  weightUnit: string
}

type EditableExercise = {
  id: string
  name: string
  primaryMuscle: string | null
  secondaryMuscles: string[] | null
  orderIndex: number | null
  variation: Record<string, string>
  sets: EditableSet[]
}

type EditableSession = {
  id: string
  name: string
  startedAt: string
  endedAt: string | null
  templateId?: string | null
  userId?: string | null
  timezone?: string | null
  exercises: EditableExercise[]
}

type SessionPayload = {
  id: string
  user_id?: string | null
  template_id?: string | null
  name: string
  started_at: string
  ended_at: string | null
  timezone?: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    order_index: number | null
    variation: Record<string, string> | null
    sets: Array<{
      id: string
      set_number: number | null
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      completed: boolean | null
      performed_at: string | null
      weight_unit: string | null
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
  const [equipmentInventory, setEquipmentInventory] = useState<EquipmentInventory | null>(null)
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)

  const exerciseLibraryByName = useMemo(
    () => new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.name.toLowerCase(), exercise])),
    []
  )

  const mapSession = useCallback((payload: SessionPayload): EditableSession => {
    return {
      id: payload.id,
      name: payload.name,
      startedAt: payload.started_at,
      endedAt: payload.ended_at,
      templateId: payload.template_id ?? null,
      userId: payload.user_id ?? null,
      timezone: payload.timezone ?? null,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, index) => ({
          id: exercise.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles,
          orderIndex: exercise.order_index ?? index,
          variation: exercise.variation ?? {},
          sets: (exercise.sets ?? [])
            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set, idx) => ({
              id: set.id,
              setNumber: set.set_number ?? idx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              completed: set.completed ?? false,
              performedAt: set.performed_at,
              weightUnit: set.weight_unit ?? 'lb'
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
        'id, user_id, template_id, name, started_at, ended_at, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, variation, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit))'
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

  useEffect(() => {
    if (!session?.templateId) {
      setEquipmentInventory(null)
      return
    }
    const loadInventory = async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('template_inputs')
        .eq('id', session.templateId)
        .maybeSingle()
      if (error) {
        console.error('Failed to load template inventory', error)
        return
      }
      const inventory = (data?.template_inputs as { equipment?: { inventory?: EquipmentInventory } } | null)?.equipment?.inventory ?? null
      setEquipmentInventory(inventory)
    }
    loadInventory()
  }, [session?.templateId, supabase])

  useEffect(() => {
    if (!session?.userId) {
      setProfileWeightLb(null)
      return
    }
    const loadProfileWeight = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('weight_lb')
        .eq('id', session.userId)
        .maybeSingle()
      if (error) {
        console.error('Failed to load profile weight', error)
        return
      }
      setProfileWeightLb(typeof data?.weight_lb === 'number' ? data.weight_lb : null)
    }
    loadProfileWeight()
  }, [session?.userId, supabase])

  const hasChanges = useMemo(() => {
    if (!session || !initialSnapshot) return false
    return JSON.stringify(session) !== initialSnapshot || deletedSetIds.length > 0
  }, [session, initialSnapshot, deletedSetIds])

  const updateSessionName = (value: string) => {
    setSession((prev) => (prev ? { ...prev, name: value } : prev))
  }

  const updateExerciseVariation = (exerciseId: string, field: keyof EditableExercise['variation'], value: string) => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise
          return {
            ...exercise,
            variation: {
              ...exercise.variation,
              [field]: value
            }
          }
        })
      }
    })
  }

  const updateSetField = (
    exerciseId: string,
    setId: string,
    field: keyof EditableSet,
    value: number | string | boolean | Record<string, string>
  ) => {
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

  const getWeightOptions = useCallback(
    (exerciseName: string) => {
      if (!equipmentInventory) return []
      const match = exerciseLibraryByName.get(exerciseName.toLowerCase())
      if (!match?.equipment?.length) return []
      return buildWeightOptions(equipmentInventory, match.equipment, profileWeightLb)
    },
    [equipmentInventory, exerciseLibraryByName, profileWeightLb]
  )

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
                completed: false,
                performedAt: new Date().toISOString(),
                weightUnit: 'lb',
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
        if (typeof set.rpe === 'number' && typeof set.rir === 'number') {
          return 'Only one effort input is allowed per set.'
        }
        if (typeof set.rpe === 'number' && set.rpe > 10) return 'RPE must be 10 or less.'
        if (typeof set.rir === 'number' && set.rir > 10) return 'RIR must be 10 or less.'
      }
    }
    return null
  }

  const handleCancel = () => {
    if (hasChanges && !confirm('Discard your changes?')) return
    router.push('/progress')
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
        const { error: exerciseError } = await supabase
          .from('session_exercises')
          .update({ variation: exercise.variation ?? {} })
          .eq('id', exercise.id)
        if (exerciseError) throw exerciseError

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
            completed: set.completed,
            performed_at: set.performedAt ?? new Date().toISOString(),
            weight_unit: set.weightUnit ?? 'lb'
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
    return <div className="page-shell p-10 text-center text-muted">Loading session details...</div>
  }

  if (!session) {
    return (
      <div className="page-shell p-10 text-center text-muted">
        <p className="mb-4">Session not found.</p>
        <Button onClick={() => router.push('/progress')}>Return to Progress</Button>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-8 px-4 py-10 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-2 text-2xl font-semibold text-strong">Edit Session</h1>
            <p className="text-sm text-muted">{formatDateTime(session.startedAt)} · Adjust logged sets, reps, and effort.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={handleCancel} className="h-9 px-3">
              Close
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
                ? 'alert-error'
                : 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
            }`}
          >
            {errorMessage ?? successMessage}
          </div>
        )}

        <Card className="p-6">
          <label className="text-xs text-subtle">Session name</label>
          <input
            type="text"
            value={session.name}
            onChange={(event) => updateSessionName(event.target.value)}
            className="input-base mt-2"
          />
          {session.timezone && (
            <p className="mt-2 text-[10px] text-subtle">Timezone: {session.timezone}</p>
          )}
        </Card>

        <div className="space-y-6">
          {session.exercises.map((exercise) => (
            <Card key={exercise.id} className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold text-strong">{exercise.name}</h2>
                <p className="text-xs text-subtle">
                  Primary: {exercise.primaryMuscle ? toMuscleLabel(exercise.primaryMuscle) : 'N/A'}
                  {exercise.secondaryMuscles?.length
                    ? ` · Secondary: ${exercise.secondaryMuscles.map((muscle) => toMuscleLabel(muscle)).join(', ')}`
                    : ''}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-subtle">Grip</label>
                  <input
                    type="text"
                    value={exercise.variation.grip ?? ''}
                    onChange={(event) => updateExerciseVariation(exercise.id, 'grip', event.target.value)}
                    className="input-base mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-subtle">Stance</label>
                  <input
                    type="text"
                    value={exercise.variation.stance ?? ''}
                    onChange={(event) => updateExerciseVariation(exercise.id, 'stance', event.target.value)}
                    className="input-base mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-subtle">Equipment</label>
                  <input
                    type="text"
                    value={exercise.variation.equipment ?? ''}
                    onChange={(event) => updateExerciseVariation(exercise.id, 'equipment', event.target.value)}
                    className="input-base mt-1"
                  />
                </div>
              </div>

            <div className="space-y-3">
              {exercise.sets.length === 0 ? (
                <p className="text-sm text-subtle">No sets logged yet.</p>
              ) : (
                exercise.sets.map((set) => {
                  const weightChoices = (() => {
                    const options = getWeightOptions(exercise.name)
                    if (typeof set.weight === 'number' && Number.isFinite(set.weight)) {
                      const exists = options.some((option) => option.value === set.weight)
                      if (!exists) {
                        return [...options, { value: set.weight, label: `${set.weight} lb (logged)` }]
                      }
                    }
                    return options
                  })()
                  const isRpeSelected = typeof set.rpe === 'number'
                  const isRirSelected = typeof set.rir === 'number'

                  return (
                    <div key={set.id} className="surface-card-muted space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-subtle">Set {set.setNumber}</p>
                        <button
                          type="button"
                          onClick={() => handleDeleteSet(exercise.id, set.id)}
                          className="text-xs text-[var(--color-danger)] transition-colors hover:text-[var(--color-danger)]"
                        >
                          Delete set
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-subtle">Weight</label>
                          {weightChoices.length > 0 ? (
                            <select
                              value={typeof set.weight === 'number' ? String(set.weight) : ''}
                              onChange={(event) => {
                                const nextValue = event.target.value === '' ? '' : Number(event.target.value)
                                updateSetField(exercise.id, set.id, 'weight', nextValue)
                                if (event.target.value !== '') {
                                  updateSetField(exercise.id, set.id, 'weightUnit', 'lb')
                                }
                              }}
                              className="input-base mt-1"
                            >
                              <option value="">Select weight</option>
                              {weightChoices.map((option) => (
                                <option key={`${option.label}-${option.value}`} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              value={set.weight}
                              onChange={(event) => updateSetField(exercise.id, set.id, 'weight', event.target.value === '' ? '' : Number(event.target.value))}
                              className="input-base mt-1"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-subtle">Reps</label>
                          <input
                            type="number"
                            min={0}
                            value={set.reps}
                            onChange={(event) => updateSetField(exercise.id, set.id, 'reps', event.target.value === '' ? '' : Number(event.target.value))}
                            className="input-base mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-subtle">RPE</label>
                          <select
                            value={typeof set.rpe === 'number' ? String(set.rpe) : ''}
                            onChange={(event) => {
                              const nextValue = event.target.value === '' ? '' : Number(event.target.value)
                              updateSetField(exercise.id, set.id, 'rpe', nextValue)
                              if (event.target.value !== '') {
                                updateSetField(exercise.id, set.id, 'rir', '')
                              }
                            }}
                            className="input-base mt-1"
                            disabled={isRirSelected}
                          >
                            <option value="">Select effort</option>
                            {RPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label} - {option.description}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-subtle">{RPE_HELPER_TEXT}</p>
                          {typeof set.rpe === 'number' ? (
                            <p className="text-[10px] text-accent">
                              {RPE_OPTIONS.find((option) => option.value === set.rpe)?.equivalence}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-subtle">RIR</label>
                          <select
                            value={typeof set.rir === 'number' ? String(set.rir) : ''}
                            onChange={(event) => {
                              const nextValue = event.target.value === '' ? '' : Number(event.target.value)
                              updateSetField(exercise.id, set.id, 'rir', nextValue)
                              if (event.target.value !== '') {
                                updateSetField(exercise.id, set.id, 'rpe', '')
                              }
                            }}
                            className="input-base mt-1"
                            disabled={isRpeSelected}
                          >
                            <option value="">Select reps left</option>
                            {RIR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[10px] text-subtle">{RIR_HELPER_TEXT}</p>
                          {typeof set.rir === 'number' ? (
                            <p className="text-[10px] text-accent">
                              {RIR_OPTIONS.find((option) => option.value === set.rir)?.equivalence}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 pt-6 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={set.completed}
                            onChange={(event) => updateSetField(exercise.id, set.id, 'completed', event.target.checked)}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]"
                          />
                          <span>Mark as completed</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-subtle">{INTENSITY_RECOMMENDATION}</p>
                    </div>
                  )
                })
              )}
            </div>

            <Button variant="outline" className="w-full h-10" onClick={() => handleAddSet(exercise.id)}>
              Add set
            </Button>
          </Card>
        ))}
      </div>
    </div>
    </div>
  )
}
