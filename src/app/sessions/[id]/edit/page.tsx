'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SetLogger } from '@/components/workout/SetLogger'
import { enhanceExerciseData, isTimeBasedExercise, toMuscleLabel, toMuscleSlug } from '@/lib/muscle-utils'
import { EXERCISE_LIBRARY } from '@/lib/generator'
import { normalizePreferences } from '@/lib/preferences'
import { buildWeightOptions, equipmentPresets } from '@/lib/equipment'
import type { WeightUnit, WorkoutSet, EquipmentInventory, FocusArea, Goal } from '@/types/domain'

type EditableExercise = {
  id: string
  name: string
  primaryMuscle: string | null
  secondaryMuscles: string[] | null
  metricProfile?: string | null
  orderIndex: number | null
  sets: WorkoutSet[]
}

type ReadinessData = {
  sleep_quality: number
  muscle_soreness: number
  stress_level: number
  motivation: number
}

type EditableSession = {
  id: string
  name: string
  startedAt: string
  endedAt: string | null
  templateId?: string | null
  userId?: string | null
  timezone?: string | null
  bodyWeightLb?: number | null
  readiness?: ReadinessData | null
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
  body_weight_lb?: number | null
  session_readiness: Array<{
    sleep_quality: number
    muscle_soreness: number
    stress_level: number
    motivation: number
  }>
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    metric_profile?: string | null
    order_index: number | null
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

const padTimeUnit = (value: number) => String(value).padStart(2, '0')

const toDateTimeInputValue = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${padTimeUnit(date.getMonth() + 1)}-${padTimeUnit(date.getDate())}T${padTimeUnit(
    date.getHours()
  )}:${padTimeUnit(date.getMinutes())}`
}

const toIsoString = (value: string) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const normalizeNumber = (value: number | '' | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

export default function SessionEditPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [session, setSession] = useState<EditableSession | null>(null)
  const [template, setTemplate] = useState<{ focus: FocusArea; style: Goal } | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [deletedSetIds, setDeletedSetIds] = useState<string[]>([])
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('lb')
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null)
  const [resolvedInventory, setResolvedInventory] = useState<EquipmentInventory>(equipmentPresets.full_gym)
  const [newExerciseName, setNewExerciseName] = useState('')

  const exerciseLibraryByName = useMemo(
    () => new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.name.toLowerCase(), exercise])),
    []
  )

  const getWeightOptions = useCallback(
    (exerciseName: string) => {
      const match = exerciseLibraryByName.get(exerciseName.toLowerCase())
      if (!match?.equipment?.length) return []
      return buildWeightOptions(resolvedInventory, match.equipment, profileWeightLb, preferredUnit)
    },
    [exerciseLibraryByName, preferredUnit, profileWeightLb, resolvedInventory]
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
      bodyWeightLb: payload.body_weight_lb ?? null,
      readiness: payload.session_readiness?.[0] ? {
        sleep_quality: payload.session_readiness[0].sleep_quality,
        muscle_soreness: payload.session_readiness[0].muscle_soreness,
        stress_level: payload.session_readiness[0].stress_level,
        motivation: payload.session_readiness[0].motivation
      } : null,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, index) => ({
          id: exercise.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles,
          metricProfile: exercise.metric_profile,
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
              completed: set.completed ?? false,
              performedAt: set.performed_at,
              weightUnit: (set.weight_unit as WeightUnit) ?? 'lb'
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
        'id, user_id, template_id, name, started_at, ended_at, timezone, body_weight_lb, session_readiness(sleep_quality, muscle_soreness, stress_level, motivation), session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit)), template:workout_templates(focus, style)'
        )
        .eq('id', params.id)
        .single()

    if (error) {
      console.error('Failed to load session', error)
      setErrorMessage('Unable to load session details. Please try again.')
    } else if (data) {
      const payload = data as unknown as SessionPayload & { template: { focus: FocusArea; style: Goal } | null }
      const mapped = mapSession(payload)
      setSession(mapped)
      if (payload.template) {
        setTemplate(payload.template)
      }
      setInitialSnapshot(JSON.stringify(mapped))
      setDeletedSetIds([])
      setDeletedExerciseIds([])
    }
    setLoading(false)
  }, [mapSession, params, supabase])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (!session?.userId) {
      return
    }
    const loadPreferences = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences, weight_lb')
        .eq('id', session.userId)
        .maybeSingle()
      if (error) {
        console.error('Failed to load profile data', error)
        return
      }
      const normalized = normalizePreferences(data?.preferences)
      setPreferredUnit(normalized.settings?.units ?? 'lb')
      setProfileWeightLb(data?.weight_lb ?? null)

      // Fallback inventory from profile
      let finalInventory = normalized.equipment?.inventory ?? equipmentPresets.full_gym

      // If session has template, try to get template specific equipment
      if (session.templateId) {
        const { data: templateData } = await supabase
          .from('workout_templates')
          .select('equipment')
          .eq('id', session.templateId)
          .maybeSingle()
        
        if (templateData?.equipment?.inventory) {
          finalInventory = templateData.equipment.inventory
        }
      }

      setResolvedInventory(finalInventory)
    }
    loadPreferences()
  }, [session?.userId, session?.templateId, supabase])

  const hasChanges = useMemo(() => {
    if (!session || !initialSnapshot) return false
    return JSON.stringify(session) !== initialSnapshot || deletedSetIds.length > 0
  }, [session, initialSnapshot, deletedSetIds])

  const updateSessionName = (value: string) => {
    setSession((prev) => (prev ? { ...prev, name: value } : prev))
  }

  const updateSessionStart = (value: string) => {
    setSession((prev) => (prev ? { ...prev, startedAt: value } : prev))
  }

  const updateSessionEnd = (value: string | null) => {
    setSession((prev) => (prev ? { ...prev, endedAt: value } : prev))
  }

  const updateSetField = (
    exerciseId: string,
    setId: string,
    field: keyof WorkoutSet,
    value: WorkoutSet[keyof WorkoutSet]
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

  const handleAddSet = (exerciseId: string) => {
    setSession((prev) => {
      if (!prev) return prev
      const performedAt = prev.startedAt ?? new Date().toISOString()
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
                performedAt,
                weightUnit: preferredUnit
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

  const handleAddExercise = () => {
    const trimmed = newExerciseName.trim()
    if (!trimmed) {
      setErrorMessage('Enter an exercise name before adding it.')
      return
    }

    const match = exerciseLibraryByName.get(trimmed.toLowerCase())
    const baseExercise = match
      ? match
      : enhanceExerciseData({
          name: trimmed,
          focus: 'full_body',
          sets: 0,
          reps: 0,
          rpe: 0,
          equipment: [],
          durationMinutes: 0,
          restSeconds: 0
        })

    const primarySlug = toMuscleSlug(String(baseExercise.primaryMuscle ?? 'full_body'), 'full_body')
    const secondarySlugs = (baseExercise.secondaryMuscles ?? [])
      .map((muscle) => toMuscleSlug(muscle, null))
      .filter((muscle): muscle is string => Boolean(muscle))

    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: [
          ...prev.exercises,
          {
            id: `temp-exercise-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: match?.name ?? trimmed,
            primaryMuscle: primarySlug,
            secondaryMuscles: secondarySlugs,
            orderIndex: prev.exercises.length,
            sets: []
          }
        ]
      }
    })

    setNewExerciseName('')
    setErrorMessage(null)
  }

  const handleDeleteExercise = (exerciseId: string) => {
    setSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        exercises: prev.exercises.filter((exercise) => exercise.id !== exerciseId)
      }
    })
    if (!exerciseId.startsWith('temp-exercise-')) {
      setDeletedExerciseIds((prev) => [...prev, exerciseId])
    }
  }

  const validateSession = () => {
    if (!session) return 'No session to update.'
    if (!session.name.trim()) return 'Session name is required.'
    const startedAtValue = new Date(session.startedAt)
    if (Number.isNaN(startedAtValue.getTime())) return 'Start time is invalid.'
    if (session.endedAt) {
      const endedAtValue = new Date(session.endedAt)
      if (Number.isNaN(endedAtValue.getTime())) return 'End time is invalid.'
      if (endedAtValue.getTime() < startedAtValue.getTime()) {
        return 'End time must be after the start time.'
      }
    }
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
      const updatePayload = {
        name: session.name,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        status: session.endedAt ? 'completed' : 'in_progress',
        body_weight_lb: session.bodyWeightLb
      }

      const { error: sessionError } = await supabase
        .from('sessions')
        .update(updatePayload)
        .eq('id', session.id)

      if (sessionError) throw sessionError

      // Sync body weight if it was updated
      if (session.bodyWeightLb && session.userId) {
        await Promise.all([
          supabase.from('profiles').update({ weight_lb: session.bodyWeightLb }).eq('id', session.userId),
          supabase.from('body_measurements').insert({ 
            user_id: session.userId, 
            weight_lb: session.bodyWeightLb,
            recorded_at: session.startedAt
          })
        ])
      }

      // Sync readiness data
      if (session.readiness) {
        const { error: readinessError } = await supabase
          .from('session_readiness')
          .upsert({
            session_id: session.id,
            sleep_quality: session.readiness.sleep_quality,
            muscle_soreness: session.readiness.muscle_soreness,
            stress_level: session.readiness.stress_level,
            motivation: session.readiness.motivation,
            recorded_at: session.startedAt
          }, { onConflict: 'session_id' })
        
        if (readinessError) throw readinessError
      }

      if (deletedExerciseIds.length > 0) {
        const { error: deleteExerciseError } = await supabase
          .from('session_exercises')
          .delete()
          .in('id', deletedExerciseIds)
        if (deleteExerciseError) throw deleteExerciseError
      }

      if (deletedSetIds.length > 0) {
        const { error: deleteError } = await supabase.from('sets').delete().in('id', deletedSetIds)
        if (deleteError) throw deleteError
      }

      const exerciseIdMap = new Map<string, string>()

      for (const exercise of session.exercises) {
        if (!exercise.id.startsWith('temp-exercise-')) continue
        const payload = {
          session_id: session.id,
          exercise_name: exercise.name,
          primary_muscle: exercise.primaryMuscle,
          secondary_muscles: exercise.secondaryMuscles ?? [],
          order_index: exercise.orderIndex ?? 0
        }
        const { data: insertedExercise, error: insertExerciseError } = await supabase
          .from('session_exercises')
          .insert(payload)
          .select('id')
          .single()
        if (insertExerciseError) throw insertExerciseError
        if (insertedExercise?.id) {
          exerciseIdMap.set(exercise.id, insertedExercise.id)
        }
      }

      for (const exercise of session.exercises) {
        const resolvedExerciseId = exerciseIdMap.get(exercise.id) ?? exercise.id
        const normalizedSets = exercise.sets.map((set, idx) => ({
          ...set,
          setNumber: idx + 1
        }))

        for (const set of normalizedSets) {
          const payload = {
            session_exercise_id: resolvedExerciseId,
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

  const filteredLibrary = useMemo(() => {
    if (!template) return EXERCISE_LIBRARY;
    
    const { focus, style } = template;
    if (style === 'cardio' || focus === 'cardio') {
      return EXERCISE_LIBRARY.filter(ex => ex.focus === 'cardio' || ex.primaryMuscle === 'cardio' || ex.metricProfile === 'cardio_session');
    }
    if (style === 'general_fitness' || focus === 'mobility') {
      return EXERCISE_LIBRARY.filter(ex => ex.focus === 'mobility' || ex.primaryMuscle === 'yoga' || ex.metricProfile === 'yoga_session' || ex.metricProfile === 'mobility_session');
    }
    if (focus && focus !== 'full_body') {
      const muscleRelevant = EXERCISE_LIBRARY.filter(ex => 
        ex.primaryMuscle?.toLowerCase().includes(focus.toLowerCase()) || 
        ex.focus?.toLowerCase().includes(focus.toLowerCase())
      );
      return muscleRelevant.length > 0 ? muscleRelevant : EXERCISE_LIBRARY;
    }
    return EXERCISE_LIBRARY;
  }, [template]);

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
                : 'alert-success'
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-subtle">Started at</label>
              <input
                type="datetime-local"
                value={toDateTimeInputValue(session.startedAt)}
                onChange={(event) => {
                  const nextValue = toIsoString(event.target.value)
                  if (nextValue) updateSessionStart(nextValue)
                }}
                className="input-base mt-2"
              />
            </div>
            <div>
              <label className="text-xs text-subtle">Ended at</label>
              <input
                type="datetime-local"
                value={toDateTimeInputValue(session.endedAt)}
                onChange={(event) => updateSessionEnd(toIsoString(event.target.value))}
                className="input-base mt-2"
              />
            </div>
              <div>
                <label className="text-xs text-subtle">Body weight (lb)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={session.bodyWeightLb ?? ''}
                  onChange={(event) => {
                    const val = event.target.value === '' ? null : parseFloat(event.target.value)
                    setSession(prev => prev ? { ...prev, bodyWeightLb: val } : prev)
                  }}
                  className="input-base"
                />
              </div>
          </div>
          {session.timezone && (
            <p className="mt-2 text-[10px] text-subtle">Timezone: {session.timezone}</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-strong mb-4">Readiness Survey</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { label: 'Sleep Quality', key: 'sleep_quality', min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' },
              { label: 'Muscle Soreness', key: 'muscle_soreness', min: 1, max: 5, minLabel: 'None', maxLabel: 'Severe' },
              { label: 'Stress Level', key: 'stress_level', min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' },
              { label: 'Motivation', key: 'motivation', min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' }
            ].map((metric) => (
              <div key={metric.key}>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-strong">{metric.label}</label>
                  <span className="text-sm font-bold text-[var(--color-primary)]">
                    {session.readiness?.[metric.key as keyof ReadinessData] ?? 3}
                  </span>
                </div>
                <input
                  type="range"
                  min={metric.min}
                  max={metric.max}
                  step="1"
                  value={session.readiness?.[metric.key as keyof ReadinessData] ?? 3}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    setSession(prev => {
                      if (!prev) return prev
                      return {
                        ...prev,
                        readiness: {
                          sleep_quality: 3,
                          muscle_soreness: 2,
                          stress_level: 2,
                          motivation: 3,
                          ...(prev.readiness ?? {}),
                          [metric.key]: value
                        }
                      }
                    })
                  }}
                  className="w-full h-2 bg-[var(--color-surface-muted)] rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
                />
                <div className="flex justify-between mt-1 text-[10px] text-subtle">
                  <span>{metric.minLabel}</span>
                  <span>{metric.maxLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          {session.exercises.map((exercise) => (
            <Card key={exercise.id} className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-strong">{exercise.name}</h2>
                  <p className="text-xs text-subtle">
                    Primary: {exercise.primaryMuscle ? toMuscleLabel(exercise.primaryMuscle) : 'N/A'}
                    {exercise.secondaryMuscles?.length
                      ? ` · Secondary: ${exercise.secondaryMuscles.map((muscle) => toMuscleLabel(muscle)).join(', ')}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteExercise(exercise.id)}
                  className="text-xs text-[var(--color-danger)] transition-colors hover:text-[var(--color-danger)]"
                >
                  Delete exercise
                </button>
              </div>

            <div className="space-y-3">
              {exercise.sets.length === 0 ? (
                <p className="text-sm text-subtle">No sets logged yet.</p>
              ) : (
                exercise.sets.map((set) => {
                  const libMatch = exerciseLibraryByName.get(exercise.name.toLowerCase());
                  const isTimeBased = isTimeBasedExercise(exercise.name, libMatch?.reps);
                  const repsLabel = isTimeBased ? 'Time (sec)' : 'Reps';

                  return (
                    <SetLogger
                      key={set.id}
                      set={set}
                      weightOptions={getWeightOptions(exercise.name)}
                      onUpdate={(field, val) => updateSetField(exercise.id, set.id, field, val)}
                      onDelete={() => handleDeleteSet(exercise.id, set.id)}
                      onToggleComplete={() => updateSetField(exercise.id, set.id, 'completed', !set.completed)}
                      metricProfile={exercise.metricProfile as any}
                      isCardio={exercise.primaryMuscle === 'cardio' || exercise.metricProfile === 'cardio_session'}
                      isYoga={exercise.primaryMuscle === 'yoga' || exercise.metricProfile === 'yoga_session'}
                      repsLabel={repsLabel}
                    />
                  );
                })
              )}
            </div>

            <Button variant="outline" className="w-full h-10" onClick={() => handleAddSet(exercise.id)}>
              Add set
            </Button>
          </Card>
        ))}
        </div>

        <Card className="p-6">
          <label className="text-xs text-subtle">Add exercise</label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <input
                type="text"
                value={newExerciseName}
                onChange={(event) => setNewExerciseName(event.target.value)}
                placeholder="Search or type an exercise"
                list="exercise-library"
                className="input-base"
              />
              <datalist id="exercise-library">
                {filteredLibrary.map((exercise) => (
                  <option key={exercise.name} value={exercise.name} />
                ))}
              </datalist>
            </div>
            <Button variant="outline" className="h-10 px-4" onClick={handleAddExercise}>
              Add exercise
            </Button>
          </div>
          <p className="mt-2 text-xs text-subtle">Add the movements you performed so metrics can be computed normally.</p>
        </Card>
      </div>
    </div>
  )
}