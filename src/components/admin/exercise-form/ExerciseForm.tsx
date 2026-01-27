'use client'

import React, { useState, useEffect } from 'react'
import { 
  AlertCircle, 
  Dumbbell, 
  Heart, 
  Activity, 
  FileText, 
  Settings2, 
  Layers, 
  Check,
  XCircle
} from 'lucide-react'
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

  const handleEquipmentChange = (kind: EquipmentOption['kind']) => {
    setFormData(prev => {
      const current = prev.equipment || []
      const exists = current.some(e => e.kind === kind)
      
      if (!exists) {
        return { ...prev, equipment: [...current, { kind }] }
      }
      return { ...prev, equipment: current.filter(e => e.kind !== kind) }
    })
  }

  const handleSecondaryMuscleChange = (slug: string) => {
    setFormData(prev => {
      const current = prev.secondaryMuscles || []
      const exists = current.includes(slug)
      
      if (!exists) {
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
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="pb-24">
      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
        {/* Error Alert */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3 shadow-sm">
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Please correct the following errors:</h4>
              <ul className="list-disc list-inside text-sm text-red-600/90">
                {errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Type Selector - High Level Toggle */}
        <div className="grid grid-cols-3 gap-4 p-1.5 bg-muted rounded-xl">
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
                  flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all duration-200
                  ${isSelected 
                    ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'}
                `}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            )
          })}
        </div>

        {/* Section 1: Core Details */}
        <Card>
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle className="text-base text-foreground">Core Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-12 gap-6">
            {/* Exercise Name */}
            <div className="col-span-12 md:col-span-8">
              <Label className="mb-2 block">Exercise Name</Label>
              <Input 
                value={formData.name || ''} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder={exerciseType === 'Cardio' ? "e.g. 5k Run" : "e.g. Barbell Bench Press"}
                className="text-lg font-medium"
              />
            </div>

            {/* Metric Profile */}
            <div className="col-span-12 md:col-span-4">
              <Label className="mb-2 block">Metric Profile</Label>
              <Select 
                value={formData.metricProfile || ''} 
                onChange={e => setFormData({...formData, metricProfile: e.target.value as MetricProfile})}
              >
                <option value="">Select Profile...</option>
                {METRIC_PROFILES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </div>

            {exerciseType === 'Strength' ? (
              <>
                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-2 block">Focus Area</Label>
                  <Select 
                    value={formData.focus || ''} 
                    onChange={e => setFormData({...formData, focus: e.target.value as FocusArea})}
                  >
                    <option value="">Select Focus...</option>
                    {availableFocusAreas.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </Select>
                </div>

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-2 block">Primary Muscle</Label>
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

                <div className="col-span-12 md:col-span-4">
                  <Label className="mb-2 block">Goal</Label>
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
            ) : (
               <div className="col-span-12 bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">Auto-configured for {exerciseType}:</p>
                <div className="flex gap-6 text-sm text-blue-600/80">
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Category: {exerciseType === 'Yoga' ? 'Mobility' : 'Cardio'}</span>
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Focus: Full Body</span>
                  <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Goal: {exerciseType === 'Yoga' ? 'Range of Motion' : 'Endurance'}</span>
                </div>
               </div>
            )}

            <div className="col-span-12 pt-2">
              <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/20">
                <Checkbox 
                  checked={formData.e1rmEligible || false} 
                  onCheckedChange={(c) => setFormData({...formData, e1rmEligible: c === true})}
                  id="e1rm"
                  className="mt-1"
                />
                <div className="space-y-1">
                  <Label htmlFor="e1rm" className="font-medium cursor-pointer">E1RM Eligible</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable if this exercise is suitable for calculating a One-Rep Max (e.g., Squat, Deadlift).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Training Standards */}
        <Card>
           <CardHeader className="border-b bg-muted/30 pb-4">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Settings2 className="w-5 h-5 text-primary" />
                <CardTitle className="text-base text-foreground">Training Standards</CardTitle>
              </div>
              
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                <Checkbox 
                  id="isInterval"
                  checked={formData.isInterval || false} 
                  onCheckedChange={(c) => {
                    const isInterval = c === true
                    setFormData(prev => ({ 
                      ...prev, 
                      isInterval,
                      restSeconds: isInterval ? 0 : prev.restSeconds
                    }))
                  }}
                />
                <Label htmlFor="isInterval" className="text-sm font-medium cursor-pointer select-none">Interval Mode</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 grid grid-cols-12 gap-6">
            <div className="col-span-6 md:col-span-3">
              <Label className="mb-2 block">{formData.isInterval ? 'Intervals' : 'Default Sets'}</Label>
              <Input 
                type="number" 
                min="1"
                value={formData.sets || ''} 
                onChange={e => setFormData({...formData, sets: Number(e.target.value)})}
              />
            </div>

            {formData.isInterval ? (
              <>
                <div className="col-span-6 md:col-span-3">
                  <Label className="mb-2 block">Work (sec)</Label>
                  <Input 
                    type="number"
                    min="1"
                    value={formData.intervalDuration || ''} 
                    onChange={e => setFormData({...formData, intervalDuration: Number(e.target.value)})}
                  />
                </div>
                <div className="col-span-6 md:col-span-3">
                  <Label className="mb-2 block">Rest (sec)</Label>
                  <Input 
                    type="number"
                    min="0"
                    value={formData.intervalRest || ''} 
                    onChange={e => setFormData({...formData, intervalRest: Number(e.target.value)})}
                  />
                </div>
              </>
            ) : (
              <>
                {(constraints.requiresReps || (!constraints.requiresDuration && !formData.isInterval)) && (
                  <div className="col-span-6 md:col-span-3">
                    <Label className="mb-2 block">Rep Range</Label>
                    <Input 
                      value={formData.reps || ''} 
                      onChange={e => setFormData({...formData, reps: e.target.value})} 
                      placeholder="e.g. 8-12"
                    />
                  </div>
                )}

                {constraints.requiresDuration && (
                  <div className="col-span-6 md:col-span-3">
                    <Label className="mb-2 block">Duration (Min)</Label>
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

            <div className="col-span-6 md:col-span-3">
              <Label className="mb-2 block">Target RPE</Label>
              <Input 
                type="number" 
                min="1" 
                max="10"
                value={formData.rpe || ''} 
                onChange={e => setFormData({...formData, rpe: Number(e.target.value)})}
              />
              <span className="text-xs text-muted-foreground mt-1.5 block">
                 Rec: {constraints.defaultRpeRange[0]}-{constraints.defaultRpeRange[1]}
              </span>
            </div>

            {!formData.isInterval && (
              <div className="col-span-6 md:col-span-3">
                <Label className="mb-2 block">Rest (Sec)</Label>
                <Input 
                  type="number" 
                  step="15"
                  value={formData.restSeconds || ''} 
                  onChange={e => setFormData({...formData, restSeconds: Number(e.target.value)})}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Requirements */}
        <Card>
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layers className="w-5 h-5 text-primary" />
              <CardTitle className="text-base text-foreground">Requirements</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Equipment Pills */}
            <div>
              <Label className="mb-3 block text-base">Required Equipment</Label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_KINDS.map(item => {
                  const isSelected = formData.equipment?.some(e => e.kind === item.value)
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleEquipmentChange(item.value)}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200
                        ${isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                      `}
                    >
                      {item.label}
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Secondary Muscles Scrollable */}
            <div>
              <Label className="mb-3 block text-base">Secondary Muscles</Label>
              <div className="border rounded-xl h-64 overflow-y-auto p-2 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                  {muscleOptions.map(m => {
                    const isSelected = formData.secondaryMuscles?.includes(m.slug)
                    return (
                      <button
                        type="button"
                        key={m.slug}
                        onClick={() => handleSecondaryMuscleChange(m.slug)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left
                          ${isSelected 
                            ? 'bg-white text-primary font-medium shadow-sm ring-1 ring-black/5' 
                            : 'hover:bg-muted-foreground/10 text-muted-foreground'}
                        `}
                      >
                        {m.label}
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t z-50 flex items-center justify-end gap-4 shadow-lg">
        <div className="max-w-5xl w-full mx-auto flex justify-end gap-4">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? 'Saving...' : 'Save Exercise'}
          </Button>
        </div>
      </div>
    </div>
  )
}
