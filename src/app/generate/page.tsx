'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Loader2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { generatePlan, normalizePlanInput } from '@/lib/generator'
import { bandLabels, cloneInventory, equipmentPresets, formatWeightList, machineLabels, parseWeightList } from '@/lib/equipment'
import {
  buildWorkoutHistoryEntry,
  loadWorkoutHistory,
  removeWorkoutHistoryEntry,
  saveWorkoutHistoryEntry,
  setWorkoutHistoryEntries
} from '@/lib/workoutHistory'
import { CARDIO_ACTIVITY_OPTIONS } from '@/lib/cardio-activities'
import { getFlowCompletion, isEquipmentValid } from '@/lib/generationFlow'
import { logEvent } from '@/lib/logger'
import type { BandResistance, EquipmentPreset, FocusArea, Goal, MachineType, PlanInput, GeneratedPlan } from '@/types/domain'

const styleOptions: { value: Goal; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Heavier loads, lower reps, power focus.' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Muscle growth with balanced volume.' },
  { value: 'endurance', label: 'Endurance', description: 'Higher reps and conditioning focus.' }
]
const focusOptions: { value: PlanInput['preferences']['focusAreas'][number]; label: string }[] = [
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' }
]
const buildWorkoutTitle = (plan: GeneratedPlan) => plan.title

export default function GeneratePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSummary, setSaveSummary] = useState<{
    workoutId?: string
    title?: string
  } | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<ReturnType<typeof loadWorkoutHistory>>([])
  const [deletingHistoryIds, setDeletingHistoryIds] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState<PlanInput>(() =>
    normalizePlanInput({
      intent: { mode: 'body_part', style: 'strength', bodyParts: ['chest'] },
      goals: { primary: 'strength', priority: 'primary' },
      experienceLevel: 'intermediate',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: cloneInventory(equipmentPresets.full_gym) },
      time: { minutesPerSession: 45 },
      schedule: {
        daysAvailable: [0],
        minRestDays: 1,
        weeklyLayout: [
          { sessionIndex: 0, style: 'strength', focus: 'chest' }
        ]
      },
      preferences: { focusAreas: ['chest'], dislikedActivities: [], cardioActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
    })
  )

  const flowState = useMemo(() => getFlowCompletion(formData), [formData])

  const clearFeedback = () => {
    if (errors.length > 0) setErrors([])
    if (saveError) setSaveError(null)
    if (saveSummary) setSaveSummary(null)
    if (historyError) setHistoryError(null)
  }

  const updateFormData = (updater: (prev: PlanInput) => PlanInput) => {
    setFormData(prev => updater(prev))
    clearFeedback()
  }

  const getSavePlanHint = (error: { code?: string } | null) => {
    switch (error?.code) {
      case '42P01':
        return 'Missing workouts table. Run the SQL in supabase/schema.sql or create the table in Supabase.'
      case '42501':
        return 'Insert blocked by Row Level Security. Add an insert policy for the workouts table.'
      case '23502':
        return 'A required column is missing. Confirm workouts.user_id, title, and exercises are provided.'
      default:
        return null
    }
  }

  const toggleArrayValue = <T,>(values: T[], value: T) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]

  const handlePresetChange = (preset: EquipmentPreset | 'custom') => {
    updateFormData(prev => {
      const inventory = preset === 'custom' ? prev.equipment.inventory : cloneInventory(equipmentPresets[preset])
      return {
        ...prev,
        equipment: {
          preset,
          inventory
        }
      }
    })
  }

  const updateBodyPartFocus = (focus: FocusArea) => {
    updateFormData((prev) => ({
      ...prev,
      intent: {
        ...prev.intent,
        mode: 'body_part',
        bodyParts: [focus]
      },
      preferences: {
        ...prev.preferences,
        focusAreas: [focus]
      },
      schedule: {
        ...prev.schedule,
        daysAvailable: [0],
        weeklyLayout: [{ sessionIndex: 0, style: prev.goals.primary, focus }]
      }
    }))
  }

  const updatePrimaryStyle = (style: Goal) => {
    updateFormData((prev) => ({
      ...prev,
      intent: {
        ...prev.intent,
        style
      },
      goals: {
        ...prev.goals,
        primary: style
      },
      schedule: {
        ...prev.schedule,
        weeklyLayout: [
          {
            sessionIndex: 0,
            style,
            focus: prev.intent.bodyParts?.[0] ?? 'chest'
          }
        ]
      }
    }))
  }

  const setInventoryWeights = (field: 'dumbbells' | 'kettlebells' | 'plates', value: string) => {
    updateFormData(prev => {
      const weights = parseWeightList(value)
      if (field === 'plates') {
        return {
          ...prev,
          equipment: {
            ...prev.equipment,
            preset: 'custom',
            inventory: {
              ...prev.equipment.inventory,
              barbell: {
                ...prev.equipment.inventory.barbell,
                plates: weights
              }
            }
          }
        }
      }
      return {
        ...prev,
        equipment: {
          ...prev.equipment,
          preset: 'custom',
          inventory: {
            ...prev.equipment.inventory,
            [field]: weights
          }
        }
      }
    })
  }

  const handleHistoryLoad = (entry: (typeof historyEntries)[number]) => {
    updateFormData(() => {
      const normalized = normalizePlanInput(entry.plan.inputs)
      const storedFocus = normalized.intent.bodyParts?.[0] ?? entry.plan.schedule?.[0]?.focus ?? 'chest'
      return {
        ...normalized,
        intent: {
          ...normalized.intent,
          mode: 'body_part',
          bodyParts: [storedFocus]
        },
        preferences: {
          ...normalized.preferences,
          focusAreas: [storedFocus]
        },
        schedule: {
          ...normalized.schedule,
          daysAvailable: [0],
          weeklyLayout: [{ sessionIndex: 0, style: normalized.goals.primary, focus: storedFocus }]
        }
      }
    })
  }

  const handleHistoryDelete = async (entry: (typeof historyEntries)[number]) => {
    if (!confirm(`Delete "${entry.title}" from your saved workouts? This cannot be undone.`)) return
    if (!user) return
    setHistoryError(null)
    setDeletingHistoryIds(prev => ({ ...prev, [entry.id]: true }))

    try {
      if (entry.remoteId) {
        const { error } = await supabase
          .from('workouts')
          .delete()
          .eq('id', entry.remoteId)
          .eq('user_id', user.id)

        if (error) {
          console.error('Failed to delete workout history entry from server', error)
          setHistoryError('Removed locally, but unable to delete the saved workout on the server.')
        }
      }
    } catch (error) {
      console.error('Failed to delete workout history entry', error)
      setHistoryError('Removed locally, but unable to delete the saved workout on the server.')
    } finally {
      if (typeof window !== 'undefined') {
        removeWorkoutHistoryEntry(entry.id, window.localStorage)
      }
      setHistoryEntries((prev) => prev.filter(item => item.id !== entry.id))
      setDeletingHistoryIds(prev => ({ ...prev, [entry.id]: false }))
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const history = loadWorkoutHistory(window.localStorage)
      setHistoryEntries(history)
    } catch (error) {
      console.error('Failed to load history', error)
      setHistoryError('Unable to load workout history.')
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined') return

    const syncHistory = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)

      if (error) {
        console.error('Failed to sync workout history', error)
        return
      }

      const existingIds = new Set((data ?? []).map((row) => row.id))
      setHistoryEntries((prev) => {
        const next = prev.filter((entry) => !entry.remoteId || existingIds.has(entry.remoteId))
        if (next.length !== prev.length) {
          setWorkoutHistoryEntries(next, window.localStorage)
        }
        return next
      })
    }

    syncHistory()
  }, [supabase, user])

  const savePlanToDatabase = async (plan: GeneratedPlan) => {
    if (!user) return null

    const newPlan = {
      user_id: user.id,
      title: buildWorkoutTitle(plan),
      description: plan.description,
      goal: plan.goal,
      level: plan.level,
      tags: plan.tags,
      exercises: {
        schedule: plan.schedule,
        inputs: plan.inputs,
        summary: plan.summary
      }
    }

    const { data, error } = await supabase
      .from('workouts')
      .insert([newPlan])
      .select()
      .single()

    if (error) {
      const hint = getSavePlanHint(error)
      console.error('Failed to save plan', { error, hint })
      setSaveError(`Failed to generate plan: ${error.message}${hint ? ` ${hint}` : ''}`)
      return null
    }

    if (!data) {
      console.error('Failed to save plan', { error: 'No data returned from insert.' })
      setSaveError('Failed to generate plan. No data returned from insert.')
      return null
    }

    if (typeof window !== 'undefined') {
      try {
        const entry = buildWorkoutHistoryEntry(plan, data.id)
        const titledEntry = { ...entry, title: buildWorkoutTitle(plan) }
        saveWorkoutHistoryEntry(titledEntry, window.localStorage)
        setHistoryEntries((prev) => [titledEntry, ...prev.filter(item => item.id !== titledEntry.id)])
      } catch (error) {
        console.error('Failed to store workout history', error)
        setHistoryError('Unable to save workout history locally.')
      }
    }

    return {
      workoutId: data.id,
      title: plan.title
    }
  }

  const generatePlanHandler = async () => {
    if (!user) return
    setLoading(true)
    setSaveError(null)

    const { plan, errors: validationErrors } = generatePlan(formData)
    if (validationErrors.length > 0 || !plan) {
      setErrors(validationErrors)
      logEvent('warn', 'plan_validation_failed', { errors: validationErrors })
      setLoading(false)
      return
    }

    setErrors([])
    setSaveSummary(null)
    logEvent('info', 'plan_generated', {
      userId: user.id,
      sessionsPerWeek: plan.summary.sessionsPerWeek,
      totalMinutes: plan.summary.totalMinutes,
      goals: plan.inputs.goals,
      equipment: plan.inputs.equipment
    })

    try {
      const saveResult = await savePlanToDatabase(plan)
      if (!saveResult) return

      setSaveSummary({
        workoutId: saveResult.workoutId,
        title: saveResult.title
      })
    } catch (err) {
      console.error('Failed to save plan', err)
      setSaveError('Failed to generate plan. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const invalidEquipment = !isEquipmentValid(formData.equipment)

  const inventory = formData.equipment.inventory

  const equipmentSummary = [
    inventory.bodyweight ? 'Bodyweight' : null,
    inventory.dumbbells.length > 0 ? `Dumbbells (${formatWeightList(inventory.dumbbells)} lb)` : null,
    inventory.kettlebells.length > 0 ? `Kettlebells (${formatWeightList(inventory.kettlebells)} lb)` : null,
    inventory.bands.length > 0 ? `Bands (${inventory.bands.map(band => bandLabels[band]).join(', ')})` : null,
    inventory.barbell.available
      ? `Barbell${inventory.barbell.plates.length ? ` + Plates (${formatWeightList(inventory.barbell.plates)} lb)` : ''}`
      : null,
    Object.entries(inventory.machines)
      .filter(([, available]) => available)
      .map(([machine]) => machineLabels[machine as MachineType])
      .join(', ') || null
  ].filter(Boolean) as string[]

  const statusContent = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-accent">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Generating your workout plan...
        </div>
      )
    }

    if (saveError) {
      return <div className="text-sm text-[var(--color-danger)]">{saveError}</div>
    }

    if (saveSummary) {
      return (
        <div className="space-y-3 text-sm text-muted">
          {saveSummary.title && (
            <div className="rounded-lg border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-[var(--color-primary-strong)]">
              Saved plan: {saveSummary.title}
            </div>
          )}
          {saveSummary.workoutId && (
            <Button type="button" variant="secondary" onClick={() => router.push(`/workout/${saveSummary.workoutId}?from=generate`)}>
              View generated plan
            </Button>
          )}
        </div>
      )
    }

    if (errors.length > 0) {
      return (
        <div className="text-sm text-[var(--color-danger)]">
          Review the items below and resolve them before generating your plan.
        </div>
      )
    }

    if (!flowState.isFormValid) {
      return <div className="text-sm text-muted">Complete the required steps to unlock generation.</div>
    }

    return <div className="text-sm text-muted">Everything looks good. Generate your plan when ready.</div>
  }

  if (userLoading) return <div className="page-shell p-8 text-center text-muted">Loading...</div>

  return (
    <div className="page-shell">
      <div className="mb-8 px-4 pt-8 sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center text-3xl font-semibold text-strong">
              <Wand2 className="mr-3 h-8 w-8 text-accent" />
              Generate Workout Plan
            </h1>
            <p className="mt-2 text-muted">
              Answer each step to create a plan that matches your goals, schedule, and preferences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
              <X className="h-4 w-4" /> Close
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-10 2xl:px-16">
        <Card className="p-6">
          <div className="space-y-10">
            <section className="space-y-4" id="step-intent">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 1</p>
                <h2 className="text-xl font-semibold text-strong">Choose your workout focus</h2>
                <p className="text-sm text-muted">
                  Pick the muscle group you want to train and the training style for this plan.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {focusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateBodyPartFocus(option.value)}
                    className={`rounded-lg border px-4 py-4 text-left transition ${
                      formData.intent.bodyParts?.[0] === option.value
                        ? 'border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-muted hover:border-[var(--color-border-strong)]'
                    }`}
                    aria-pressed={formData.intent.bodyParts?.[0] === option.value}
                  >
                    <p className="text-sm font-semibold text-strong">{option.label}</p>
                    <p className="mt-1 text-xs text-subtle">Generate a dedicated {option.label.toLowerCase()} plan.</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-strong">Training style</label>
                <select
                  value={formData.goals.primary}
                  onChange={(e) => updatePrimaryStyle(e.target.value as Goal)}
                  className="input-base"
                >
                  {styleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-strong">Experience level</label>
                <select
                  value={formData.experienceLevel}
                  onChange={(e) =>
                    updateFormData(prev => ({
                      ...prev,
                      experienceLevel: e.target.value as PlanInput['experienceLevel']
                    }))
                  }
                  className="input-base"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-strong">Intensity</label>
                <select
                  value={formData.intensity}
                  onChange={(e) =>
                    updateFormData(prev => ({
                      ...prev,
                      intensity: e.target.value as PlanInput['intensity']
                    }))
                  }
                  className="input-base"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>

            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 2</p>
                <h2 className="text-xl font-semibold text-strong">Equipment & constraints</h2>
                <p className="text-sm text-muted">Tell us what you have and any important preferences.</p>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-strong">Equipment preset</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {([
                    { key: 'full_gym', label: 'Full Gym' },
                    { key: 'custom', label: 'Custom' }
                  ] as { key: EquipmentPreset | 'custom'; label: string }[]).map(preset => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handlePresetChange(preset.key)}
                      className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                        formData.equipment.preset === preset.key
                          ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]'
                          : 'bg-[var(--color-surface)] border-[var(--color-border)] text-muted hover:border-[var(--color-border-strong)]'
                      }`}
                      aria-pressed={formData.equipment.preset === preset.key}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-strong">Dumbbell weights (lb)</label>
                  <input
                    type="text"
                    value={formatWeightList(inventory.dumbbells)}
                    onChange={(e) => setInventoryWeights('dumbbells', e.target.value)}
                    placeholder="e.g. 10, 15, 20"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-strong">Kettlebell weights (lb)</label>
                  <input
                    type="text"
                    value={formatWeightList(inventory.kettlebells)}
                    onChange={(e) => setInventoryWeights('kettlebells', e.target.value)}
                    placeholder="e.g. 20, 35"
                    className="input-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-strong">Bands (resistance levels)</label>
                  <div className="flex flex-wrap gap-3">
                    {(['light', 'medium', 'heavy'] as BandResistance[]).map(level => (
                      <label key={level} className="flex items-center gap-2 text-sm text-muted">
                        <input
                          type="checkbox"
                          checked={inventory.bands.includes(level)}
                          onChange={() =>
                            updateFormData(prev => ({
                              ...prev,
                              equipment: {
                                ...prev.equipment,
                                preset: 'custom',
                                inventory: {
                                  ...prev.equipment.inventory,
                                  bands: toggleArrayValue(prev.equipment.inventory.bands, level)
                                }
                              }
                            }))
                          }
                          className="accent-[var(--color-primary)]"
                        />
                        {bandLabels[level]}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-strong">Barbell + plates</label>
                  <label className="mb-2 flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={inventory.barbell.available}
                      onChange={() =>
                        updateFormData(prev => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            preset: 'custom',
                            inventory: {
                              ...prev.equipment.inventory,
                              barbell: {
                                ...prev.equipment.inventory.barbell,
                                available: !prev.equipment.inventory.barbell.available
                              }
                            }
                          }
                        }))
                      }
                      className="accent-[var(--color-primary)]"
                    />
                    Barbell available
                  </label>
                  <input
                    type="text"
                    value={formatWeightList(inventory.barbell.plates)}
                    onChange={(e) => setInventoryWeights('plates', e.target.value)}
                    placeholder="e.g. 10, 25, 45"
                    className="input-base"
                    disabled={!inventory.barbell.available}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-strong">Machine availability</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(Object.keys(machineLabels) as MachineType[]).map(machine => (
                    <label key={machine} className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={inventory.machines[machine]}
                        onChange={() =>
                          updateFormData(prev => ({
                            ...prev,
                            equipment: {
                              ...prev.equipment,
                              preset: 'custom',
                              inventory: {
                                ...prev.equipment.inventory,
                                machines: {
                                  ...prev.equipment.inventory.machines,
                                  [machine]: !prev.equipment.inventory.machines[machine]
                                }
                              }
                            }
                          }))
                        }
                        className="accent-[var(--color-primary)]"
                      />
                      {machineLabels[machine]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-strong">Cardio activities (optional)</label>
                <div className="flex flex-wrap gap-3">
                  {CARDIO_ACTIVITY_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={formData.preferences.cardioActivities.includes(option.value)}
                        onChange={() =>
                          updateFormData(prev => ({
                            ...prev,
                            preferences: {
                              ...prev.preferences,
                              cardioActivities: toggleArrayValue(prev.preferences.cardioActivities, option.value)
                            }
                          }))
                        }
                        className="accent-[var(--color-primary)]"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-subtle">Leave blank to allow any cardio activity.</p>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={inventory.bodyweight}
                  onChange={() =>
                    updateFormData(prev => ({
                      ...prev,
                      equipment: {
                        ...prev.equipment,
                        preset: 'custom',
                        inventory: {
                          ...prev.equipment.inventory,
                          bodyweight: !prev.equipment.inventory.bodyweight
                        }
                      }
                    }))
                  }
                  className="accent-[var(--color-primary)]"
                />
                Bodyweight movements available
              </label>

              {invalidEquipment && (
                <p className="text-xs text-[var(--color-danger)]">Choose at least one equipment option.</p>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 3</p>
                <h2 className="text-xl font-semibold text-strong">Review & generate</h2>
                <p className="text-sm text-muted">Confirm the highlights before we build your plan.</p>
              </div>

              <div className="surface-card-subtle p-4">
                <h3 className="mb-3 text-sm font-semibold text-strong">Selection summary</h3>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-subtle">Muscle focus</dt>
                    <dd className="text-strong capitalize">
                      {formData.intent.bodyParts?.[0]?.replace('_', ' ') ?? 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Training style</dt>
                    <dd className="text-strong capitalize">{(formData.intent.style ?? formData.goals.primary).replace('_', ' ')}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Experience level</dt>
                    <dd className="text-strong capitalize">{formData.experienceLevel}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Intensity</dt>
                    <dd className="text-strong capitalize">{formData.intensity}</dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Equipment</dt>
                    <dd className="text-strong">{equipmentSummary.length ? equipmentSummary.join(', ') : 'Not set'}</dd>
                  </div>
                </dl>
              </div>

              <div className="surface-card-subtle p-4" aria-live="polite">
                {statusContent()}
                {errors.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[var(--color-danger)]">
                    {errors.map(error => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>

              <Button
                onClick={async () => {
                  await generatePlanHandler()
                }}
                disabled={loading || !flowState.isFormValid}
                className="w-full py-5 text-base"
                aria-label="Generate Workout Plan"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin mr-2 h-5 w-5" /> Generating...
                  </span>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate Plan
                  </>
                )}
              </Button>
            </section>
          </div>
        </Card>

      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-strong">Saved Workouts</h2>
            <p className="text-xs text-subtle">Quickly reload or open a recently generated plan.</p>
          </div>
        </div>

        {historyError && <p className="mb-3 text-sm text-[var(--color-danger)]">{historyError}</p>}

        {historyEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-sm text-muted">
            No saved workouts yet. Generate a plan to start building your history.
          </div>
        ) : (
          <div className="space-y-3">
            {historyEntries.map(entry => (
              <div
                key={entry.id}
                className="surface-card-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-strong">{entry.title}</p>
                  <p className="text-xs text-subtle">
                    {new Date(entry.createdAt).toLocaleString()} · Score {entry.plan.summary.impact.score}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    Focus on {(entry.plan.schedule?.[0]?.focus ?? entry.plan.inputs.intent.bodyParts?.[0] ?? entry.plan.goal).replace('_', ' ')}
                    {' '}· {(entry.plan.goal ?? entry.plan.inputs.goals.primary).replace('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => handleHistoryLoad(entry)}
                    className="px-3 py-2 text-xs"
                  >
                    Reload Setup
                  </Button>
                  {entry.remoteId ? (
                    <Button
                      type="button"
                      onClick={() => router.push(`/workout/${entry.remoteId}?from=generate`)}
                      className="px-3 py-2 text-xs"
                      variant="secondary"
                    >
                      Quick View
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => handleHistoryDelete(entry)}
                    className="px-3 py-2 text-xs border border-[var(--color-danger-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    variant="outline"
                    disabled={Boolean(deletingHistoryIds[entry.id])}
                  >
                    {deletingHistoryIds[entry.id] ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
    </div>
  )
}
