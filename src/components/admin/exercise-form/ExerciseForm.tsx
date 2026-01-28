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
  X,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { 
  EXERCISE_GOALS, 
  FOCUS_AREAS, 
  getConstraintForProfile, 
  validateExercise 
} from '@/lib/validation/exercise-validation'
import { deriveMetricProfile, METRIC_PROFILE_OPTIONS } from '@/lib/metric-derivation'
import { getFocusAreaFromMuscle } from '@/lib/muscle-utils'
import type { 
  Exercise, 
  FocusArea, 
  Goal, 
  EquipmentOption, 
  MachineType, 
  EquipmentKind 
} from '@/types/domain'

type Props = {
  initialData?: Partial<Exercise>
  muscleOptions: { slug: string; label: string }[]
  onSubmit: (data: Exercise) => Promise<void>
  onCancel: () => void
}

const EQUIPMENT_KINDS: { label: string; value: EquipmentKind }[] = [
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Band', value: 'band' },
  { label: 'Machine', value: 'machine' },
  { label: 'Block', value: 'block' },
  { label: 'Bolster', value: 'bolster' },
  { label: 'Strap', value: 'strap' }
]

const MACHINE_TYPES: { label: string; value: MachineType }[] = [
  { label: 'Cable', value: 'cable' },
  { label: 'Leg Press', value: 'leg_press' },
  { label: 'Treadmill', value: 'treadmill' },
  { label: 'Rower', value: 'rower' },
  { label: 'Indoor Bicycle', value: 'indoor_bicycle' }
]

const MOVEMENT_PATTERNS: { label: string; value: string }[] = [
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Squat', value: 'squat' },
  { label: 'Hinge', value: 'hinge' },
  { label: 'Carry', value: 'carry' },
  { label: 'Core', value: 'core' },
  { label: 'Cardio', value: 'cardio' }
]

const MOVEMENT_PATTERN_MUSCLES: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps', 'upper_body'],
  pull: ['back', 'biceps', 'forearms', 'upper_body'],
  squat: ['quads', 'glutes', 'adductors', 'lower_body', 'calves'],
  hinge: ['hamstrings', 'glutes', 'lower_body', 'back'],
  carry: ['forearms', 'core', 'shoulders', 'full_body'],
  core: ['core'],
  cardio: ['full_body', 'cardio'],
  mobility: ['full_body', 'mobility']
}

type ExerciseType = 'Strength' | 'Yoga' | 'Cardio'

export function ExerciseForm({ initialData, muscleOptions, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState<Partial<Exercise>>(initialData || {
    equipment: [],
    secondaryMuscles: []
  })
  
  const [exerciseType, setExerciseType] = useState<ExerciseType>(() => {
    if (initialData?.category === 'Mobility') return 'Yoga'
    if (initialData?.category === 'Cardio') return 'Cardio'
    return 'Strength'
  })

  const [isAdvanced, setIsAdvanced] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // -- Derived State & Helpers --

  const filteredMuscles = formData.movementPattern 
    ? muscleOptions.filter(m => MOVEMENT_PATTERN_MUSCLES[formData.movementPattern as string]?.includes(m.slug))
    : muscleOptions

  const currentOption = METRIC_PROFILE_OPTIONS.find(opt => {
    if (opt.backendProfile !== formData.metricProfile) return false
    if (opt.isInterval !== undefined) {
      return opt.isInterval === !!formData.isInterval
    }
    return true
  }) || METRIC_PROFILE_OPTIONS[0]

  const handleProfileChange = (virtualValue: string) => {
    const option = METRIC_PROFILE_OPTIONS.find(o => o.value === virtualValue)
    if (!option) return

    setFormData(prev => ({
      ...prev,
      metricProfile: option.backendProfile,
      isInterval: option.isInterval
    }))
  }

  useEffect(() => {
    if (formData.primaryMuscle && exerciseType === 'Strength') {
      const derivedFocus = getFocusAreaFromMuscle(formData.primaryMuscle);
      if (derivedFocus && formData.focus !== derivedFocus) {
        setFormData(prev => ({ ...prev, focus: derivedFocus }));
      }
    }
  }, [formData.primaryMuscle, exerciseType, formData.focus])

  const handleTypeChange = (type: ExerciseType) => {
    setExerciseType(type)
    if (type === 'Yoga') {
      setFormData(prev => ({
        ...prev,
        category: 'Mobility',
        focus: 'full_body',
        primaryMuscle: 'full_body' 
      }))
    } else if (type === 'Cardio') {
      setFormData(prev => ({
        ...prev,
        category: 'Cardio',
        focus: 'full_body',
        primaryMuscle: 'full_body'
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        category: 'Strength',
        focus: prev.primaryMuscle ? getFocusAreaFromMuscle(prev.primaryMuscle) : undefined,
      }))
    }
  }

  const handleEquipmentChange = (kind: EquipmentKind, machineType?: MachineType) => {
    setFormData(prev => {
      const current = prev.equipment || []
      const existing = current.find(e => e.kind === kind)
      
      if (existing) {
        // If updating machine type
        if (kind === 'machine' && machineType && existing.machineType !== machineType) {
          return {
            ...prev,
            equipment: current.map(e => e.kind === 'machine' ? { kind: 'machine', machineType } : e)
          }
        }
        // Otherwise toggle off
        return { ...prev, equipment: current.filter(e => e.kind !== kind) }
      }
      
      // Add new
      const newItem: EquipmentOption = kind === 'machine' 
        ? { kind: 'machine', machineType: machineType || 'cable' } 
        : { kind }
      return { ...prev, equipment: [...current, newItem] }
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

  const machineOption = formData.equipment?.find(e => e.kind === 'machine')

  return (
    <div className="pb-40 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      
      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="alert-error p-5 flex gap-4 shadow-lg animate-in slide-in-from-top-4 glass-panel border-red-200 dark:border-red-900/50">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-base tracking-tight">Validation Errors</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 list-inside text-sm opacity-90">
              {errors.map((err, i) => <li key={i} className="list-disc leading-relaxed">{err}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* High-Level Type Toggle */}
      <div className="flex p-2 bg-[var(--color-surface-muted)] rounded-2xl border border-[var(--color-border)] shadow-inner">
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
              className={cn(
                "flex-1 flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl font-bold transition-all duration-300 min-h-[56px]",
                isSelected 
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-md ring-1 ring-[var(--color-border-strong)] scale-[1.02]" 
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="hidden sm:inline">{type.label}</span>
              <span className="sm:hidden">{type.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Core Definition */}
        <div className="col-span-12 lg:col-span-10 lg:col-start-2 space-y-8">
          
          {/* Section 1: Identity */}
          <Card className="overflow-hidden glass-panel">
            <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]/50 py-5 px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-primary-soft)] rounded-lg text-[var(--color-primary)]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg font-bold tracking-tight">Identity</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="advMode" className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] cursor-pointer select-none">Advanced</Label>
                  <Checkbox 
                    id="advMode" 
                    checked={isAdvanced} 
                    onCheckedChange={(c) => setIsAdvanced(c === true)}
                    className="w-5 h-5"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-12 gap-8">
                <div className={cn(
                  "col-span-12",
                  isAdvanced ? "md:col-span-8" : "col-span-12"
                )}>
                  <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">Exercise Name</Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder={exerciseType === 'Cardio' ? "e.g. 5k Run" : "e.g. Barbell Bench Press"}
                    className="font-bold text-xl h-14 bg-white/50"
                  />
                </div>

                {isAdvanced && (
                  <div className="col-span-12 md:col-span-4 animate-in slide-in-from-right-4">
                    <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">Tracking Style</Label>
                    <Select 
                      value={currentOption.value} 
                      onChange={e => handleProfileChange(e.target.value)}
                      className="h-14 font-semibold bg-white/50"
                    >
                      {METRIC_PROFILE_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </Select>
                  </div>
                )}

                {exerciseType === 'Strength' ? (
                  <>
                    <div className="col-span-12 space-y-6 animate-in fade-in duration-500">
                      <div>
                        <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">1. Movement Pattern</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {MOVEMENT_PATTERNS.map(pattern => {
                            const isSelected = formData.movementPattern === pattern.value
                            return (
                              <button
                                key={pattern.value}
                                type="button"
                                onClick={() => setFormData({...formData, movementPattern: pattern.value as any})}
                                className={cn(
                                  "py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 min-h-[48px]",
                                  isSelected
                                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md"
                                    : "bg-white/50 border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                                )}
                              >
                                {pattern.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {formData.movementPattern && (
                        <div className="animate-in slide-in-from-top-4 duration-300">
                          <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">2. Primary Muscle</Label>
                          <Select 
                            value={formData.primaryMuscle as string || ''} 
                            onChange={e => setFormData({...formData, primaryMuscle: e.target.value})}
                            className="h-14 font-medium bg-white/50"
                          >
                            <option value="">Select Muscle...</option>
                            {filteredMuscles.map(m => (
                              <option key={m.slug} value={m.slug}>{m.label}</option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </div>

                    {formData.primaryMuscle && (
                      <div className="col-span-12 pt-8 border-t border-[var(--color-border)]/50 animate-in slide-in-from-top-4 duration-300">
                        <Label className="mb-4 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">3. Secondary Muscles (Optional)</Label>
                        <div className="flex flex-wrap gap-2">
                          {muscleOptions.map(m => {
                            const isSelected = formData.secondaryMuscles?.includes(m.slug)
                            const isPrimary = formData.primaryMuscle === m.slug
                            if (isPrimary) return null
                            
                            return (
                              <button
                                type="button"
                                key={m.slug}
                                onClick={() => handleSecondaryMuscleChange(m.slug)}
                                className={cn(
                                  "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border-2 min-h-[40px]",
                                  isSelected 
                                    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-border)] shadow-sm" 
                                    : "bg-white/30 border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                                )}
                              >
                                {m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="col-span-12 pt-8 border-t border-[var(--color-border)]">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, e1rmEligible: !formData.e1rmEligible})}
                        className={cn(
                          "w-full flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-300 group min-h-[80px]",
                          formData.e1rmEligible 
                            ? "bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]" 
                            : "bg-white/50 border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                        )}
                      >
                        <div className={cn(
                          "p-3 rounded-xl transition-all duration-300",
                          formData.e1rmEligible 
                            ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-soft)]" 
                            : "bg-white text-[var(--color-text-subtle)] border border-[var(--color-border)]"
                        )}>
                          <Activity className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col items-start text-left gap-0.5">
                          <span className="font-black text-[12px] uppercase tracking-[0.1em]">E1RM Eligible</span>
                          <span className="text-xs font-medium opacity-70 leading-tight">Enable strength estimation & max effort tracking</span>
                        </div>
                        <div className="ml-auto">
                           <div className={cn(
                            "w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                            formData.e1rmEligible 
                              ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white" 
                              : "border-[var(--color-border-strong)] opacity-30"
                          )}>
                            <Check className={cn("w-4 h-4 stroke-[4px] transition-transform duration-300", formData.e1rmEligible ? "scale-100" : "scale-0")} />
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="col-span-12 bg-[var(--color-primary-soft)]/50 border border-[var(--color-primary-border)] rounded-2xl p-6 flex items-center gap-6 group transition-all hover:bg-[var(--color-primary-soft)] glass-panel">
                    <div className="p-4 bg-white rounded-xl text-[var(--color-primary)] shadow-sm group-hover:scale-110 transition-transform">
                      <Settings className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-[var(--color-primary-strong)] uppercase tracking-tight">Auto-configured for {exerciseType}</p>
                      <p className="text-sm text-[var(--color-text-muted)] font-medium">Core parameters are locked for this activity type.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Requirements */}
          <Card className="overflow-hidden glass-panel">
            <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]/50 py-5 px-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-primary-soft)] rounded-lg text-[var(--color-primary)]">
                  <Layers className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight">Requirements</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              {/* Equipment Pills */}
              <div className="space-y-6">
                <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">Required Equipment</Label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_KINDS.filter(item => {
                    if (exerciseType === 'Cardio') return item.value === 'machine';
                    if (exerciseType === 'Yoga') return ['block', 'bolster', 'strap', 'bodyweight'].includes(item.value);
                    return !['block', 'bolster', 'strap'].includes(item.value);
                  }).map(item => {
                    const isSelected = formData.equipment?.some(e => e.kind === item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleEquipmentChange(item.value)}
                        className={cn(
                          "flex items-center gap-2 px-5 py-3 rounded-xl border-2 text-[11px] font-black uppercase tracking-wider transition-all duration-200 min-h-[48px]",
                          isSelected
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md"
                            : "bg-white/30 text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                        )}
                      >
                        {item.label}
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[4px]" />}
                      </button>
                    )
                  })}
                </div>

                {/* Machine Type Sub-selector */}
                {machineOption && (
                  <div className="pt-4 animate-in zoom-in-95 fade-in duration-500">
                    <div className="p-6 bg-white/50 border border-[var(--color-border)] rounded-2xl space-y-5 shadow-inner">
                      <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">Select Machine Type</Label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {MACHINE_TYPES.map(m => {
                          const isActive = machineOption.machineType === m.value
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => handleEquipmentChange('machine', m.value)}
                              className={cn(
                                "py-3.5 px-4 rounded-xl border-2 text-[11px] font-black transition-all min-h-[48px]",
                                isActive 
                                  ? "bg-white text-[var(--color-primary)] border-[var(--color-primary)] shadow-md" 
                                  : "bg-[var(--color-surface-muted)] border-transparent text-[var(--color-text-muted)] hover:bg-white"
                              )}
                            >
                              {m.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-6 sm:px-8 bg-[var(--color-surface)]/80 backdrop-blur-2xl border-t border-[var(--color-border)] z-50 shadow-[0_-15px_50px_rgba(0,0,0,0.1)]">
        <div className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row justify-end gap-4 sm:gap-6">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold text-sm h-14 px-8 order-2 sm:order-1"
          >
            <X className="w-5 h-5 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="min-w-[200px] h-14 px-10 shadow-xl shadow-[var(--color-primary-soft)] text-sm font-black uppercase tracking-[0.1em] order-1 sm:order-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Settings className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                <Save className="w-5 h-5 mr-3" />
                Commit to Library
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
