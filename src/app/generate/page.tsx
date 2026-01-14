'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { CheckCircle2, ChevronLeft, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { generatePlan, normalizePlanInput } from '@/lib/generator'
import { bandLabels, cloneInventory, equipmentPresets, formatWeightList, machineLabels, parseWeightList } from '@/lib/equipment'
import { buildWorkoutHistoryEntry, loadWorkoutHistory, removeWorkoutHistoryEntry, saveWorkoutHistoryEntry } from '@/lib/workoutHistory'
import { formatDayLabel, formatWeekStartDate } from '@/lib/schedule-utils'
import { resolveSavedSessionConflicts } from '@/lib/saved-sessions'
import { getFlowCompletion, isDaysAvailableValid, isEquipmentValid, isMinutesPerSessionValid, isTotalMinutesPerWeekValid } from '@/lib/generationFlow'
import { logEvent } from '@/lib/logger'
import type { BandResistance, EquipmentPreset, Goal, MachineType, PlanInput, GeneratedPlan } from '@/types/domain'

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type StepId = 'goal' | 'duration' | 'equipment' | 'preferences' | 'review'

export default function GeneratePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Record<StepId, boolean>>({
    goal: false,
    duration: false,
    equipment: false,
    preferences: false,
    review: false
  })
  const [errors, setErrors] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSummary, setSaveSummary] = useState<{
    createdDays: number[]
    conflicts: Array<{ dayOfWeek: number; sessionId: string; sessionName: string; updatedAt: string | null }>
    workoutId?: string
  } | null>(null)
  const [lastGeneratedPlan, setLastGeneratedPlan] = useState<GeneratedPlan | null>(null)
  const [isReplacing, setIsReplacing] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<ReturnType<typeof loadWorkoutHistory>>([])
  const [deletingHistoryIds, setDeletingHistoryIds] = useState<Record<string, boolean>>({})
  const [activeStep, setActiveStep] = useState<StepId>('goal')

  const [formData, setFormData] = useState<PlanInput>(() =>
    normalizePlanInput({
      goals: { primary: 'strength', priority: 'primary' },
      experienceLevel: 'intermediate',
      intensity: 'moderate',
      equipment: { preset: 'full_gym', inventory: cloneInventory(equipmentPresets.full_gym) },
      time: { minutesPerSession: 45 },
      schedule: { daysAvailable: [1, 3, 5], timeWindows: ['evening'], minRestDays: 1 },
      preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
    })
  )

  const flowState = useMemo(() => getFlowCompletion(formData), [formData])

  const stepAvailability: Record<StepId, boolean> = {
    goal: true,
    duration: flowState.goalStepComplete,
    equipment: flowState.durationStepComplete,
    preferences: flowState.equipmentStepComplete,
    review: flowState.preferencesStepComplete
  }

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
    updateFormData(() => normalizePlanInput(entry.plan.inputs))
    setCompletedSteps({
      goal: true,
      duration: true,
      equipment: true,
      preferences: true,
      review: true
    })
    setActiveStep('review')
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
          throw error
        }
      }

      if (typeof window !== 'undefined') {
        removeWorkoutHistoryEntry(entry.id, window.localStorage)
      }
      setHistoryEntries((prev) => prev.filter(item => item.id !== entry.id))
    } catch (error) {
      console.error('Failed to delete workout history entry', error)
      setHistoryError('Unable to delete saved workout. Please try again.')
    } finally {
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
    setLastGeneratedPlan(plan)

    let historyEntry: ReturnType<typeof buildWorkoutHistoryEntry> | null = null
    if (typeof window !== 'undefined') {
      try {
        historyEntry = buildWorkoutHistoryEntry(plan)
        saveWorkoutHistoryEntry(historyEntry, window.localStorage)
        setHistoryEntries((prev) => [historyEntry!, ...prev.filter(item => item.id !== historyEntry!.id)])
      } catch (error) {
        console.error('Failed to store workout history', error)
        setHistoryError('Unable to save workout history locally.')
      }
    }

    const newPlan = {
      user_id: user.id,
      title: plan.title,
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

    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert([newPlan])
        .select()
        .single()

      if (error) {
        const hint = getSavePlanHint(error)
        console.error('Failed to save plan', { error, hint })
        setSaveError(`Failed to generate plan: ${error.message}${hint ? ` ${hint}` : ''}`)
        return
      }

      if (data) {
        if (typeof window !== 'undefined') {
          const entry = historyEntry ? { ...historyEntry, remoteId: data.id } : buildWorkoutHistoryEntry(plan, data.id)
          saveWorkoutHistoryEntry(entry, window.localStorage)
          setHistoryEntries((prev) => [entry, ...prev.filter(item => item.id !== entry.id)])
        }
        const weekStartDate = formatWeekStartDate(new Date())
        const scheduleBatchId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${user.id}`
        const scheduleRows = plan.schedule.map((day, index) => ({
          user_id: user.id,
          workout_id: data.id,
          schedule_batch_id: scheduleBatchId,
          day_of_week: day.dayOfWeek,
          week_start_date: weekStartDate,
          order_index: index,
          is_active: true
        }))

        const { error: deactivateError } = await supabase
          .from('scheduled_sessions')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('week_start_date', weekStartDate)
          .eq('is_active', true)

        if (deactivateError) {
          console.error('Failed to deactivate prior schedules', deactivateError)
        }

        const { error: scheduleError } = await supabase
          .from('scheduled_sessions')
          .insert(scheduleRows)

        if (scheduleError) {
          console.error('Failed to create schedule sessions', scheduleError)
          setSaveError(`Plan generated, but scheduling failed: ${scheduleError.message}`)
          return
        }

        const selectedDays = plan.schedule.map(day => day.dayOfWeek)
        const { data: existingSessions, error: existingError } = await supabase
          .from('saved_sessions')
          .select('id, day_of_week, session_name, updated_at')
          .eq('user_id', user.id)
          .in('day_of_week', selectedDays)

        if (existingError) {
          console.error('Failed to check saved sessions', existingError)
          setSaveError(`Plan generated, but saving sessions failed: ${existingError.message}`)
          return
        }

        const { conflicts, availableDays } = resolveSavedSessionConflicts(selectedDays, existingSessions ?? [])
        const createdDays = [...availableDays]

        if (availableDays.length > 0) {
          const sessionRows = plan.schedule
            .filter(day => availableDays.includes(day.dayOfWeek))
            .map(day => ({
              user_id: user.id,
              workout_id: data.id,
              day_of_week: day.dayOfWeek,
              session_name: `${plan.title} · ${formatDayLabel(day.dayOfWeek)}`,
              workouts: day.exercises,
              updated_at: new Date().toISOString()
            }))

          const { error: sessionSaveError } = await supabase
            .from('saved_sessions')
            .insert(sessionRows)

          if (sessionSaveError) {
            console.error('Failed to create saved sessions', sessionSaveError)
            setSaveError(`Plan generated, but day sessions failed to save: ${sessionSaveError.message}`)
            return
          }
        }

        setSaveSummary({
          createdDays,
          conflicts,
          workoutId: data.id
        })
      } else {
        console.error('Failed to save plan', { error: 'No data returned from insert.' })
        setSaveError('Failed to generate plan. No data returned from insert.')
      }
    } catch (err) {
      console.error('Failed to save plan', err)
      setSaveError('Failed to generate plan. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const renderStepStatus = (stepComplete: boolean, stepAvailable: boolean) => {
    if (stepComplete) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Complete
        </span>
      )
    }

    if (!stepAvailable) {
      return <span className="text-xs font-semibold text-subtle">Locked</span>
    }

    return <span className="text-xs font-semibold text-muted">In Progress</span>
  }

  const daysAvailableLabel = formData.schedule.daysAvailable
    .map(index => dayLabels[index])
    .filter(Boolean)
    .join(', ')

  const invalidMinutes = !isMinutesPerSessionValid(formData.time.minutesPerSession)
  const invalidTotalMinutes = !isTotalMinutesPerWeekValid(formData.time.totalMinutesPerWeek)
  const invalidDays = !isDaysAvailableValid(formData.schedule.daysAvailable)
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

  const handleReplaceConflicts = async () => {
    if (!user || !saveSummary || !lastGeneratedPlan) return
    const conflictDays = saveSummary.conflicts.map((conflict) => conflict.dayOfWeek)
    if (conflictDays.length === 0) return
    if (!confirm('Delete the existing sessions for these days and replace them with the new plan?')) return

    setIsReplacing(true)
    setSaveError(null)

    try {
      const { error: deleteError } = await supabase
        .from('saved_sessions')
        .delete()
        .eq('user_id', user.id)
        .in('day_of_week', conflictDays)

      if (deleteError) {
        throw deleteError
      }

      const replacementRows = lastGeneratedPlan.schedule
        .filter((day) => conflictDays.includes(day.dayOfWeek))
        .map((day) => ({
          user_id: user.id,
          workout_id: saveSummary.workoutId ?? null,
          day_of_week: day.dayOfWeek,
          session_name: `${lastGeneratedPlan.title} · ${formatDayLabel(day.dayOfWeek)}`,
          workouts: day.exercises,
          updated_at: new Date().toISOString()
        }))

      if (replacementRows.length > 0) {
        const { error: insertError } = await supabase
          .from('saved_sessions')
          .insert(replacementRows)

        if (insertError) {
          throw insertError
        }
      }

      setSaveSummary({
        ...saveSummary,
        createdDays: Array.from(new Set([...saveSummary.createdDays, ...conflictDays])),
        conflicts: []
      })
    } catch (error) {
      console.error('Failed to replace saved sessions', error)
      setSaveError('Unable to replace the existing sessions. Please try again.')
    } finally {
      setIsReplacing(false)
    }
  }

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
      const createdLabels = saveSummary.createdDays.map((day) => formatDayLabel(day)).join(', ')
      const conflictLabels = saveSummary.conflicts.map((conflict) => formatDayLabel(conflict.dayOfWeek)).join(', ')

      return (
        <div className="space-y-3 text-sm text-muted">
          {saveSummary.createdDays.length > 0 && (
            <div className="rounded-lg border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 py-2 text-[var(--color-primary-strong)]">
              Saved sessions for: {createdLabels}
            </div>
          )}
          {saveSummary.conflicts.length > 0 && (
            <div className="space-y-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2">
              <p className="text-xs text-[var(--color-danger)]">
                You already have a session saved for {conflictLabels}. Remove it or choose different days.
              </p>
              <ul className="space-y-1 text-xs text-subtle">
                {saveSummary.conflicts.map((conflict) => (
                  <li key={conflict.sessionId}>
                    {formatDayLabel(conflict.dayOfWeek)} · {conflict.sessionName} · Updated{' '}
                    {conflict.updatedAt ? new Date(conflict.updatedAt).toLocaleDateString() : 'recently'}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => router.push('/dashboard')}>
                  View existing session
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setActiveStep('duration')
                  }}
                >
                  Choose different days
                </Button>
                <Button
                  type="button"
                  onClick={handleReplaceConflicts}
                  disabled={isReplacing}
                >
                  {isReplacing ? 'Replacing...' : 'Delete & replace existing'}
                </Button>
              </div>
            </div>
          )}
          {saveSummary.workoutId && (
            <Button type="button" variant="secondary" onClick={() => router.push(`/workout/${saveSummary.workoutId}`)}>
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
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center text-sm text-muted transition-colors hover:text-strong"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <h1 className="flex items-center text-3xl font-semibold text-strong">
          <Wand2 className="mr-3 h-8 w-8 text-accent" />
          Generate Workout Plan
        </h1>
        <p className="mt-2 text-muted">Answer each step to create a plan that matches your goals, schedule, and preferences.</p>
      </div>

      <div className="px-4 pb-10 sm:px-6 lg:px-10 2xl:px-16">
        <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => stepAvailability.goal && setActiveStep('goal')}
              aria-expanded={activeStep === 'goal'}
              aria-controls="step-goal"
              className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left shadow-[var(--shadow-sm)]"
            >
              <div>
                <p className="text-sm font-semibold text-strong">Goal & Workout Type</p>
                <p className="text-xs text-subtle">Define your primary outcome and training background.</p>
              </div>
              {renderStepStatus(completedSteps.goal && flowState.goalStepComplete, stepAvailability.goal)}
            </button>
            {activeStep === 'goal' && (
              <div id="step-goal" className="surface-card-muted space-y-4 p-4">
                <div>
                  <label className="mb-3 block text-sm font-medium text-strong">Primary Goal</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['strength', 'hypertrophy', 'endurance', 'general_fitness'] as Goal[]).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          updateFormData(prev => ({
                            ...prev,
                            goals: { ...prev.goals, primary: opt }
                          }))
                        }
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
                          formData.goals.primary === opt
                            ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-muted hover:border-[var(--color-border-strong)]'
                        }`}
                        aria-pressed={formData.goals.primary === opt}
                      >
                        {opt.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-strong">Experience Level</label>
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

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setCompletedSteps(prev => ({ ...prev, goal: true }))
                      setActiveStep('duration')
                    }}
                    disabled={!flowState.goalStepComplete}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => stepAvailability.duration && setActiveStep('duration')}
              disabled={!stepAvailability.duration}
              aria-expanded={activeStep === 'duration'}
              aria-controls="step-duration"
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.duration
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-strong">Duration & Intensity</p>
                <p className="text-xs text-subtle">Choose session length, intensity, and days available.</p>
              </div>
              {renderStepStatus(completedSteps.duration && flowState.durationStepComplete, stepAvailability.duration)}
            </button>
            {activeStep === 'duration' && (
              <div id="step-duration" className="surface-card-muted space-y-4 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Minutes per Session</label>
                    <input
                      type="number"
                      min={20}
                      max={120}
                      value={formData.time.minutesPerSession}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          time: { ...prev.time, minutesPerSession: Number(e.target.value) }
                        }))
                      }
                      className="input-base"
                    />
                    {invalidMinutes && (
                      <p className="mt-2 text-xs text-[var(--color-danger)]">Enter 20 to 120 minutes per session.</p>
                    )}
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Total Minutes per Week (Optional)</label>
                    <input
                      type="number"
                      min={40}
                      max={480}
                      value={formData.time.totalMinutesPerWeek ?? ''}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          time: {
                            ...prev.time,
                            totalMinutesPerWeek: e.target.value ? Number(e.target.value) : undefined
                          }
                        }))
                      }
                      placeholder="e.g. 180"
                      className="input-base"
                    />
                    {invalidTotalMinutes && (
                      <p className="mt-2 text-xs text-[var(--color-danger)]">Keep totals between 40 and 480 minutes.</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Days Available</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {dayLabels.map((label, index) => (
                        <label key={label} className="flex items-center gap-2 text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={formData.schedule.daysAvailable.includes(index)}
                            onChange={() =>
                              updateFormData(prev => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  daysAvailable: toggleArrayValue(prev.schedule.daysAvailable, index)
                                }
                              }))
                            }
                            className="accent-[var(--color-primary)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {invalidDays && (
                      <p className="mt-2 text-xs text-[var(--color-danger)]">Select at least one training day.</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setCompletedSteps(prev => ({ ...prev, duration: true }))
                      setActiveStep('equipment')
                    }}
                    disabled={!flowState.durationStepComplete}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => stepAvailability.equipment && setActiveStep('equipment')}
              disabled={!stepAvailability.equipment}
              aria-expanded={activeStep === 'equipment'}
              aria-controls="step-equipment"
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.equipment
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-strong">Equipment</p>
                <p className="text-xs text-subtle">Select what you have available.</p>
              </div>
              {renderStepStatus(completedSteps.equipment && flowState.equipmentStepComplete, stepAvailability.equipment)}
            </button>
            {activeStep === 'equipment' && (
              <div id="step-equipment" className="surface-card-muted space-y-4 p-4">
                <div>
                  <label className="mb-3 block text-sm font-medium text-strong">Equipment Preset</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      { key: 'home_minimal', label: 'Home Minimal' },
                      { key: 'full_gym', label: 'Full Gym' },
                      { key: 'hotel', label: 'Hotel' },
                      { key: 'custom', label: 'Custom' }
                    ] as { key: EquipmentPreset | 'custom'; label: string }[]).map(preset => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handlePresetChange(preset.key)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Dumbbell Weights (lb)</label>
                    <input
                      type="text"
                      value={formatWeightList(inventory.dumbbells)}
                      onChange={(e) => setInventoryWeights('dumbbells', e.target.value)}
                      placeholder="e.g. 10, 15, 20"
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Kettlebell Weights (lb)</label>
                    <input
                      type="text"
                      value={formatWeightList(inventory.kettlebells)}
                      onChange={(e) => setInventoryWeights('kettlebells', e.target.value)}
                      placeholder="e.g. 20, 35"
                      className="input-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Bands (Resistance Levels)</label>
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
                    <label className="mb-2 block text-sm font-medium text-strong">Barbell + Plates</label>
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
                  <label className="mb-2 block text-sm font-medium text-strong">Machine Availability</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setCompletedSteps(prev => ({ ...prev, equipment: true }))
                      setActiveStep('preferences')
                    }}
                    disabled={!flowState.equipmentStepComplete}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => stepAvailability.preferences && setActiveStep('preferences')}
              disabled={!stepAvailability.preferences}
              aria-expanded={activeStep === 'preferences'}
              aria-controls="step-preferences"
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.preferences
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-strong">Preferences & Constraints</p>
                <p className="text-xs text-subtle">Fine-tune focus areas and recovery details.</p>
              </div>
              {renderStepStatus(completedSteps.preferences && flowState.preferencesStepComplete, stepAvailability.preferences)}
            </button>
            {activeStep === 'preferences' && (
              <div id="step-preferences" className="surface-card-muted space-y-4 p-4">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Secondary Goal</label>
                    <select
                      value={formData.goals.secondary ?? ''}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          goals: { ...prev.goals, secondary: e.target.value ? (e.target.value as Goal) : undefined }
                        }))
                      }
                      className="input-base"
                    >
                      <option value="">None</option>
                      <option value="strength">Strength</option>
                      <option value="hypertrophy">Hypertrophy</option>
                      <option value="endurance">Endurance</option>
                      <option value="general_fitness">General Fitness</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Goal Priority</label>
                    <select
                      value={formData.goals.priority}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          goals: { ...prev.goals, priority: e.target.value as PlanInput['goals']['priority'] }
                        }))
                      }
                      className="input-base"
                    >
                      <option value="primary">Primary Only</option>
                      <option value="balanced">Balanced</option>
                      <option value="secondary">Bias Toward Secondary</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Time Windows</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(['morning', 'afternoon', 'evening'] as PlanInput['schedule']['timeWindows']).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={formData.schedule.timeWindows.includes(opt)}
                            onChange={() =>
                              updateFormData(prev => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  timeWindows: toggleArrayValue(prev.schedule.timeWindows, opt)
                                }
                              }))
                            }
                            className="accent-[var(--color-primary)]"
                          />
                          {opt.replace(/\b\w/g, char => char.toUpperCase())}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-strong">Minimum Rest Days</label>
                      <input
                        type="number"
                        min={0}
                        max={2}
                        value={formData.schedule.minRestDays}
                        onChange={(e) =>
                          updateFormData(prev => ({
                            ...prev,
                            schedule: { ...prev.schedule, minRestDays: Number(e.target.value) }
                          }))
                        }
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-strong">Recovery Preference</label>
                      <select
                        value={formData.preferences.restPreference}
                        onChange={(e) =>
                          updateFormData(prev => ({
                            ...prev,
                            preferences: { ...prev.preferences, restPreference: e.target.value as PlanInput['preferences']['restPreference'] }
                          }))
                        }
                        className="input-base"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="high_recovery">High Recovery</option>
                        <option value="minimal_rest">Minimal Rest</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Focus Areas</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(['upper', 'lower', 'full_body', 'core', 'cardio', 'mobility'] as PlanInput['preferences']['focusAreas']).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={formData.preferences.focusAreas.includes(opt)}
                            onChange={() =>
                              updateFormData(prev => ({
                                ...prev,
                                preferences: {
                                  ...prev.preferences,
                                  focusAreas: toggleArrayValue(prev.preferences.focusAreas, opt)
                                }
                              }))
                            }
                            className="accent-[var(--color-primary)]"
                          />
                          {opt.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Disliked Activities</label>
                    <input
                      type="text"
                      value={formData.preferences.dislikedActivities.join(', ')}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          preferences: {
                            ...prev.preferences,
                            dislikedActivities: e.target.value
                              ? e.target.value.split(',').map(item => item.trim()).filter(Boolean)
                              : []
                          }
                        }))
                      }
                      placeholder="e.g. Running, Jumping"
                      className="input-base"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-strong">Accessibility Constraints</label>
                    <div className="flex flex-wrap gap-3">
                      {['low-impact', 'joint-friendly', 'no-floor-work'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={formData.preferences.accessibilityConstraints.includes(opt)}
                            onChange={() =>
                              updateFormData(prev => ({
                                ...prev,
                                preferences: {
                                  ...prev.preferences,
                                  accessibilityConstraints: toggleArrayValue(prev.preferences.accessibilityConstraints, opt)
                                }
                              }))
                            }
                            className="accent-[var(--color-primary)]"
                          />
                          {opt.replace(/\b\w/g, char => char.toUpperCase())}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setCompletedSteps(prev => ({ ...prev, preferences: true }))
                      setActiveStep('review')
                    }}
                    disabled={!flowState.preferencesStepComplete}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => stepAvailability.review && setActiveStep('review')}
              disabled={!stepAvailability.review}
              aria-expanded={activeStep === 'review'}
              aria-controls="step-review"
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.review
                  ? 'border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-strong">Review & Generate</p>
                <p className="text-xs text-subtle">Confirm selections before generating.</p>
              </div>
              {renderStepStatus(completedSteps.review && flowState.reviewStepComplete, stepAvailability.review)}
            </button>
            {activeStep === 'review' && (
              <div id="step-review" className="surface-card-muted space-y-4 p-4">
                <div className="surface-card-subtle p-4">
                  <h3 className="mb-3 text-sm font-semibold text-strong">Selection Summary</h3>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-subtle">Primary Goal</dt>
                      <dd className="text-strong capitalize">{formData.goals.primary.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Experience Level</dt>
                      <dd className="text-strong capitalize">{formData.experienceLevel}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Intensity</dt>
                      <dd className="text-strong capitalize">{formData.intensity}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Minutes per Session</dt>
                      <dd className="text-strong">{formData.time.minutesPerSession} min</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Total Minutes per Week</dt>
                      <dd className="text-strong">{formData.time.totalMinutesPerWeek ?? 'Not set'}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Days Available</dt>
                      <dd className="text-strong">{daysAvailableLabel || 'Not selected'}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Equipment</dt>
                      <dd className="text-strong">{equipmentSummary.length ? equipmentSummary.join(', ') : 'Not set'}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Secondary Goal</dt>
                      <dd className="text-strong">{formData.goals.secondary?.replace('_', ' ') ?? 'None'}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Goal Priority</dt>
                      <dd className="text-strong capitalize">{formData.goals.priority.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Time Windows</dt>
                      <dd className="text-strong">
                        {formData.schedule.timeWindows.length
                          ? formData.schedule.timeWindows.map(item => item.replace('_', ' ')).join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Minimum Rest Days</dt>
                      <dd className="text-strong">{formData.schedule.minRestDays}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Recovery Preference</dt>
                      <dd className="text-strong capitalize">{formData.preferences.restPreference.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Focus Areas</dt>
                      <dd className="text-strong">
                        {formData.preferences.focusAreas.length
                          ? formData.preferences.focusAreas.map(item => item.replace('_', ' ')).join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Disliked Activities</dt>
                      <dd className="text-strong">
                        {formData.preferences.dislikedActivities.length
                          ? formData.preferences.dislikedActivities.join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Accessibility Constraints</dt>
                      <dd className="text-strong">
                        {formData.preferences.accessibilityConstraints.length
                          ? formData.preferences.accessibilityConstraints.join(', ')
                          : 'Not set'}
                      </dd>
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
                    setCompletedSteps(prev => ({ ...prev, review: true }))
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
              </div>
            )}
          </div>
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
                    {entry.plan.summary.sessionsPerWeek} sessions · {entry.plan.summary.totalMinutes} min · Focus on{' '}
                    {entry.plan.goal.replace('_', ' ')}
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
                      onClick={() => router.push(`/workout/${entry.remoteId}`)}
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
