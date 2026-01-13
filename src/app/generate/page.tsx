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
import { buildWorkoutHistoryEntry, loadWorkoutHistory, saveWorkoutHistoryEntry } from '@/lib/workoutHistory'
import { getFlowCompletion, isDaysAvailableValid, isEquipmentValid, isMinutesPerSessionValid, isTotalMinutesPerWeekValid } from '@/lib/generationFlow'
import { logEvent } from '@/lib/logger'
import type { BandResistance, EquipmentPreset, Goal, MachineType, PlanInput } from '@/types/domain'

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
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<ReturnType<typeof loadWorkoutHistory>>([])
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
    logEvent('info', 'plan_generated', {
      userId: user.id,
      sessionsPerWeek: plan.summary.sessionsPerWeek,
      totalMinutes: plan.summary.totalMinutes,
      goals: plan.inputs.goals,
      equipment: plan.inputs.equipment
    })

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
        router.push(`/workout/${data.id}`)
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
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Complete
        </span>
      )
    }

    if (!stepAvailable) {
      return <span className="text-xs font-semibold text-slate-500">Locked</span>
    }

    return <span className="text-xs font-semibold text-slate-400">In Progress</span>
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

  const statusContent = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-emerald-200">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Generating your workout plan...
        </div>
      )
    }

    if (saveError) {
      return <div className="text-sm text-rose-200">{saveError}</div>
    }

    if (errors.length > 0) {
      return (
        <div className="text-sm text-rose-200">
          Review the items below and resolve them before generating your plan.
        </div>
      )
    }

    if (!flowState.isFormValid) {
      return <div className="text-sm text-slate-400">Complete the required steps to unlock generation.</div>
    }

    return <div className="text-sm text-slate-300">Everything looks good. Generate your plan when ready.</div>
  }

  if (userLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-slate-400 hover:text-white flex items-center text-sm mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Wand2 className="w-8 h-8 mr-3 text-emerald-500" />
          Generate Workout Plan
        </h1>
        <p className="text-slate-400 mt-2">Answer each step to create a plan that matches your goals, schedule, and preferences.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => stepAvailability.goal && setActiveStep('goal')}
              aria-expanded={activeStep === 'goal'}
              aria-controls="step-goal"
              className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-white">Goal & Workout Type</p>
                <p className="text-xs text-slate-400">Define your primary outcome and training background.</p>
              </div>
              {renderStepStatus(completedSteps.goal && flowState.goalStepComplete, stepAvailability.goal)}
            </button>
            {activeStep === 'goal' && (
              <div id="step-goal" className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Primary Goal</label>
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
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                        aria-pressed={formData.goals.primary === opt}
                      >
                        {opt.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Experience Level</label>
                  <select
                    value={formData.experienceLevel}
                    onChange={(e) =>
                      updateFormData(prev => ({
                        ...prev,
                        experienceLevel: e.target.value as PlanInput['experienceLevel']
                      }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
              className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.duration ? 'border-slate-800 bg-slate-950/60' : 'border-slate-900 bg-slate-950/20'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-white">Duration & Intensity</p>
                <p className="text-xs text-slate-400">Choose session length, intensity, and days available.</p>
              </div>
              {renderStepStatus(completedSteps.duration && flowState.durationStepComplete, stepAvailability.duration)}
            </button>
            {activeStep === 'duration' && (
              <div id="step-duration" className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Minutes per Session</label>
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    {invalidMinutes && (
                      <p className="mt-2 text-xs text-rose-200">Enter 20 to 120 minutes per session.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Intensity</label>
                    <select
                      value={formData.intensity}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          intensity: e.target.value as PlanInput['intensity']
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Total Minutes per Week (Optional)</label>
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    {invalidTotalMinutes && (
                      <p className="mt-2 text-xs text-rose-200">Keep totals between 40 and 480 minutes.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Days Available</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {dayLabels.map((label, index) => (
                        <label key={label} className="flex items-center gap-2 text-sm text-slate-300">
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
                            className="accent-emerald-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {invalidDays && (
                      <p className="mt-2 text-xs text-rose-200">Select at least one training day.</p>
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
              className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.equipment ? 'border-slate-800 bg-slate-950/60' : 'border-slate-900 bg-slate-950/20'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-white">Equipment</p>
                <p className="text-xs text-slate-400">Select what you have available.</p>
              </div>
              {renderStepStatus(completedSteps.equipment && flowState.equipmentStepComplete, stepAvailability.equipment)}
            </button>
            {activeStep === 'equipment' && (
              <div id="step-equipment" className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Equipment Preset</label>
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
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">Dumbbell Weights (lb)</label>
                    <input
                      type="text"
                      value={formatWeightList(inventory.dumbbells)}
                      onChange={(e) => setInventoryWeights('dumbbells', e.target.value)}
                      placeholder="e.g. 10, 15, 20"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Kettlebell Weights (lb)</label>
                    <input
                      type="text"
                      value={formatWeightList(inventory.kettlebells)}
                      onChange={(e) => setInventoryWeights('kettlebells', e.target.value)}
                      placeholder="e.g. 20, 35"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Bands (Resistance Levels)</label>
                    <div className="flex flex-wrap gap-3">
                      {(['light', 'medium', 'heavy'] as BandResistance[]).map(level => (
                        <label key={level} className="flex items-center gap-2 text-sm text-slate-300">
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
                            className="accent-emerald-500"
                          />
                          {bandLabels[level]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Barbell + Plates</label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
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
                        className="accent-emerald-500"
                      />
                      Barbell available
                    </label>
                    <input
                      type="text"
                      value={formatWeightList(inventory.barbell.plates)}
                      onChange={(e) => setInventoryWeights('plates', e.target.value)}
                      placeholder="e.g. 10, 25, 45"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      disabled={!inventory.barbell.available}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Machine Availability</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.keys(machineLabels) as MachineType[]).map(machine => (
                      <label key={machine} className="flex items-center gap-2 text-sm text-slate-300">
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
                          className="accent-emerald-500"
                        />
                        {machineLabels[machine]}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-300">
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
                    className="accent-emerald-500"
                  />
                  Bodyweight movements available
                </label>

                {invalidEquipment && (
                  <p className="text-xs text-rose-200">Choose at least one equipment option.</p>
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
              className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.preferences ? 'border-slate-800 bg-slate-950/60' : 'border-slate-900 bg-slate-950/20'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-white">Preferences & Constraints</p>
                <p className="text-xs text-slate-400">Fine-tune focus areas and recovery details.</p>
              </div>
              {renderStepStatus(completedSteps.preferences && flowState.preferencesStepComplete, stepAvailability.preferences)}
            </button>
            {activeStep === 'preferences' && (
              <div id="step-preferences" className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Secondary Goal</label>
                    <select
                      value={formData.goals.secondary ?? ''}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          goals: { ...prev.goals, secondary: e.target.value ? (e.target.value as Goal) : undefined }
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">None</option>
                      <option value="strength">Strength</option>
                      <option value="hypertrophy">Hypertrophy</option>
                      <option value="endurance">Endurance</option>
                      <option value="general_fitness">General Fitness</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Goal Priority</label>
                    <select
                      value={formData.goals.priority}
                      onChange={(e) =>
                        updateFormData(prev => ({
                          ...prev,
                          goals: { ...prev.goals, priority: e.target.value as PlanInput['goals']['priority'] }
                        }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="primary">Primary Only</option>
                      <option value="balanced">Balanced</option>
                      <option value="secondary">Bias Toward Secondary</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Time Windows</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(['morning', 'afternoon', 'evening'] as PlanInput['schedule']['timeWindows']).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
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
                            className="accent-emerald-500"
                          />
                          {opt.replace(/\b\w/g, char => char.toUpperCase())}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Minimum Rest Days</label>
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
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Recovery Preference</label>
                      <select
                        value={formData.preferences.restPreference}
                        onChange={(e) =>
                          updateFormData(prev => ({
                            ...prev,
                            preferences: { ...prev.preferences, restPreference: e.target.value as PlanInput['preferences']['restPreference'] }
                          }))
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="high_recovery">High Recovery</option>
                        <option value="minimal_rest">Minimal Rest</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Focus Areas</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(['upper', 'lower', 'full_body', 'core', 'cardio', 'mobility'] as PlanInput['preferences']['focusAreas']).map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
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
                            className="accent-emerald-500"
                          />
                          {opt.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Disliked Activities</label>
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Accessibility Constraints</label>
                    <div className="flex flex-wrap gap-3">
                      {['low-impact', 'joint-friendly', 'no-floor-work'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
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
                            className="accent-emerald-500"
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
              className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left ${
                stepAvailability.review ? 'border-slate-800 bg-slate-950/60' : 'border-slate-900 bg-slate-950/20'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-white">Review & Generate</p>
                <p className="text-xs text-slate-400">Confirm selections before generating.</p>
              </div>
              {renderStepStatus(completedSteps.review && flowState.reviewStepComplete, stepAvailability.review)}
            </button>
            {activeStep === 'review' && (
              <div id="step-review" className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Selection Summary</h3>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-400">Primary Goal</dt>
                      <dd className="text-white capitalize">{formData.goals.primary.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Experience Level</dt>
                      <dd className="text-white capitalize">{formData.experienceLevel}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Intensity</dt>
                      <dd className="text-white capitalize">{formData.intensity}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Minutes per Session</dt>
                      <dd className="text-white">{formData.time.minutesPerSession} min</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Total Minutes per Week</dt>
                      <dd className="text-white">{formData.time.totalMinutesPerWeek ?? 'Not set'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Days Available</dt>
                      <dd className="text-white">{daysAvailableLabel || 'Not selected'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Equipment</dt>
                      <dd className="text-white">{equipmentSummary.length ? equipmentSummary.join(', ') : 'Not set'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Secondary Goal</dt>
                      <dd className="text-white">{formData.goals.secondary?.replace('_', ' ') ?? 'None'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Goal Priority</dt>
                      <dd className="text-white capitalize">{formData.goals.priority.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Time Windows</dt>
                      <dd className="text-white">
                        {formData.schedule.timeWindows.length
                          ? formData.schedule.timeWindows.map(item => item.replace('_', ' ')).join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Minimum Rest Days</dt>
                      <dd className="text-white">{formData.schedule.minRestDays}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Recovery Preference</dt>
                      <dd className="text-white capitalize">{formData.preferences.restPreference.replace('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Focus Areas</dt>
                      <dd className="text-white">
                        {formData.preferences.focusAreas.length
                          ? formData.preferences.focusAreas.map(item => item.replace('_', ' ')).join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Disliked Activities</dt>
                      <dd className="text-white">
                        {formData.preferences.dislikedActivities.length
                          ? formData.preferences.dislikedActivities.join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Accessibility Constraints</dt>
                      <dd className="text-white">
                        {formData.preferences.accessibilityConstraints.length
                          ? formData.preferences.accessibilityConstraints.join(', ')
                          : 'Not set'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4" aria-live="polite">
                  {statusContent()}
                  {errors.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-rose-200">
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

      <Card className="bg-slate-900 border-slate-800 p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Saved Workouts</h2>
            <p className="text-xs text-slate-400">Quickly reload or open a recently generated plan.</p>
          </div>
        </div>

        {historyError && <p className="text-sm text-rose-200 mb-3">{historyError}</p>}

        {historyEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            No saved workouts yet. Generate a plan to start building your history.
          </div>
        ) : (
          <div className="space-y-3">
            {historyEntries.map(entry => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{entry.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(entry.createdAt).toLocaleString()} · Score {entry.plan.summary.impact.score}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
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
                      className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600"
                    >
                      Quick View
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
