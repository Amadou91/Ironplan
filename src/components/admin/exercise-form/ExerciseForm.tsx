'use client'

import React, { useState, useEffect } from 'react'
import { 
  Dumbbell, 
  Heart, 
  Activity, 
  FileText, 
  Settings2, 
  Layers, 
  Check,
  AlertCircle,
  Save,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { 
  EXERCISE_GOALS, 
  FOCUS_AREAS, 
  getConstraintForProfile, 
  validateExercise 
} from '@/lib/validation/exercise-validation'
import { deriveMetricProfile, METRIC_PROFILE_OPTIONS } from '@/lib/metric-derivation'
import type { Exercise, FocusArea, Goal, EquipmentOption } from '@/types/domain'

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

  const [isAdvanced, setIsAdvanced] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // -- Derived State & Helpers --

  // 1. Identify Current Virtual Option
  const currentOption = METRIC_PROFILE_OPTIONS.find(opt => {
    // Match base profile
    if (opt.backendProfile !== formData.metricProfile) return false
    // Match interval flag if the option cares about it (undefined means it doesn't matter or default)
    // But our virtual options are explicit.
    if (opt.isInterval !== undefined) {
      return opt.isInterval === !!formData.isInterval
    }
    return true
  }) || METRIC_PROFILE_OPTIONS[0]

  const derivedResult = deriveMetricProfile(formData.category, formData.goal)

  // 2. Handle Profile Changes (Virtual -> Real)
  const handleProfileChange = (virtualValue: string) => {
    const option = METRIC_PROFILE_OPTIONS.find(o => o.value === virtualValue)
    if (!option) return

    setFormData(prev => ({
      ...prev,
      metricProfile: option.backendProfile,
      isInterval: option.isInterval,
      // Reset incompatible fields if switching modes
      restSeconds: option.isInterval ? 0 : prev.restSeconds
    }))
  }

  // 3. Auto-Derivation Effect
  useEffect(() => {
    if (!isAdvanced) {
      const { option } = deriveMetricProfile(formData.category, formData.goal)
      
      // Check if we need to update
      const needsUpdate = 
        formData.metricProfile !== option.backendProfile || 
        (option.isInterval !== undefined && !!formData.isInterval !== option.isInterval)

      if (needsUpdate) {
        setFormData(prev => ({ 
          ...prev, 
          metricProfile: option.backendProfile,
          isInterval: option.isInterval ?? prev.isInterval 
        }))
      }
    }
  }, [formData.category, formData.goal, isAdvanced, formData.metricProfile, formData.isInterval])

  const constraints = getConstraintForProfile(formData.metricProfile)

  useEffect(() => {
    if (!constraints.allowLoad && formData.loadTarget) {
      setFormData(prev => ({ ...prev, loadTarget: undefined }))
    }
  }, [constraints.allowLoad, formData.loadTarget])

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
      setFormData(prev => ({
        ...prev,
        category: 'Strength',
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

  const handleEquipmentChange = (kind: EquipmentOption['kind']) => {
    setFormData(prev => {
      const current = prev.equipment || []
      const exists = current.some(e => e.kind === kind)
      return exists 
        ? { ...prev, equipment: current.filter(e => e.kind !== kind) }
        : { ...prev, equipment: [...current, { kind }] }
    })
  }

  const handleSecondaryMuscleChange = (slug: string) => {
    setFormData(prev => {
      const current = prev.secondaryMuscles || []
      const exists = current.includes(slug)
      return exists
        ? { ...prev, secondaryMuscles: current.filter(m => m !== slug) }
        : { ...prev, secondaryMuscles: [...current, slug] }
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
      } else {
        setErrors(['Failed to save exercise. Please try again.'])
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="pb-32 space-y-8 max-w-5xl mx-auto">
      
      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="alert-error p-4 flex gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm mb-1">Please correct the following errors:</h4>
            <ul className="list-disc list-inside text-sm opacity-90">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Type Toggle */}
      <div className="grid grid-cols-3 gap-4 p-1.5 bg-[var(--color-surface-muted)] rounded-2xl border border-[var(--color-border)]">
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
                flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all duration-200
                ${isSelected 
                  ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-border-strong)]' 
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]'}
              `}
            >
              <Icon className="w-4 h-4" />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* 1. Identity Card */}
      <Card>
        <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <FileText className="w-5 h-5 text-[var(--color-primary)]" />
              <CardTitle className="text-base text-[var(--color-text)]">Identity</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="advMode" 
                checked={isAdvanced} 
                onCheckedChange={(c) => setIsAdvanced(c === true)}
              />
              <Label htmlFor="advMode" className="text-xs text-[var(--color-text-muted)] cursor-pointer">Advanced</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8">
            <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Exercise Name</Label>
            <Input 
              value={formData.name || ''} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder={exerciseType === 'Cardio' ? "e.g. 5k Run" : "e.g. Barbell Bench Press"}
              className="font-semibold text-lg"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Tracking Style</Label>
            {isAdvanced ? (
               <Select 
                value={currentOption.value} 
                onChange={e => handleProfileChange(e.target.value)}
              >
                {METRIC_PROFILE_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            ) : (
              <div className="h-12 px-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                <span className="font-medium text-[var(--color-text)]">
                  {currentOption.label || 'Auto-detected'}
                </span>
                {derivedResult.isAmbiguous && derivedResult.alternatives && (
                   <div className="flex gap-1 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)]">
                      {derivedResult.alternatives.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleProfileChange(opt.value)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            currentOption.value === opt.value 
                            ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] font-bold' 
                            : 'hover:bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                          }`}
                        >
                          {opt.label.split(' ')[0]}
                        </button>
                      ))}
                   </div>
                )}
              </div>
            )}
          </div>

          {exerciseType === 'Strength' ? (
            <>
              <div className="col-span-12 md:col-span-4">
                <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Focus Area</Label>
                <Select 
                  value={formData.focus || ''} 
                  onChange={e => setFormData({...formData, focus: e.target.value as FocusArea})}
                >
                  <option value="">Select Focus...</option>
                  {FOCUS_AREAS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </Select>
              </div>

              <div className="col-span-12 md:col-span-4">
                <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Primary Muscle</Label>
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
                <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Goal</Label>
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
             <div className="col-span-12 bg-[var(--color-primary-soft)] border border-[var(--color-primary-border)] rounded-xl p-4 flex items-center gap-4">
                <div className="p-2 bg-[var(--color-surface)] rounded-lg text-[var(--color-primary)]">
                   <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--color-primary-strong)]">Auto-configured for {exerciseType}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Category, Focus, and Goal have been set automatically.</p>
                </div>
             </div>
          )}

          {/* Secondary Muscles Scrollable - Relocated Here */}
          <div className="col-span-12 pt-4 border-t border-[var(--color-border)] mt-2">
            <Label className="mb-4 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Secondary Muscles</Label>
            <div className="border border-[var(--color-border)] rounded-2xl h-[200px] overflow-y-auto p-4 bg-[var(--color-surface)] shadow-inner">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {muscleOptions.map(m => {
                  const isSelected = formData.secondaryMuscles?.includes(m.slug)
                  return (
                    <button
                      type="button"
                      key={m.slug}
                      onClick={() => handleSecondaryMuscleChange(m.slug)}
                      className={`
                        w-full flex items-center justify-between px-4 py-2 rounded-xl text-xs font-medium transition-all text-left border
                        ${isSelected 
                          ? 'bg-[var(--color-surface-elevated)] text-[var(--color-primary-strong)] shadow-sm border-[var(--color-primary-border)] ring-1 ring-[var(--color-primary-soft)]' 
                          : 'bg-transparent border-transparent hover:bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}
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

      {/* 2. Standards Card */}
      <Card>
         <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] pb-4">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <Settings2 className="w-5 h-5 text-[var(--color-primary)]" />
              <CardTitle className="text-base text-[var(--color-text)]">Standards</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8 grid grid-cols-12 gap-6">
          <div className="col-span-6 md:col-span-3">
            <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">{formData.isInterval ? 'Intervals' : 'Default Sets'}</Label>
            <Input 
              type="number" 
              min="1"
              value={formData.sets || ''} 
              onChange={e => setFormData({...formData, sets: Number(e.target.value)})}
              className="text-center font-bold"
            />
          </div>

          {formData.isInterval ? (
            <>
              <div className="col-span-6 md:col-span-3">
                <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Work (sec)</Label>
                <Input 
                  type="number"
                  min="1"
                  value={formData.intervalDuration || ''} 
                  onChange={e => setFormData({...formData, intervalDuration: Number(e.target.value)})}
                  className="text-center"
                />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Rest (sec)</Label>
                <Input 
                  type="number"
                  min="0"
                  value={formData.intervalRest || ''} 
                  onChange={e => setFormData({...formData, intervalRest: Number(e.target.value)})}
                  className="text-center"
                />
              </div>
            </>
          ) : (
            <>
              {(constraints.requiresReps || (!constraints.requiresDuration && !formData.isInterval)) && (
                <div className="col-span-6 md:col-span-3">
                  <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Rep Range</Label>
                  <Input 
                    value={formData.reps || ''} 
                    onChange={e => setFormData({...formData, reps: e.target.value})} 
                    placeholder="8-12"
                    className="text-center"
                  />
                </div>
              )}

              {constraints.requiresDuration && (
                <div className="col-span-6 md:col-span-3">
                  <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Duration (Min)</Label>
                  <Input 
                    type="number" 
                    min="1"
                    value={formData.durationMinutes || ''} 
                    onChange={e => setFormData({...formData, durationMinutes: Number(e.target.value)})}
                    className="text-center"
                  />
                </div>
              )}
            </>
          )}

          <div className="col-span-6 md:col-span-3">
            <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Target RPE</Label>
            <Input 
              type="number" 
              min="1" 
              max="10"
              value={formData.rpe || ''} 
              onChange={e => setFormData({...formData, rpe: Number(e.target.value)})}
              className="text-center"
            />
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1.5 block text-center font-medium">
               Rec: {constraints.defaultRpeRange[0]}-{constraints.defaultRpeRange[1]}
            </span>
          </div>

          {!formData.isInterval && (
            <div className="col-span-6 md:col-span-3">
              <Label className="mb-2 block text-[var(--color-text-subtle)] uppercase text-xs font-bold tracking-wider">Rest (Sec)</Label>
              <Input 
                type="number" 
                step="15"
                value={formData.restSeconds || ''} 
                onChange={e => setFormData({...formData, restSeconds: Number(e.target.value)})}
                className="text-center"
              />
            </div>
          )}

          {/* E1RM Toggle */}
          <div className="col-span-12 pt-4 border-t border-[var(--color-border)] mt-2">
             <div className="flex items-center gap-4">
                <Checkbox 
                  checked={formData.e1rmEligible || false} 
                  onCheckedChange={(c) => setFormData({...formData, e1rmEligible: c === true})}
                  id="e1rm"
                  label="E1RM Eligible"
                  className="w-auto border-none p-0 hover:bg-transparent"
                />
                <span className="text-xs text-[var(--color-text-muted)] mt-0.5 font-medium italic">
                  (Enable for max-effort lifts)
                </span>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Requirements Card (Now Equipment Only) */}
      <Card>
        <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] pb-4">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Layers className="w-5 h-5 text-[var(--color-primary)]" />
            <CardTitle className="text-base text-[var(--color-text)]">Equipment</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-8 space-y-8">
          {/* Equipment Pills */}
          <div>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_KINDS.map(item => {
                const isSelected = formData.equipment?.some(e => e.kind === item.value)
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleEquipmentChange(item.value)}
                    className={`
                      flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-bold transition-all duration-200
                      ${isSelected
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md transform scale-[1.02]'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)]'}
                    `}
                  >
                    {item.label}
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--color-surface)]/80 backdrop-blur-xl border-t border-[var(--color-border)] z-50 flex items-center justify-end shadow-[var(--shadow-md)]">
        <div className="max-w-5xl w-full mx-auto flex justify-end gap-4">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="min-w-[140px] shadow-lg shadow-[var(--color-primary-soft)]"
          >
            {isSubmitting ? 'Saving...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Exercise
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}