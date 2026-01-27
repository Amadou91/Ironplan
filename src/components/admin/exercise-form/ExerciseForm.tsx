'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle, Dumbbell, Heart, Activity } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { 
  METRIC_PROFILES, 
  EXERCISE_GOALS, 
  FOCUS_AREAS, 
  getConstraintForProfile, 
  validateExercise 
} from '@/lib/validation/exercise-validation'
import type { Exercise, FocusArea, Goal, MetricProfile, EquipmentOption } from '@/types/domain'

type Props = {
  initialData?: Partial<Exercise>
  muscleOptions: { slug: string; label: string }[]
  onSubmit: (data: Exercise) => Promise<void>
  onCancel: () => void
}

const EQUIPMENT_KINDS: { label: string; value: EquipmentOption['kind'] }[] = [
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Band', value: 'band' },
  { label: 'Machine', value: 'machine' }
]

type ExerciseType = 'Strength' | 'Yoga' | 'Cardio'

export function ExerciseForm({ initialData, muscleOptions, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState<Partial<Exercise>>(initialData || {
    equipment: [],
    secondaryMuscles: []
  })
  
  // Determine initial exercise type based on category or fallback to Strength
  const [exerciseType, setExerciseType] = useState<ExerciseType>(() => {
    if (initialData?.category === 'Mobility') return 'Yoga'
    if (initialData?.category === 'Cardio') return 'Cardio'
    return 'Strength'
  })

  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const constraints = getConstraintForProfile(formData.metricProfile)

  useEffect(() => {
    if (!constraints.allowLoad && formData.loadTarget) {
      setFormData(prev => ({ ...prev, loadTarget: undefined }))
    }
  }, [constraints.allowLoad, formData.loadTarget])

  // Logic Rules for Exercise Type Changes
  const handleTypeChange = (type: ExerciseType) => {
    setExerciseType(type)
    
    if (type === 'Yoga') {
      setFormData(prev => ({
        ...prev,
        category: 'Mobility',
        focus: 'full_body',
        goal: 'range_of_motion',
        primaryMuscle: 'full_body' 
      }))
    } else if (type === 'Cardio') {
      setFormData(prev => ({
        ...prev,
        category: 'Cardio',
        focus: 'full_body',
        goal: 'endurance',
        primaryMuscle: 'full_body'
      }))
    } else {
      // Strength - Defaulting to Strength category, but keeping existing focus/goal if valid or clearing if they were set by other types
      setFormData(prev => ({
        ...prev,
        category: 'Strength',
        // If coming from Yoga/Cardio, these might be set to specific values. 
        // We let the user choose, so we don't necessarily reset them unless we want to force a selection.
        // But to be safe and avoid confusion:
        goal: (prev.goal === 'range_of_motion' || prev.goal === 'endurance') ? undefined : prev.goal,
        focus: prev.focus === 'full_body' ? undefined : prev.focus,
      }))
    }
  }

  const availableGoals = EXERCISE_GOALS.filter(g => {
    if (exerciseType === 'Yoga') return g.value === 'range_of_motion'
    if (exerciseType === 'Cardio') return g.value === 'endurance'
    return ['strength', 'hypertrophy', 'endurance'].includes(g.value)
  })

  // Filter Focus Areas based on type
  const availableFocusAreas = FOCUS_AREAS

  const handleEquipmentChange = (kind: EquipmentOption['kind'], checked: boolean) => {
    setFormData(prev => {
      const current = prev.equipment || []
      if (checked) {
        return { ...prev, equipment: [...current, { kind }] }
      }
      return { ...prev, equipment: current.filter(e => e.kind !== kind) }
    })
  }

  const handleSecondaryMuscleChange = (slug: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev.secondaryMuscles || []
      if (checked) {
        return { ...prev, secondaryMuscles: [...current, slug] }
      }
      return { ...prev, secondaryMuscles: current.filter(m => m !== slug) }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateExercise(formData)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    
    setIsSubmitting(true)
    try {
      await onSubmit(formData as Exercise)
    } catch (err) {
      if (err instanceof Error) {
        setErrors([`Failed to save exercise: ${err.message}`])
      }
      else {
        setErrors(['Failed to save exercise. Please try again.'])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
      {errors.length > 0 && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <ul className="list-disc list-inside text-sm">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      {/* Type Selector */}
      <div className="grid grid-cols-3 gap-4 p-1 bg-slate-100 rounded-lg">
        {[
          { id: 'Strength', icon: Dumbbell, label: 'Strength' },
          { id: 'Yoga', icon: Activity, label: 'Yoga / Mobility' },
          { id: 'Cardio', icon: Heart, label: 'Cardio' },
        ].map((type) => {
          const Icon = type.icon
          const isSelected = exerciseType === type.id
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => handleTypeChange(type.id as ExerciseType)}
              className={`
                flex items-center justify-center gap-2 py-3 px-4 rounded-md font-medium transition-all
                ${isSelected 
                  ? 'bg-white text-primary shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
              `}
            >
              <Icon className="w-4 h-4" />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* Section 1: Classification & Identity */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Classification & Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label>Exercise Name</Label>
              <Input 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder={exerciseType === 'Cardio' ? "e.g. Running" : "e.g. Bench Press"}
              />
            </div>
            
            {exerciseType === 'Strength' && (
              <>
                <div>
                  <Label>Focus Area</Label>
                  <Select 
                    value={formData.focus || ''} 
                    onChange={e => setFormData({...formData, focus: e.target.value as FocusArea})}
                  >
                    <option value="">Select Focus...</option>
                    {availableFocusAreas.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted mt-1">Primary body region targeted.</p>
                </div>

                <div>
                  <Label>Goal</Label>
                  <Select 
                    value={formData.goal || ''} 
                    onChange={e => setFormData({...formData, goal: e.target.value as Goal})}
                  >
                    <option value="">Select Goal...</option>
                    {availableGoals.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {(exerciseType === 'Yoga' || exerciseType === 'Cardio') && (
              <div className="p-4 bg-slate-50 rounded border text-sm text-slate-600">
                <p className="font-medium text-slate-900 mb-1">Auto-configured settings:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Category: {exerciseType === 'Yoga' ? 'Mobility' : 'Cardio'}</li>
                  <li>Focus: Full Body</li>
                  <li>Goal: {exerciseType === 'Yoga' ? 'Range of Motion' : 'Endurance'}</li>
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-4">
             <div className="flex items-start gap-2 pt-6 p-4 border rounded-md bg-slate-50/50">
              <Checkbox 
                checked={formData.e1rmEligible || false} 
                onCheckedChange={(c) => setFormData({...formData, e1rmEligible: c === true})}
                id="e1rm"
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="e1rm">E1RM Eligible</Label>
                <p className="text-xs text-muted">
                  Enable if this exercise is suitable for calculating a One-Rep Max (e.g., compound lifts).
                  Usually disabled for cardio, mobility, or isolation exercises.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Equipment & Muscles */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Equipment & Muscles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
           <div>
            <Label className="mb-3 block">Required Equipment</Label>
            <div className="flex flex-wrap gap-3">
              {EQUIPMENT_KINDS.map(item => (
                <label key={item.value} className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                  <Checkbox 
                    checked={formData.equipment?.some(e => e.kind === item.value) || false}
                    onCheckedChange={(c) => handleEquipmentChange(item.value, c === true)}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            {exerciseType === 'Strength' && (
              <div>
                <Label>Primary Muscle</Label>
                <Select 
                  value={formData.primaryMuscle as string || ''} 
                  onChange={e => setFormData({...formData, primaryMuscle: e.target.value})}
                >
                  <option value="">Select Muscle...</option>
                  {muscleOptions.map(m => (
                    <option key={m.slug} value={m.slug}>{m.label}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted mt-1">The main muscle group worked.</p>
              </div>
            )}

            <div className={exerciseType !== 'Strength' ? 'col-span-2' : ''}>
              <Label className="mb-2 block">Secondary Muscles / Synergists</Label>
              <div className="h-48 overflow-y-auto border rounded-md p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50/50">
                {muscleOptions.map(m => (
                  <label key={m.slug} className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary">
                    <Checkbox 
                      checked={formData.secondaryMuscles?.includes(m.slug) || false}
                      onCheckedChange={(c) => handleSecondaryMuscleChange(m.slug, c === true)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Details & Prescription */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Details & Prescription</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="isInterval"
                checked={formData.isInterval || false} 
                onCheckedChange={(c) => {
                  const isInterval = c === true
                  setFormData(prev => ({ 
                    ...prev, 
                    isInterval,
                    // clear restSeconds if interval mode enabled to avoid confusion with intervalRest? 
                    // or keep it. WorkoutEditor cleared it. Let's keep it simple.
                    restSeconds: isInterval ? 0 : prev.restSeconds
                  }))
                }}
              />
              <Label htmlFor="isInterval" className="text-sm font-medium cursor-pointer">Interval Mode</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-md">
            <Label>Metric Profile</Label>
            <Select 
              value={formData.metricProfile || ''} 
              onChange={e => setFormData({...formData, metricProfile: e.target.value as MetricProfile})}
            >
              <option value="">Select Profile...</option>
              {METRIC_PROFILES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
            <p className="text-xs text-muted mt-1">
              {METRIC_PROFILES.find(p => p.value === formData.metricProfile)?.description || 'Defines how progress is tracked (e.g., Weight & Reps vs Duration).'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div>
              <Label>{formData.isInterval ? 'Intervals' : 'Default Sets'}</Label>
              <Input 
                type="number" 
                min="1"
                value={formData.sets || ''} 
                onChange={e => setFormData({...formData, sets: Number(e.target.value)})}
              />
            </div>

            {formData.isInterval ? (
              <>
                <div>
                  <Label>On Duration (s)</Label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.intervalDuration || ''} 
                    onChange={e => setFormData({...formData, intervalDuration: Number(e.target.value)})}
                    placeholder="Work"
                  />
                </div>
                <div>
                  <Label>Off Duration (s)</Label>
                  <Input 
                    type="number"
                    min="0"
                    value={formData.intervalRest || ''} 
                    onChange={e => setFormData({...formData, intervalRest: Number(e.target.value)})}
                    placeholder="Rest"
                  />
                </div>
              </>
            ) : (
              <>
                {(constraints.requiresReps || (!constraints.requiresDuration && !formData.isInterval)) && (
                  <div>
                    <Label>Rep Range</Label>
                    <Input 
                      value={formData.reps || ''} 
                      onChange={e => setFormData({...formData, reps: e.target.value})} 
                      placeholder="e.g. 8-12"
                    />
                  </div>
                )}

                {constraints.requiresDuration && (
                  <div>
                    <Label>Duration (Min)</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={formData.durationMinutes || ''} 
                      onChange={e => setFormData({...formData, durationMinutes: Number(e.target.value)})}
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Target RPE</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min="1" 
                  max="10"
                  value={formData.rpe || ''} 
                  onChange={e => setFormData({...formData, rpe: Number(e.target.value)})}
                />
              </div>
              <span className="text-[10px] text-muted block mt-1">
                 Rec: {constraints.defaultRpeRange[0]}-{constraints.defaultRpeRange[1]}
              </span>
            </div>

            {!formData.isInterval && (
              <div>
                <Label>Rest (Sec)</Label>
                <Input 
                  type="number" 
                  step="15"
                  value={formData.restSeconds || ''} 
                  onChange={e => setFormData({...formData, restSeconds: Number(e.target.value)})}
                />
              </div>
            )}
          </div>
          
          <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>These values serve as a baseline. The generator adjusts them based on intensity, experience, and time constraints.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Exercise'}
        </Button>
      </div>
    </form>
  )
}
