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
  { label: 'Machine', value: 'machine' }
]

const MACHINE_TYPES: { label: string; value: MachineType }[] = [
  { label: 'Cable', value: 'cable' },
  { label: 'Leg Press', value: 'leg_press' },
  { label: 'Treadmill', value: 'treadmill' },
  { label: 'Rower', value: 'rower' },
  { label: 'Indoor Bicycle', value: 'indoor_bicycle' }
]

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
    if (!isAdvanced && formData.primaryMuscle && exerciseType === 'Strength') {
      const derivedFocus = getFocusAreaFromMuscle(formData.primaryMuscle);
      if (derivedFocus && formData.focus !== derivedFocus) {
        setFormData(prev => ({ ...prev, focus: derivedFocus }));
      }
    }
  }, [formData.primaryMuscle, isAdvanced, exerciseType, formData.focus])

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
    <div className="pb-32 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      
      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="alert-error p-5 flex gap-4 shadow-lg animate-in slide-in-from-top-4">
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
      <div className="flex p-1.5 bg-[var(--color-surface-muted)] rounded-2xl border border-[var(--color-border)] shadow-inner">
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
                "flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl font-bold transition-all duration-300",
                isSelected 
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-md ring-1 ring-[var(--color-border-strong)] scale-[1.02]" 
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]"
              )}
            >
              <Icon className="w-4.5 h-4.5" />
              {type.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Left Column: Core Definition */}
        <div className="col-span-12 lg:col-span-10 lg:col-start-2 space-y-8">
          
          {/* Section 1: Identity */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] py-5 px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-primary-soft)] rounded-lg text-[var(--color-primary)]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg font-bold tracking-tight">Identity</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="advMode" 
                    checked={isAdvanced} 
                    onCheckedChange={(c) => setIsAdvanced(c === true)}
                  />
                  <Label htmlFor="advMode" className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest cursor-pointer select-none">Advanced</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-12 gap-6">
                <div className={cn(
                  "col-span-12",
                  isAdvanced ? "md:col-span-8" : "col-span-12"
                )}>
                  <Label className="mb-2.5 block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Exercise Name</Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder={exerciseType === 'Cardio' ? "e.g. 5k Run" : "e.g. Barbell Bench Press"}
                    className="font-bold text-xl h-14"
                  />
                </div>

                {isAdvanced && (
                  <div className="col-span-12 md:col-span-4">
                    <Label className="mb-2.5 block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Tracking Style</Label>
                    <Select 
                      value={currentOption.value} 
                      onChange={e => handleProfileChange(e.target.value)}
                      className="h-14 font-semibold"
                    >
                      {METRIC_PROFILE_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </Select>
                  </div>
                )}

                {exerciseType === 'Strength' ? (
                  <>
                    <div className={cn(
                      "col-span-12",
                      isAdvanced ? "md:col-span-4" : "md:col-span-6"
                    )}>
                      <Label className="mb-2.5 block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Primary Muscle</Label>
                      <Select 
                        value={formData.primaryMuscle as string || ''} 
                        onChange={e => setFormData({...formData, primaryMuscle: e.target.value})}
                        className="h-12 font-medium"
                      >
                        <option value="">Select Muscle...</option>
                        {muscleOptions.map(m => (
                          <option key={m.slug} value={m.slug}>{m.label}</option>
                        ))}
                      </Select>
                    </div>

                    {isAdvanced && (
                      <div className="col-span-12 md:col-span-4">
                        <Label className="mb-2.5 block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Focus Area</Label>
                        <Select 
                          value={formData.focus || ''} 
                          onChange={e => setFormData({...formData, focus: e.target.value as FocusArea})}
                          className="h-12 font-medium"
                        >
                          <option value="">Select Focus...</option>
                          {FOCUS_AREAS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </Select>
                      </div>
                    )}

                    <div className={cn(
                      "col-span-12",
                      isAdvanced ? "md:col-span-4" : "md:col-span-6"
                    )}>
                      <Label className="mb-2.5 block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Primary Goal</Label>
                      <Select 
                        value={formData.goal || ''} 
                        onChange={e => setFormData({...formData, goal: e.target.value as Goal})}
                        className="h-12 font-medium"
                      >
                        <option value="">Select Goal...</option>
                        {availableGoals.map(g => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </Select>
                      <p className="mt-1.5 text-[10px] text-muted italic">Sets the default prescription baseline.</p>
                    </div>

                    <div className="col-span-12 pt-4 border-t border-[var(--color-border)]/50">
                      <Label className="mb-4 block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Also Eligible For</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableGoals.map(g => {
                          const isSelected = formData.eligibleGoals?.includes(g.value)
                          const isPrimary = formData.goal === g.value
                          if (isPrimary) return null
                          
                          return (
                            <button
                              type="button"
                              key={g.value}
                              onClick={() => {
                                const current = formData.eligibleGoals || []
                                const next = isSelected 
                                  ? current.filter(v => v !== g.value)
                                  : [...current, g.value]
                                setFormData({ ...formData, eligibleGoals: next })
                              }}
                              className={cn(
                                "px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border-2",
                                isSelected 
                                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] border-[var(--color-primary-border)] shadow-sm" 
                                  : "bg-transparent border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]"
                              )}
                            >
                              {g.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="col-span-12 pt-6 border-t border-[var(--color-border)]">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, e1rmEligible: !formData.e1rmEligible})}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 group",
                          formData.e1rmEligible 
                            ? "bg-[var(--color-primary-soft)] border-[var(--color-primary-border)] text-[var(--color-primary-strong)]" 
                            : "bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                        )}
                      >
                        <div className={cn(
                          "p-2.5 rounded-xl transition-all duration-300",
                          formData.e1rmEligible 
                            ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-soft)]" 
                            : "bg-[var(--color-surface)] text-[var(--color-text-subtle)] border border-[var(--color-border)]"
                        )}>
                          <Activity className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col items-start text-left gap-0.5">
                          <span className="font-black text-[11px] uppercase tracking-widest">E1RM Eligible</span>
                          <span className="text-[10px] font-medium opacity-70 leading-tight">Enable strength estimation & max effort tracking</span>
                        </div>
                        <div className="ml-auto">
                           <div className={cn(
                            "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                            formData.e1rmEligible 
                              ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white rotate-0" 
                              : "border-[var(--color-border-strong)] opacity-30"
                          )}>
                            <Check className={cn("w-3.5 h-3.5 stroke-[4px] transition-transform duration-300", formData.e1rmEligible ? "scale-100" : "scale-0")} />
                          </div>
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="col-span-12 bg-[var(--color-primary-soft)]/50 border border-[var(--color-primary-border)] rounded-2xl p-5 flex items-center gap-5 group transition-all hover:bg-[var(--color-primary-soft)]">
                    <div className="p-3 bg-[var(--color-surface)] rounded-xl text-[var(--color-primary)] shadow-sm group-hover:scale-110 transition-transform">
                      <Settings className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-black text-[var(--color-primary-strong)] uppercase tracking-tight">Auto-configured for {exerciseType}</p>
                      <p className="text-sm text-[var(--color-text-muted)] font-medium">Core parameters are locked for this activity type.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Requirements & Muscles */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] py-5 px-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-primary-soft)] rounded-lg text-[var(--color-primary)]">
                  <Layers className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg font-bold tracking-tight">Requirements</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              
              {/* Equipment Pills */}
              <div className="space-y-5">
                <Label className="block text-[var(--color-text-subtle)] uppercase text-[11px] font-black tracking-[0.15em]">Required Equipment</Label>
                <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                  {EQUIPMENT_KINDS.map(item => {
                    const isSelected = formData.equipment?.some(e => e.kind === item.value)
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleEquipmentChange(item.value)}
                        className={cn(
                          "whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all duration-200 shrink-0",
                          isSelected
                            ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm ring-2 ring-[var(--color-primary-soft)]"
                            : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]"
                        )}
                      >
                        {item.label}
                        {isSelected && <Check className="w-3 h-3 stroke-[4px]" />}
                      </button>
                    )
                  })}
                </div>

                {/* Machine Type Sub-selector */}
                {machineOption && (
                  <div className="pt-4 animate-in zoom-in-95 fade-in duration-300">
                    <div className="p-6 bg-[var(--color-surface-subtle)] border border-[var(--color-border)] rounded-2xl space-y-4">
                      <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">Select Machine Type</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {MACHINE_TYPES.map(m => {
                          const isActive = machineOption.machineType === m.value
                          return (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => handleEquipmentChange('machine', m.value)}
                              className={cn(
                                "py-3 px-4 rounded-xl border text-xs font-bold transition-all",
                                isActive 
                                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] border-[var(--color-primary-border)] shadow-sm ring-2 ring-[var(--color-primary-soft)]" 
                                  : "bg-[var(--color-surface-muted)] border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
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

        {/* Right Column was Standards, now empty/removed */}
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-[var(--color-surface)]/80 backdrop-blur-xl border-t border-[var(--color-border)] z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-5xl w-full mx-auto flex justify-end gap-5">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-bold text-sm h-12 px-8"
          >
            <X className="w-5 h-5 mr-2" />
            Cancel Changes
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="min-w-[180px] h-12 px-10 shadow-xl shadow-[var(--color-primary-soft)] text-sm font-black uppercase tracking-wider"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2.5" />
                Commit to Library
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
