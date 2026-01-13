'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Wand2, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { generatePlan, normalizePlanInput } from '@/lib/generator'
import { logEvent } from '@/lib/logger'
import { readHistory, saveHistoryItem } from '@/lib/history'
import type { Goal, MachineType, PlanInput, EquipmentInventory } from '@/types/domain'

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const machineOptions: { key: MachineType; label: string }[] = [
  { key: 'bench', label: 'Bench' },
  { key: 'lat_pulldown', label: 'Lat Pulldown' },
  { key: 'cable', label: 'Cable Stack' },
  { key: 'assault_bike', label: 'Assault Bike' },
  { key: 'leg_press', label: 'Leg Press' }
]

const emptyMachines: Record<MachineType, boolean> = {
  bench: false,
  lat_pulldown: false,
  cable: false,
  assault_bike: false,
  leg_press: false
}

const equipmentPresets: Record<string, { label: string; value: EquipmentInventory }> = {
  home_minimal: {
    label: 'Home Minimal',
    value: {
      bodyweight: true,
      dumbbells: [15, 25],
      kettlebells: [],
      bands: ['light'],
      barbell: { available: false, barWeight: 45, plates: [] },
      machines: { ...emptyMachines }
    }
  },
  full_gym: {
    label: 'Full Gym',
    value: {
      bodyweight: true,
      dumbbells: [10, 20, 30, 40, 50],
      kettlebells: [18, 24, 32],
      bands: ['light', 'medium', 'heavy'],
      barbell: { available: true, barWeight: 45, plates: [45, 45, 25, 25, 10, 10, 5, 5] },
      machines: {
        bench: true,
        lat_pulldown: true,
        cable: true,
        assault_bike: true,
        leg_press: true
      }
    }
  },
  hotel: {
    label: 'Hotel',
    value: {
      bodyweight: true,
      dumbbells: [15, 25],
      kettlebells: [],
      bands: [],
      barbell: { available: false, barWeight: 45, plates: [] },
      machines: { ...emptyMachines }
    }
  }
}

const parseNumberList = (value: string) =>
  value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(item => !Number.isNaN(item) && item > 0)

const parseStringList = (value: string) =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

export default function GeneratePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [history, setHistory] = useState<ReturnType<typeof readHistory>>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)

  const [formData, setFormData] = useState<PlanInput>(() =>
    normalizePlanInput({
      goals: { primary: 'strength', priority: 'primary' },
      experienceLevel: 'intermediate',
      intensity: 'moderate',
      equipment: equipmentPresets.full_gym.value,
      time: { minutesPerSession: 45 },
      schedule: { daysAvailable: [1, 3, 5], timeWindows: ['evening'], minRestDays: 1 },
      preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
    })
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setHistory(readHistory(window.localStorage))
    } catch (error) {
      console.error('Failed to load history', error)
      setHistoryError('Unable to load saved workouts. Check browser storage settings.')
    }
  }, [])

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

  const updateEquipment = (updates: Partial<EquipmentInventory>) => {
    setFormData(prev => ({
      ...prev,
      equipment: {
        ...prev.equipment,
        ...updates
      }
    }))
  }

  const updateMachineToggle = (machine: MachineType) => {
    setFormData(prev => ({
      ...prev,
      equipment: {
        ...prev.equipment,
        machines: {
          ...prev.equipment.machines,
          [machine]: !prev.equipment.machines[machine]
        }
      }
    }))
  }

  const applyPreset = (preset: keyof typeof equipmentPresets) => {
    setFormData(prev => ({
      ...prev,
      equipment: equipmentPresets[preset].value
    }))
  }

  const saveToHistory = (plan: NonNullable<ReturnType<typeof generatePlan>['plan']>) => {
    if (typeof window === 'undefined') return
    try {
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`
      const next = saveHistoryItem(window.localStorage, {
        id,
        createdAt: new Date().toISOString(),
        title: plan.title,
        description: plan.description,
        plan
      })
      setHistory(next)
      setHistoryError(null)
    } catch (error) {
      console.error('Failed to save history', error)
      setHistoryError('Unable to save workout history. Check browser storage settings.')
    }
  }


  const generatePlanHandler = async () => {
    if (!user) return
    setLoading(true)

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
    saveToHistory(plan)
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
        alert(`Failed to generate plan: ${error.message}${hint ? `\n\n${hint}` : ''}`)
        return
      }

      if (data) {
        router.push(`/workout/${data.id}`)
      } else {
        console.error('Failed to save plan', { error: 'No data returned from insert.' })
        alert('Failed to generate plan. No data returned from insert.')
      }
    } catch (err) {
      console.error('Failed to save plan', err)
      alert('Failed to generate plan. Check console.')
    } finally {
      setLoading(false)
    }
  }

  if (userLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center text-sm mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Wand2 className="w-8 h-8 mr-3 text-emerald-500" />
          Generate New Protocol
        </h1>
        <p className="text-slate-400 mt-2">Customize constraints and preferences before we generate your plan.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="space-y-6">
          {errors.length > 0 && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              <p className="font-semibold">Please fix the following:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.map(error => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Primary Goal</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['strength', 'hypertrophy', 'endurance', 'general_fitness'] as Goal[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setFormData({ ...formData, goals: { ...formData.goals, primary: opt } })}
                  className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
                    formData.goals.primary === opt
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {opt.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Experience Level</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as PlanInput['experienceLevel'] })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Intensity</label>
              <select
                value={formData.intensity}
                onChange={(e) => setFormData({ ...formData, intensity: e.target.value as PlanInput['intensity'] })}
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
              <label className="block text-sm font-medium text-slate-300 mb-3">Minutes per Session</label>
              <input
                type="number"
                min={20}
                max={120}
                value={formData.time.minutesPerSession}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    time: { ...formData.time, minutesPerSession: Number(e.target.value) }
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">Total Minutes per Week (optional)</label>
              <input
                type="number"
                min={40}
                max={480}
                value={formData.time.totalMinutesPerWeek ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    time: { ...formData.time, totalMinutesPerWeek: e.target.value ? Number(e.target.value) : undefined }
                  })
                }
                placeholder="e.g. 180"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Days Available</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dayLabels.map((label, index) => (
                <label key={label} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.schedule.daysAvailable.includes(index)}
                    onChange={() =>
                      setFormData({
                        ...formData,
                        schedule: {
                          ...formData.schedule,
                          daysAvailable: toggleArrayValue(formData.schedule.daysAvailable, index)
                        }
                      })
                    }
                    className="accent-emerald-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">Equipment</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(equipmentPresets).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key as keyof typeof equipmentPresets)}
                  className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs text-emerald-300 hover:border-emerald-400 hover:text-emerald-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-slate-800 p-4 space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={formData.equipment.bodyweight}
                  onChange={() => updateEquipment({ bodyweight: !formData.equipment.bodyweight })}
                  className="accent-emerald-500"
                />
                Bodyweight only is available
              </label>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.equipment.dumbbells.length > 0}
                    onChange={() =>
                      updateEquipment({ dumbbells: formData.equipment.dumbbells.length > 0 ? [] : [15, 25] })
                    }
                    className="accent-emerald-500"
                  />
                  Dumbbell weights (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.equipment.dumbbells.join(', ')}
                  onChange={(e) => updateEquipment({ dumbbells: parseNumberList(e.target.value) })}
                  placeholder="e.g. 10, 15, 25, 35"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.equipment.kettlebells.length > 0}
                    onChange={() =>
                      updateEquipment({ kettlebells: formData.equipment.kettlebells.length > 0 ? [] : [18] })
                    }
                    className="accent-emerald-500"
                  />
                  Kettlebell weights (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.equipment.kettlebells.join(', ')}
                  onChange={(e) => updateEquipment({ kettlebells: parseNumberList(e.target.value) })}
                  placeholder="e.g. 12, 16, 24"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.equipment.bands.length > 0}
                    onChange={() =>
                      updateEquipment({ bands: formData.equipment.bands.length > 0 ? [] : ['light', 'medium'] })
                    }
                    className="accent-emerald-500"
                  />
                  Band resistance levels
                </label>
                <input
                  type="text"
                  value={formData.equipment.bands.join(', ')}
                  onChange={(e) => updateEquipment({ bands: parseStringList(e.target.value) })}
                  placeholder="e.g. light, medium, heavy"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.equipment.barbell.available}
                    onChange={() =>
                      updateEquipment({
                        barbell: {
                          ...formData.equipment.barbell,
                          available: !formData.equipment.barbell.available
                        }
                      })
                    }
                    className="accent-emerald-500"
                  />
                  Barbell + plates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="number"
                    min={15}
                    value={formData.equipment.barbell.barWeight}
                    onChange={(e) =>
                      updateEquipment({
                        barbell: { ...formData.equipment.barbell, barWeight: Number(e.target.value) }
                      })
                    }
                    placeholder="Bar weight"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <input
                    type="text"
                    value={formData.equipment.barbell.plates.join(', ')}
                    onChange={(e) =>
                      updateEquipment({
                        barbell: { ...formData.equipment.barbell, plates: parseNumberList(e.target.value) }
                      })
                    }
                    placeholder="Plate pairs: 45, 25, 10"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <p className="text-xs text-slate-500">Enter plates as pairs (per side) to reflect total load options.</p>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-300">Machines available</div>
                <div className="grid grid-cols-2 gap-2">
                  {machineOptions.map(machine => (
                    <label key={machine.key} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.equipment.machines[machine.key]}
                        onChange={() => updateMachineToggle(machine.key)}
                        className="accent-emerald-500"
                      />
                      {machine.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-6 border-t border-slate-800 pt-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Secondary Goal</label>
                <select
                  value={formData.goals.secondary ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      goals: { ...formData.goals, secondary: e.target.value ? (e.target.value as Goal) : undefined }
                    })
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
                <label className="block text-sm font-medium text-slate-300 mb-3">Goal Priority</label>
                <select
                  value={formData.goals.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, goals: { ...formData.goals, priority: e.target.value as PlanInput['goals']['priority'] } })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="primary">Primary only</option>
                  <option value="balanced">Balanced</option>
                  <option value="secondary">Bias toward secondary</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Time Windows</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(['morning', 'afternoon', 'evening'] as PlanInput['schedule']['timeWindows']).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.schedule.timeWindows.includes(opt)}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            schedule: {
                              ...formData.schedule,
                              timeWindows: toggleArrayValue(formData.schedule.timeWindows, opt)
                            }
                          })
                        }
                        className="accent-emerald-500"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Minimum Rest Days</label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    value={formData.schedule.minRestDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule: { ...formData.schedule, minRestDays: Number(e.target.value) }
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Recovery Preference</label>
                  <select
                    value={formData.preferences.restPreference}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, restPreference: e.target.value as PlanInput['preferences']['restPreference'] }
                      })
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
                <label className="block text-sm font-medium text-slate-300 mb-3">Focus Areas</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(['upper', 'lower', 'full_body', 'core', 'cardio', 'mobility'] as PlanInput['preferences']['focusAreas']).map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.preferences.focusAreas.includes(opt)}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              focusAreas: toggleArrayValue(formData.preferences.focusAreas, opt)
                            }
                          })
                        }
                        className="accent-emerald-500"
                      />
                      {opt.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Disliked Activities</label>
                <input
                  type="text"
                  value={formData.preferences.dislikedActivities.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      preferences: {
                        ...formData.preferences,
                        dislikedActivities: e.target.value ? e.target.value.split(',').map(item => item.trim()) : []
                      }
                    })
                  }
                  placeholder="e.g. running, jumping"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Accessibility Constraints</label>
                <div className="flex flex-wrap gap-3">
                  {['low-impact', 'joint-friendly', 'no-floor-work'].map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.preferences.accessibilityConstraints.includes(opt)}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              accessibilityConstraints: toggleArrayValue(formData.preferences.accessibilityConstraints, opt)
                            }
                          })
                        }
                        className="accent-emerald-500"
                      />
                      {opt.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-slate-800 pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Saved Workouts</h3>
              <span className="text-xs text-slate-500">{history.length} saved</span>
            </div>
            {historyError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                {historyError}
              </div>
            )}
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                No saved workouts yet. Generate a plan to build your history.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(item => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(item.plan.inputs)
                            setShowAdvanced(true)
                          }}
                          className="text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          Load inputs
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryId(selectedHistoryId === item.id ? null : item.id)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                        >
                          {selectedHistoryId === item.id ? 'Hide' : 'Quick view'}
                        </button>
                      </div>
                    </div>
                    {selectedHistoryId === item.id && (
                      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300 space-y-2">
                        <p>{item.description}</p>
                        <div className="flex flex-wrap gap-3 text-slate-400">
                          <span>Sessions: {item.plan.summary.sessionsPerWeek}</span>
                          <span>Minutes: {item.plan.summary.totalMinutes}</span>
                          <span>Score: {item.plan.summary.workoutScore.total}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <Button
              onClick={generatePlanHandler}
              disabled={loading}
              className="w-full py-6 text-lg"
            >
              {loading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-5 w-5" /> Generatin...
                </span>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate Program
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
