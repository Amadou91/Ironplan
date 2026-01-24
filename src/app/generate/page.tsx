'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { ArrowRight, Loader2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { buildWorkoutTemplate, normalizePlanInput } from '@/lib/generator'
import { buildWorkoutDisplayName } from '@/lib/workout-naming'
import {
  bandLabels,
  cloneInventory,
  equipmentPresets,
  formatWeightList,
  machineLabels,
  BARBELL_PLATE_OPTIONS
} from '@/lib/equipment'
import { applyPreferencesToPlanInput, normalizePreferences } from '@/lib/preferences'
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
import { useWorkoutStore } from '@/store/useWorkoutStore'
import type { BandResistance, EquipmentPreset, FocusArea, Goal, MachineType, PlanInput, WorkoutTemplateDraft } from '@/types/domain'

const styleOptions: { value: Goal; label: string; description: string }[] = [
  { value: 'strength', label: 'Strength', description: 'Heavier loads, lower reps, power focus.' },
  { value: 'hypertrophy', label: 'Hypertrophy', description: 'Muscle growth with balanced volume.' },
  { value: 'endurance', label: 'Endurance', description: 'Higher reps and conditioning focus.' }
]
const focusOptions: { value: FocusArea; label: string; description?: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'mobility', label: 'Yoga' },
  { value: 'cardio', label: 'Cardio' }
]

type WeightField = 'dumbbells' | 'kettlebells'

type WeightRange = {
  label: string
  weights: readonly number[]
}

const WEIGHT_RANGE_CONFIG: {
  field: WeightField
  label: string
  ranges: WeightRange[]
}[] = [
  {
    field: 'dumbbells',
    label: 'Dumbbells',
    ranges: [
      { label: '5-15 lb', weights: [5, 8, 10, 12, 15] },
      { label: '20-30 lb', weights: [20, 25, 30] },
      { label: '35-50 lb', weights: [35, 40, 45, 50] },
      { label: '55-60 lb', weights: [55, 60] }
    ]
  },
  {
    field: 'kettlebells',
    label: 'Kettlebells',
    ranges: [
      { label: '10-20 lb', weights: [10, 15, 20] },
      { label: '25-35 lb', weights: [25, 30, 35] },
      { label: '40-50 lb', weights: [40, 45, 50] },
      { label: '60 lb', weights: [60] }
    ]
  }
]

const cardioMachineOptions: MachineType[] = ['treadmill', 'rower']
const strengthMachineOptions: MachineType[] = ['cable', 'leg_press']

type WeightRangeSelectorProps = {
  field: WeightField
  label: string
  ranges: WeightRange[]
  selected: number[]
  onToggleRange: (weights: readonly number[]) => void
}

const WeightRangeSelector = ({ field, label, ranges, selected, onToggleRange }: WeightRangeSelectorProps) => (
  <div className="space-y-3">
    <p className="text-sm font-semibold text-strong">{label}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ranges.map((range) => {
        const allSelected = range.weights.every(weight => selected.includes(weight))
        const someSelected = !allSelected && range.weights.some(weight => selected.includes(weight))
        return (
          <Checkbox
            key={`${field}-${range.label}`}
            label={range.label}
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={() => onToggleRange(range.weights)}
          />
        )
      })}
    </div>
  </div>
)

const buildCardioInventory = (
  inventory: PlanInput['equipment']['inventory']
): PlanInput['equipment']['inventory'] => ({
  bodyweight: inventory.bodyweight,
  dumbbells: [],
  kettlebells: [],
  bands: [],
  barbell: { available: false, plates: [] },
  machines: {
    cable: false,
    leg_press: false,
    treadmill: inventory.machines.treadmill,
    rower: inventory.machines.rower
  }
})
const buildWorkoutTitle = (template: WorkoutTemplateDraft) =>
  buildWorkoutDisplayName({
    focus: template.focus,
    style: template.style,
    intensity: template.inputs.intensity,
    fallback: template.title
  })

export default function GeneratePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSummary, setSaveSummary] = useState<{
    templateId?: string
    title?: string
  } | null>(null)
  const [lastSavedTemplate, setLastSavedTemplate] = useState<{
    templateId: string
    title: string
    focus: FocusArea
    style: Goal
    input: PlanInput
  } | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<ReturnType<typeof loadWorkoutHistory>>([])
  const [deletingHistoryIds, setDeletingHistoryIds] = useState<Record<string, boolean>>({})
  const [startSessionError, setStartSessionError] = useState<string | null>(null)
  const [startingSessionKey, setStartingSessionKey] = useState<string | null>(null)
  const [preferencesApplied, setPreferencesApplied] = useState(false)
  const [hasUserEdits, setHasUserEdits] = useState(false)
  const activeSession = useWorkoutStore((state) => state.activeSession)
  const lastStrengthInventoryRef = useRef<PlanInput['equipment']['inventory'] | null>(null)
  const lastStrengthPresetRef = useRef<PlanInput['equipment']['preset'] | null>(null)

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
    if (startSessionError) setStartSessionError(null)
  }

  const updateFormData = (updater: (prev: PlanInput) => PlanInput) => {
    setFormData(prev => updater(prev))
    setHasUserEdits(true)
    clearFeedback()
  }

  const getSavePlanHint = (error: { code?: string } | null) => {
    switch (error?.code) {
      case '42P01':
        return 'Missing workout_templates table. Run the SQL in supabase/schema.sql or create the table in Supabase.'
      case '42501':
        return 'Insert blocked by Row Level Security. Add an insert policy for the workout_templates table.'
      case '23502':
        return 'A required column is missing. Confirm workout_templates.user_id, title, focus, style, and template_inputs are provided.'
      case '23503':
        return 'Your user record was not found. Sign out and back in to refresh your session.'
      default:
        return null
    }
  }

  const toggleArrayValue = <T,>(values: T[], value: T) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]

  const toggleInventoryWeights = (field: WeightField, weights: readonly number[]) => {
    updateFormData(prev => {
      const nextWeights = new Set(prev.equipment.inventory[field])
      const hasAll = weights.every(weight => nextWeights.has(weight))
      weights.forEach(weight => {
        if (hasAll) {
          nextWeights.delete(weight)
        } else {
          nextWeights.add(weight)
        }
      })
      return {
        ...prev,
        equipment: {
          ...prev.equipment,
          preset: 'custom',
          inventory: {
            ...prev.equipment.inventory,
            [field]: Array.from(nextWeights).sort((a, b) => a - b)
          }
        }
      }
    })
  }

  const toggleBarbellPlate = (weight: typeof BARBELL_PLATE_OPTIONS[number]) => {
    updateFormData(prev => {
      const hasWeight = prev.equipment.inventory.barbell.plates.includes(weight)
      const nextPlates = hasWeight
        ? prev.equipment.inventory.barbell.plates.filter(item => item !== weight)
        : [...prev.equipment.inventory.barbell.plates, weight]
      return {
        ...prev,
        equipment: {
          ...prev.equipment,
          preset: 'custom',
          inventory: {
            ...prev.equipment.inventory,
            barbell: {
              available: hasWeight ? prev.equipment.inventory.barbell.available : true,
              plates: nextPlates.sort((a, b) => a - b)
            }
          }
        }
      }
    })
  }

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

  const handleFocusChange = (focus: FocusArea) => {
    updateFormData((prev) => {
      let targetStyle: Goal = prev.goals.primary
      if (focus === 'mobility') targetStyle = 'general_fitness'
      else if (focus === 'cardio') targetStyle = 'cardio'
      else if (['cardio', 'general_fitness'].includes(prev.goals.primary)) {
          targetStyle = 'strength'
      }

      const isCardio = targetStyle === 'cardio'
      const isYoga = targetStyle === 'general_fitness'
      const wasCardio = prev.goals.primary === 'cardio'
      const wasYoga = prev.goals.primary === 'general_fitness'

      if ((isCardio || isYoga) && !wasCardio && !wasYoga) {
        lastStrengthInventoryRef.current = cloneInventory(prev.equipment.inventory)
        lastStrengthPresetRef.current = prev.equipment.preset
      }
      
      const nextInventory = isCardio
        ? buildCardioInventory(prev.equipment.inventory)
        : (wasCardio || wasYoga) && !isCardio && !isYoga
          ? cloneInventory(lastStrengthInventoryRef.current ?? equipmentPresets.full_gym)
          : prev.equipment.inventory
      
      const nextPreset = isCardio
        ? 'custom'
        : (wasCardio || wasYoga) && !isCardio && !isYoga
          ? lastStrengthPresetRef.current ?? 'full_gym'
          : prev.equipment.preset

      return {
        ...prev,
        intent: {
          ...prev.intent,
          mode: (isCardio || isYoga) ? 'style' : 'body_part',
          style: (isCardio || isYoga) ? targetStyle : undefined,
          bodyParts: [focus]
        },
        goals: {
          ...prev.goals,
          primary: targetStyle
        },
        equipment: {
          ...prev.equipment,
          preset: nextPreset,
          inventory: nextInventory
        },
        preferences: {
          ...prev.preferences,
          focusAreas: [focus]
        },
        schedule: {
          ...prev.schedule,
          weeklyLayout: [{ sessionIndex: 0, style: targetStyle, focus }]
        }
      }
    })
  }

  const updatePrimaryStyle = (style: Goal) => {
    updateFormData((prev) => {
      const isCardio = style === 'cardio'
      const isYoga = style === 'general_fitness'
      const wasCardio = prev.goals.primary === 'cardio'
      const wasYoga = prev.goals.primary === 'general_fitness'

      if ((isCardio || isYoga) && !wasCardio && !wasYoga) {
        lastStrengthInventoryRef.current = cloneInventory(prev.equipment.inventory)
        lastStrengthPresetRef.current = prev.equipment.preset
      }
      
      const fallbackFocus = prev.intent.bodyParts?.[0] ?? prev.preferences.focusAreas[0] ?? 'chest'
      const bodyFocus = (fallbackFocus === 'cardio' || fallbackFocus === 'mobility') ? 'chest' : fallbackFocus
      
      const nextFocus = isCardio ? 'cardio' : isYoga ? 'mobility' : bodyFocus

      const nextInventory = isCardio
        ? buildCardioInventory(prev.equipment.inventory)
        : (wasCardio || wasYoga)
          ? cloneInventory(lastStrengthInventoryRef.current ?? equipmentPresets.full_gym)
          : prev.equipment.inventory
      
      const nextPreset = isCardio
        ? 'custom'
        : (wasCardio || wasYoga)
          ? lastStrengthPresetRef.current ?? 'full_gym'
          : prev.equipment.preset

      return {
        ...prev,
        intent: {
          ...prev.intent,
          mode: (isCardio || isYoga) ? 'style' : 'body_part',
          style,
          bodyParts: (isCardio || isYoga) ? prev.intent.bodyParts : [bodyFocus]
        },
        goals: {
          ...prev.goals,
          primary: style
        },
        equipment: {
          ...prev.equipment,
          preset: nextPreset,
          inventory: nextInventory
        },
        preferences: {
          ...prev.preferences,
          focusAreas: [nextFocus]
        },
        schedule: {
          ...prev.schedule,
          weeklyLayout: [
            {
              sessionIndex: 0,
              style,
              focus: nextFocus
            }
          ]
        }
      }
    })
  }

  const handleHistoryLoad = (entry: (typeof historyEntries)[number]) => {
    updateFormData(() => {
      const normalized = normalizePlanInput(entry.template.inputs)
      const storedFocus = normalized.intent.bodyParts?.[0] ?? entry.template.focus ?? 'chest'
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
    const entryTitle = buildWorkoutDisplayName({
      focus: entry.template.focus,
      style: entry.template.style,
      intensity: entry.template.inputs.intensity,
      fallback: entry.title
    })
    if (!confirm(`Delete "${entryTitle}" from your saved templates? This cannot be undone.`)) return
    if (!user) return
    setHistoryError(null)
    setDeletingHistoryIds(prev => ({ ...prev, [entry.id]: true }))

    try {
      if (entry.remoteId) {
        const { error } = await supabase
          .from('workout_templates')
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
        .from('workout_templates')
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

  useEffect(() => {
    if (!user || preferencesApplied || hasUserEdits) return
    let isMounted = true
    const loadPreferences = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.error('Failed to load preferences for generate flow', error)
        if (isMounted) setPreferencesApplied(true)
        return
      }
      const normalized = normalizePreferences(data?.preferences)
      if (isMounted) {
        setFormData((prev) => applyPreferencesToPlanInput(prev, normalized))
        setPreferencesApplied(true)
      }
    }
    loadPreferences()
    return () => {
      isMounted = false
    }
  }, [hasUserEdits, preferencesApplied, supabase, user])

  const savePlanToDatabase = async (template: WorkoutTemplateDraft) => {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const authUser = authData?.user
    if (authError || !authUser) {
      setSaveError('Your session has expired. Please sign in again.')
      return null
    }

    const displayTitle = buildWorkoutTitle(template)
    const newTemplate = {
      user_id: authUser.id,
      title: displayTitle,
      description: template.description,
      focus: template.focus,
      style: template.style,
      experience_level: template.inputs.experienceLevel,
      intensity: template.inputs.intensity,
      equipment: template.inputs.equipment,
      preferences: template.inputs.preferences,
      template_inputs: template.inputs
    }

    const { data, error } = await supabase
      .from('workout_templates')
      .insert([newTemplate])
      .select()
      .single()

    if (error) {
      const hint = getSavePlanHint(error)
      console.error('Failed to save template', { error, hint })
      setSaveError(`Failed to save template: ${error.message}${hint ? ` ${hint}` : ''}`)
      return null
    }

    if (!data) {
      console.error('Failed to save template', { error: 'No data returned from insert.' })
      setSaveError('Failed to save template. No data returned from insert.')
      return null
    }

    if (typeof window !== 'undefined') {
      try {
        const entry = buildWorkoutHistoryEntry(template, data.id)
        const titledEntry = { ...entry, title: displayTitle }
        saveWorkoutHistoryEntry(titledEntry, window.localStorage)
        setHistoryEntries((prev) => [titledEntry, ...prev.filter(item => item.id !== titledEntry.id)])
      } catch (error) {
        console.error('Failed to store workout history', error)
        setHistoryError('Unable to save workout history locally.')
      }
    }

    return {
      templateId: data.id,
      title: displayTitle,
      focus: template.focus,
      style: template.style,
      input: template.inputs
    }
  }

  const handleStartSession = ({
    templateId,
    sessionKey
  }: {
    templateId: string
    sessionKey: string
  }) => {
    if (!user) return
    if (activeSession) {
      setStartSessionError('Finish your current session before starting a new one.')
      if (activeSession.templateId && activeSession.id) {
        router.push(`/workouts/${activeSession.templateId}/active?sessionId=${activeSession.id}&from=generate`)
      } else if (activeSession.id) {
        // Fallback for manual sessions or sessions without a template link
        router.push(`/workouts/active?sessionId=${activeSession.id}&from=generate`)
      }
      return
    }
    setStartSessionError(null)
    setStartingSessionKey(sessionKey)
    router.push(`/workouts/${templateId}/start`)
  }

  const generatePlanHandler = async () => {
    if (!user) return
    setLoading(true)
    setSaveError(null)

    const { template, errors: validationErrors } = buildWorkoutTemplate(formData)
    if (validationErrors.length > 0 || !template) {
      setErrors(validationErrors)
      logEvent('warn', 'plan_validation_failed', { errors: validationErrors })
      setLoading(false)
      return
    }

    setErrors([])
    setSaveSummary(null)
    logEvent('info', 'plan_generated', {
      userId: user.id,
      focus: template.focus,
      style: template.style,
      experienceLevel: template.inputs.experienceLevel,
      intensity: template.inputs.intensity,
      equipment: template.inputs.equipment
    })

    try {
      const saveResult = await savePlanToDatabase(template)
      if (!saveResult) return

      setSaveSummary({
        templateId: saveResult.templateId,
        title: saveResult.title
      })
      setLastSavedTemplate({
        templateId: saveResult.templateId,
        title: saveResult.title,
        focus: saveResult.focus,
        style: saveResult.style,
        input: saveResult.input
      })
    } catch (err) {
      console.error('Failed to save template', err)
      setSaveError('Failed to save template. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const invalidEquipment = !isEquipmentValid(formData.equipment)
  const isCardioStyle = formData.goals.primary === 'cardio'
  const isYogaStyle = formData.goals.primary === 'general_fitness'
  const inventory = formData.equipment.inventory

  const equipmentSummary = (
    (isCardioStyle || isYogaStyle)
      ? [
        inventory.bodyweight ? 'Bodyweight' : null,
        ...(isCardioStyle ? cardioMachineOptions : [])
          .filter((machine) => inventory.machines[machine])
          .map((machine) => machineLabels[machine])
      ]
      : [
        inventory.bodyweight ? 'Bodyweight' : null,
        inventory.dumbbells.length > 0 ? `Dumbbells (${formatWeightList(inventory.dumbbells)} lb)` : null,
        inventory.kettlebells.length > 0 ? `Kettlebells (${formatWeightList(inventory.kettlebells)} lb)` : null,
        inventory.bands.length > 0 ? `Bands (${inventory.bands.map(band => bandLabels[band]).join(', ')})` : null,
        inventory.barbell.available
          ? `Barbell${inventory.barbell.plates.length ? ` + Plates (${formatWeightList(inventory.barbell.plates)} lb)` : ''}`
          : null,
        strengthMachineOptions
          .filter((machine) => inventory.machines[machine])
          .map((machine) => machineLabels[machine])
          .join(', ') || null
      ]
  ).filter(Boolean) as string[]

  const statusContent = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-accent">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving your workout template...
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
            <div className="alert-success px-3 py-2">
              Saved template: {saveSummary.title}
            </div>
          )}
          {startSessionError && <div className="text-[var(--color-danger)]">{startSessionError}</div>}
        </div>
      )
    }

    if (errors.length > 0) {
      return (
        <div className="text-sm text-[var(--color-danger)]">
          Review the items below and resolve them before saving your template.
        </div>
      )
    }

    if (!flowState.isFormValid) {
      return <div className="text-sm text-muted">Complete the required steps to unlock generation.</div>
    }

    return <div className="text-sm text-muted">Everything looks good. Save your template when ready.</div>
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
              Answer each step to create a template that matches your training style, schedule, and preferences.
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
                  Pick a muscle group, or select Yoga/Cardio.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {focusOptions.map((option) => {
                  const isSelected = formData.intent.bodyParts?.[0] === option.value
                  
                  // Dynamic styling based on focus type
                  let baseColors = ''
                  let selectedColors = ''
                  
                  if (option.value === 'mobility') {
                    // Yoga - Gentle Emerald
                    baseColors = 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 text-strong hover:border-emerald-500/30 hover:bg-emerald-500/[0.02]'
                    selectedColors = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-4 ring-emerald-500/20'
                  } else if (option.value === 'cardio') {
                    // Cardio - Friendly Purple
                    baseColors = 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 text-strong hover:border-purple-500/30 hover:bg-purple-500/[0.02]'
                    selectedColors = 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-4 ring-purple-500/20'
                  } else {
                    // Muscle - Soft Blue
                    baseColors = 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]/40 text-strong hover:border-blue-500/30 hover:bg-blue-500/[0.02]'
                    selectedColors = 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-4 ring-blue-500/20'
                  }

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleFocusChange(option.value)}
                      className={`rounded-xl border px-4 py-5 text-center transition-all duration-200 ${
                        isSelected ? selectedColors : baseColors
                      }`}
                      aria-pressed={isSelected}
                    >
                      <p className="text-sm font-bold uppercase tracking-wide">{option.label}</p>
                    </button>
                  )
                })}
              </div>

              {!isCardioStyle && !isYogaStyle && (
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
              )}

            </section>

            <section className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 2</p>
                <h2 className="text-xl font-semibold text-strong">Equipment & constraints</h2>
                <p className="text-sm text-muted">Tell us what you have and any important preferences.</p>
              </div>

              <div className="space-y-5">
                {!isCardioStyle && !isYogaStyle && (
                  <>
                    <div className="surface-card p-5 border-[var(--color-primary-border)] bg-[var(--color-primary-soft)]">
                      <div className="flex flex-col gap-2 border-b border-[var(--color-primary-border)] pb-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Equipment preset</h3>
                        <p className="text-xs text-subtle">Apply a full setup or keep building a custom list.</p>
                      </div>
                      <div className="mt-4">
                        <div
                          role="group"
                          aria-label="Equipment preset"
                          className="flex flex-wrap gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
                        >
                          {([
                            { key: 'full_gym', label: 'Full Gym' },
                            { key: 'custom', label: 'Custom' }
                          ] as { key: EquipmentPreset | 'custom'; label: string }[]).map(preset => (
                            <button
                              key={preset.key}
                              type="button"
                              onClick={() => handlePresetChange(preset.key)}
                              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                formData.equipment.preset === preset.key
                                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                  : 'text-muted hover:text-strong'
                              }`}
                              aria-pressed={formData.equipment.preset === preset.key}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="surface-card-subtle p-5">
                      <div className="border-b border-[var(--color-border)] pb-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Free weights</h3>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <div className="space-y-5">
                          {WEIGHT_RANGE_CONFIG.map((fieldConfig) => (
                            <WeightRangeSelector
                              key={fieldConfig.field}
                              field={fieldConfig.field}
                              label={fieldConfig.label}
                              ranges={fieldConfig.ranges}
                              selected={inventory[fieldConfig.field]}
                              onToggleRange={(weights) => toggleInventoryWeights(fieldConfig.field, weights)}
                            />
                          ))}
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-strong">Barbell + plates</p>
                          <Checkbox
                            label="Barbell available"
                            checked={inventory.barbell.available}
                            onCheckedChange={() =>
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
                          />
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {BARBELL_PLATE_OPTIONS.map((plate) => (
                              <Checkbox
                                key={`barbell-${plate}`}
                                label={`${plate} lb`}
                                checked={inventory.barbell.plates.includes(plate)}
                                onCheckedChange={() => toggleBarbellPlate(plate)}
                                disabled={!inventory.barbell.available}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="surface-card-subtle p-5">
                      <div className="border-b border-[var(--color-border)] pb-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Machines</h3>
                      </div>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {strengthMachineOptions.map(machine => (
                          <Checkbox
                            key={machine}
                            label={machineLabels[machine]}
                            checked={inventory.machines[machine]}
                            onCheckedChange={() =>
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
                          />
                        ))}
                      </div>
                    </div>

                    <div className="surface-card-subtle p-5">
                      <div className="border-b border-[var(--color-border)] pb-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Resistance & bodyweight</h3>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-strong">Bands</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(['light', 'medium', 'heavy'] as BandResistance[]).map(level => (
                              <Checkbox
                                key={level}
                                label={bandLabels[level]}
                                checked={inventory.bands.includes(level)}
                                onCheckedChange={() =>
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
                              />
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-strong">Bodyweight</p>
                          <Checkbox
                            label="Bodyweight movements"
                            checked={inventory.bodyweight}
                            onCheckedChange={() =>
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
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {isCardioStyle && (
                  <>
                    <div className="surface-card-subtle p-5">
                      <div className="border-b border-[var(--color-border)] pb-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Cardio equipment</h3>
                      </div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-sm font-semibold text-strong">Machines</p>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {cardioMachineOptions.map(machine => (
                              <Checkbox
                                key={machine}
                                label={machineLabels[machine]}
                                checked={inventory.machines[machine]}
                                onCheckedChange={() =>
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
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="surface-card-muted p-5">
                      <div className="border-b border-[var(--color-border)] pb-3">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Cardio activities</h3>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {CARDIO_ACTIVITY_OPTIONS.map((option) => (
                            <Checkbox
                              key={option.value}
                              label={option.label}
                              checked={formData.preferences.cardioActivities.includes(option.value)}
                              onCheckedChange={() =>
                                updateFormData(prev => ({
                                  ...prev,
                                  preferences: {
                                    ...prev.preferences,
                                    cardioActivities: toggleArrayValue(prev.preferences.cardioActivities, option.value)
                                  }
                                }))
                              }
                            />
                          ))}
                        </div>
                        <p className="text-xs text-subtle">Leave blank to allow any cardio activity.</p>
                      </div>
                    </div>
                  </>
                )}

                {isYogaStyle && (
                  <div className="surface-card-subtle p-5">
                    <div className="border-b border-[var(--color-border)] pb-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Essentials</h3>
                    </div>
                    <div className="mt-4">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-strong">Bodyweight</p>
                        <Checkbox
                          label="Bodyweight movements"
                          checked={inventory.bodyweight}
                          onCheckedChange={() =>
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
                        />
                        <p className="mt-2 text-xs text-subtle">Yoga primarily uses bodyweight. Ensure this is checked.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {invalidEquipment && (
                <p className="text-xs text-[var(--color-danger)]">Choose at least one equipment option.</p>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Step 3</p>
                <h2 className="text-xl font-semibold text-strong">Review & generate</h2>
                <p className="text-sm text-muted">Confirm the highlights before we save your template.</p>
              </div>

              <div className="surface-card-subtle p-4">
                <h3 className="mb-3 text-sm font-semibold text-strong">Selection summary</h3>
                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-subtle">Muscle focus</dt>
                    <dd className="text-strong capitalize">
                      {isYogaStyle ? 'Yoga' : isCardioStyle ? 'Cardio' : formData.intent.bodyParts?.[0]?.replace('_', ' ') ?? 'Not set'}
                    </dd>
                  </div>
                  {!isYogaStyle && !isCardioStyle && (
                    <div>
                      <dt className="text-subtle">Training style</dt>
                      <dd className="text-strong capitalize">{(formData.intent.style ?? formData.goals.primary).replace('_', ' ')}</dd>
                    </div>
                  )}
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
            <h2 className="text-lg font-semibold text-strong">Saved Templates</h2>
            <p className="text-xs text-subtle">Quickly reload a recently saved template.</p>
          </div>
        </div>

        {startSessionError && <p className="mb-3 text-sm text-[var(--color-danger)]">{startSessionError}</p>}
        {historyError && <p className="mb-3 text-sm text-[var(--color-danger)]">{historyError}</p>}

        {historyEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-sm text-muted">
            No saved templates yet. Save a template to start building your history.
          </div>
        ) : (
          <div className="space-y-3">
            {historyEntries.map(entry => {
              const entryTitle = buildWorkoutDisplayName({
                focus: entry.template.focus,
                style: entry.template.style,
                intensity: entry.template.inputs.intensity,
                fallback: entry.title
              })
              return (
              <div
                key={entry.id}
                className="surface-card-muted flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-strong">{entryTitle}</p>
                  <p className="text-xs text-subtle">Saved {new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleHistoryLoad(entry)}
                    className="px-3 py-2 text-xs"
                  >
                    Reload Setup
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      if (!entry.remoteId) return
                      handleStartSession({
                        templateId: entry.remoteId,
                        sessionKey: `${entry.id}-start`
                      })
                    }}
                    className="px-3 py-2 text-xs"
                    disabled={!entry.remoteId || startingSessionKey === `${entry.id}-start`}
                  >
                    {startingSessionKey === `${entry.id}-start` ? 'Starting...' : 'Start Session'}
                  </Button>
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
            )})}
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-subtle">
          Done here? Head back to your workouts or jump into your latest template.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push('/dashboard')}>
            Back to workouts <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!lastSavedTemplate) return
              handleStartSession({ templateId: lastSavedTemplate.templateId, sessionKey: 'latest-start' })
            }}
            disabled={!lastSavedTemplate || startingSessionKey === 'latest-start'}
          >
            {startingSessionKey === 'latest-start' ? 'Starting...' : 'Start latest session'}
          </Button>
        </div>
      </div>
    </div>
    </div>
  )
}
