'use client'

import { useState, useEffect } from 'react'
import { Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Textarea } from '@/components/ui/Textarea'
import { 
  METRIC_PROFILES, 
  EXERCISE_GOALS, 
  FOCUS_AREAS, 
  getConstraintForProfile, 
  validateExercise 
} from '@/lib/validation/exercise-validation'
import type { Exercise, MuscleGroup, FocusArea, Goal, MetricProfile, EquipmentOption } from '@/types/domain'

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

export function ExerciseForm({ initialData, muscleOptions, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState<Partial<Exercise>>(initialData || {
    equipment: [],
    secondaryMuscles: []
  })
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const constraints = getConstraintForProfile(formData.metricProfile)

  useEffect(() => {
    if (!constraints.allowLoad && formData.loadTarget) {
      setFormData(prev => ({ ...prev, loadTarget: undefined }))
    }
  }, [constraints.allowLoad, formData.loadTarget])

  // Enforce Domain Rules for Category and Goal
  useEffect(() => {
    if (formData.focus === 'cardio') {
      setFormData(prev => ({ 
        ...prev, 
        category: 'Cardio',
        goal: 'mobility' // Per audit rule: Cardio focus -> Mobility goal
      }))
    } else if (formData.focus === 'mobility') {
      setFormData(prev => ({ 
        ...prev, 
        category: 'Mobility',
        goal: 'mobility'
      }))
    } else if (formData.focus) {
      // Strength/Muscle focus
      setFormData(prev => {
        const newGoal = (prev.goal === 'cardio' || prev.goal === 'mobility') ? 'strength' : prev.goal
        return { 
          ...prev, 
          category: 'Strength',
          goal: newGoal
        }
      })
    }
  }, [formData.focus])

  const availableGoals = EXERCISE_GOALS.filter(g => {
    if (formData.focus === 'cardio' || formData.focus === 'mobility') {
      return g.value === 'mobility'
    }
    return ['strength', 'hypertrophy', 'endurance'].includes(g.value)
  })

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
      } else {
        setErrors(['Failed to save exercise. Please try again.'])
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errors.length > 0 && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md flex items-start gap-2">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <ul className="list-disc list-inside text-sm">
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label>Exercise Name</Label>
            <Input 
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. Bench Press"
            />
          </div>

          <div>
            <Label>Focus Area</Label>
            <Select 
              value={formData.focus || ''} 
              onChange={e => setFormData({...formData, focus: e.target.value as FocusArea})}
            >
              <option value="">Select Focus...</option>
              {FOCUS_AREAS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
            <p className="text-xs text-muted mt-1">Determines how the exercise is categorized in session plans.</p>
          </div>

          <div>
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
              {METRIC_PROFILES.find(p => p.value === formData.metricProfile)?.description || 'Select a profile to see details'}
            </p>
          </div>
        </div>

        {/* Classification */}
        <div className="space-y-4">
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

          <div className="flex items-center gap-2 pt-6">
            <Checkbox 
              checked={formData.e1rmEligible || false} 
              onCheckedChange={(c) => setFormData({...formData, e1rmEligible: c === true})} 
            />
            <div className="grid gap-1.5 leading-none">
              <Label>E1RM Eligible</Label>
              <p className="text-xs text-muted">Check if this exercise supports 1-rep max estimation.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] pt-6">
        <h3 className="font-semibold text-lg mb-4">Prescription Defaults</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label>Default Sets</Label>
            <Input 
              type="number" 
              min="1"
              value={formData.sets || ''} 
              onChange={e => setFormData({...formData, sets: Number(e.target.value)})}
            />
          </div>

          {constraints.requiresReps && (
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
              <Label>Duration (Minutes)</Label>
              <Input 
                type="number" 
                min="1"
                value={formData.durationMinutes || ''} 
                onChange={e => setFormData({...formData, durationMinutes: Number(e.target.value)})}
              />
            </div>
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
              <span className="text-xs text-muted w-20">
                Range: {constraints.defaultRpeRange[0]}-{constraints.defaultRpeRange[1]}
              </span>
            </div>
          </div>

          <div>
            <Label>Rest (Seconds)</Label>
            <Input 
              type="number" 
              step="15"
              value={formData.restSeconds || ''} 
              onChange={e => setFormData({...formData, restSeconds: Number(e.target.value)})}
            />
          </div>
        </div>
        <p className="text-xs text-muted mt-3 italic">
          * These values serve as a baseline. The generator adjusts them based on intensity, experience, and time constraints.
        </p>
      </div>

      <div className="border-t border-[var(--color-border)] pt-6">
        <h3 className="font-semibold text-lg mb-4">Equipment & Muscles</h3>
        
        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Required Equipment</Label>
            <div className="flex flex-wrap gap-3">
              {EQUIPMENT_KINDS.map(item => (
                <label key={item.value} className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-slate-50 cursor-pointer">
                  <Checkbox 
                    checked={formData.equipment?.some(e => e.kind === item.value) || false}
                    onCheckedChange={(c) => handleEquipmentChange(item.value, c === true)}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Secondary Muscles</Label>
            <div className="h-48 overflow-y-auto border rounded-md p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {muscleOptions.map(m => (
                <label key={m.slug} className="flex items-center gap-2 text-sm">
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
      </div>

      <div className="flex items-center justify-end gap-4 pt-4 border-t border-[var(--color-border)]">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Exercise'}
        </Button>
      </div>
    </form>
  )
}
