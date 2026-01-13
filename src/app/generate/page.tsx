'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Wand2, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { generatePlan, normalizePlanInput } from '@/lib/generator'
import { logEvent } from '@/lib/logger'
import type { Goal, PlanInput } from '@/types/domain'

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function GeneratePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const [formData, setFormData] = useState<PlanInput>(() =>
    normalizePlanInput({
      goals: { primary: 'strength', priority: 'primary' },
      experienceLevel: 'intermediate',
      intensity: 'moderate',
      equipment: ['gym'],
      time: { minutesPerSession: 45 },
      schedule: { daysAvailable: [1, 3, 5], timeWindows: ['evening'], minRestDays: 1 },
      preferences: { focusAreas: [], dislikedActivities: [], accessibilityConstraints: [], restPreference: 'balanced' }
    })
  )

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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Equipment</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['gym', 'dumbbells', 'bodyweight', 'bands', 'kettlebell'] as PlanInput['equipment']).map(opt => (
                <label key={opt} className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.equipment.includes(opt)}
                    onChange={() =>
                      setFormData({ ...formData, equipment: toggleArrayValue(formData.equipment, opt) })
                    }
                    className="accent-emerald-500"
                  />
                  {opt.replace('_', ' ')}
                </label>
              ))}
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
