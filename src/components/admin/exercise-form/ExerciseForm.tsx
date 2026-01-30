'use client'

import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  AlertCircle,
  Settings,
  Check,
  Activity
} from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { validateExercise } from '@/lib/validation/exercise-validation'
import { METRIC_PROFILE_OPTIONS, deriveMetricProfile } from '@/lib/metric-derivation'
import { getFocusAreaFromMuscle } from '@/lib/muscle-utils'
import type {
  Exercise, 
  EquipmentOption, 
  MachineType, 
  EquipmentKind
} from '@/types/domain'

// Sub-components
import { ExerciseTypeToggle } from './ExerciseTypeToggle'
import { MovementPatternSection } from './MovementPatternSection'
import { SecondaryMusclesSection } from './SecondaryMusclesSection'
import { EquipmentSection } from './EquipmentSection'
import { FormActionBar } from './FormActionBar'
import { type ExerciseType } from './constants'

type Props = {
  initialData?: Partial<Exercise>
  muscleOptions: { slug: string; label: string }[]
  onSubmit: (data: Exercise) => Promise<void>
  onCancel: () => void
}

export function ExerciseForm({ initialData, muscleOptions, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState<Partial<Exercise>>(initialData || {
    equipment: [],
    secondaryMuscles: [],
    metricProfile: 'reps_weight'
  })
  
  const [exerciseType, setExerciseType] = useState<ExerciseType>(() => {
    if (initialData?.category === 'Mobility') return 'Yoga'
    if (initialData?.category === 'Cardio') return 'Cardio'
    return 'Strength'
  })

  const [isAdvanced, setIsAdvanced] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Current metric profile option
  const currentOption = METRIC_PROFILE_OPTIONS.find(opt => {
    if (opt.backendProfile !== formData.metricProfile) return false
    if (opt.isInterval !== undefined) {
      return opt.isInterval === !!formData.isInterval
    }
    return true
  }) || METRIC_PROFILE_OPTIONS[0]

  // Auto-derive focus from primary muscle
  useEffect(() => {
    if (formData.primaryMuscle && exerciseType === 'Strength') {
      const derivedFocus = getFocusAreaFromMuscle(formData.primaryMuscle)
      if (derivedFocus && formData.focus !== derivedFocus) {
        setFormData(prev => ({ ...prev, focus: derivedFocus }))
      }
    }
  }, [formData.primaryMuscle, exerciseType, formData.focus])

  // -- Handlers --

  const handleProfileChange = (virtualValue: string) => {
    const option = METRIC_PROFILE_OPTIONS.find(o => o.value === virtualValue)
    if (!option) return
    setFormData(prev => ({
      ...prev,
      metricProfile: option.backendProfile,
      isInterval: option.isInterval
    }))
  }

  const handleTypeChange = (type: ExerciseType) => {
    setExerciseType(type)
    
    const getValidEquipment = (currentEq: EquipmentOption[]) => {
      return currentEq.filter(item => {
        if (type === 'Cardio') return item.kind === 'machine'
        if (type === 'Yoga') return ['block', 'bolster', 'strap', 'bodyweight'].includes(item.kind)
        return !['block', 'bolster', 'strap'].includes(item.kind)
      })
    }

    const allSecondaryMuscles = muscleOptions
      .map(m => m.slug)
      .filter(s => s !== 'full_body')

    if (type === 'Yoga') {
      const derived = deriveMetricProfile('Mobility', undefined)
      setFormData(prev => ({
        ...prev,
        category: 'Mobility',
        focus: 'full_body',
        primaryMuscle: 'full_body',
        secondaryMuscles: allSecondaryMuscles,
        equipment: getValidEquipment(prev.equipment || []),
        metricProfile: derived.option.backendProfile,
        isInterval: derived.option.isInterval
      }))
    } else if (type === 'Cardio') {
      const derived = deriveMetricProfile('Cardio', undefined)
      setFormData(prev => ({
        ...prev,
        category: 'Cardio',
        focus: 'full_body',
        primaryMuscle: 'full_body',
        secondaryMuscles: allSecondaryMuscles,
        equipment: getValidEquipment(prev.equipment || []),
        metricProfile: derived.option.backendProfile,
        isInterval: derived.option.isInterval
      }))
    } else {
      const derived = deriveMetricProfile('Strength', undefined)
      setFormData(prev => ({
        ...prev,
        category: 'Strength',
        focus: prev.primaryMuscle ? getFocusAreaFromMuscle(prev.primaryMuscle) : undefined,
        equipment: getValidEquipment(prev.equipment || []),
        metricProfile: derived.option.backendProfile,
        isInterval: derived.option.isInterval
      }))
    }
  }

  const handleEquipmentChange = (kind: EquipmentKind, machineType?: MachineType) => {
    setFormData(prev => {
      const current: EquipmentOption[] = prev.equipment || []
      
      if (kind === 'bench_press') {
        const hasBenchRequirement = current.some(e => e.requires?.includes('bench_press'))
        const next: EquipmentOption[] = current
          .filter(e => e.kind !== 'bench_press')
          .map((e): EquipmentOption => {
            if (e.kind !== 'barbell' && e.kind !== 'dumbbell') return e
            if (!hasBenchRequirement) {
              const requires = Array.from(new Set([...(e.requires ?? []), 'bench_press' as const]))
              return { ...e, requires }
            }
            const requires = (e.requires ?? []).filter(req => req !== 'bench_press')
            if (requires.length === 0) {
              // Omit the requires property - for barbell/dumbbell, just return the kind
              return { kind: e.kind } as EquipmentOption
            }
            return { ...e, requires }
          })
        return { ...prev, equipment: next }
      }
      
      const existing = current.find(e => e.kind === kind)
      
      if (existing) {
        if (kind === 'machine' && machineType && existing.kind === 'machine' && existing.machineType !== machineType) {
          const updated: EquipmentOption[] = current.map(e => 
            e.kind === 'machine' ? { kind: 'machine' as const, machineType } : e
          )
          return { ...prev, equipment: updated }
        }
        return { ...prev, equipment: current.filter(e => e.kind !== kind) }
      }
      
      const newItem: EquipmentOption = kind === 'machine' 
        ? { kind: 'machine' as const, machineType: machineType || 'cable' } 
        : { kind }
      return { ...prev, equipment: [...current, newItem] }
    })
  }

  const handleSecondaryMuscleChange = (slug: string) => {
    setFormData(prev => {
      const current = prev.secondaryMuscles || []
      const exists = current.includes(slug)
      const updated = exists
        ? current.filter(m => m !== slug)
        : [...current, slug]
      return { ...prev, secondaryMuscles: updated }
    })
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
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

  const showEquipmentSection = exerciseType !== 'Strength' || 
    (formData.movementPattern && formData.primaryMuscle)

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
      <ExerciseTypeToggle value={exerciseType} onChange={handleTypeChange} />

      <div className="grid grid-cols-12 gap-8">
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
                <div className="flex items-center gap-4">
                  {exerciseType === 'Strength' && formData.movementPattern && (
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-[var(--color-surface-muted)] text-[var(--color-text-subtle)] border border-[var(--color-border)]">
                      {formData.movementPattern}
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <Label htmlFor="advMode" className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] cursor-pointer select-none">
                      Advanced
                    </Label>
                    <Checkbox 
                      id="advMode" 
                      checked={isAdvanced} 
                      onCheckedChange={(c) => setIsAdvanced(c === true)}
                      className="w-5 h-5"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-12 gap-8">
                
                {/* Movement Pattern & Primary Muscle (Strength only) */}
                {exerciseType === 'Strength' && (
                  <>
                    <MovementPatternSection
                      formData={formData}
                      muscleOptions={muscleOptions}
                      onPatternChange={(pattern) => setFormData({...formData, movementPattern: pattern})}
                      onPrimaryMuscleChange={(_, updates) => setFormData({...formData, ...updates})}
                    />
                    
                    {/* Secondary Muscles */}
                    {formData.primaryMuscle !== 'full_body' && (
                      <div className="col-span-12">
                        <SecondaryMusclesSection
                          formData={formData}
                          muscleOptions={muscleOptions}
                          onSecondaryMuscleToggle={handleSecondaryMuscleChange}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Exercise Name */}
                <div className={cn(
                  "col-span-12",
                  isAdvanced ? "md:col-span-8" : "col-span-12",
                  exerciseType === 'Strength' && "pt-6 border-t border-[var(--color-border)]/50"
                )}>
                  <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
                    Exercise Name
                  </Label>
                  <Input 
                    value={formData.name || ''} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder={
                      exerciseType === 'Cardio' 
                        ? "e.g. 5k Run" 
                        : exerciseType === 'Yoga' 
                          ? "e.g. Sun Salutation" 
                          : "e.g. Barbell Bench Press"
                    }
                    className="font-bold text-xl h-14 bg-white/50"
                  />
                </div>

                {isAdvanced && (
                  <div className="col-span-12 md:col-span-4 animate-in slide-in-from-right-4">
                    <Label className="mb-3 block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
                      Tracking Style
                    </Label>
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

                {/* Equipment Selection */}
                {showEquipmentSection && (
                  <EquipmentSection
                    formData={formData}
                    exerciseType={exerciseType}
                    onEquipmentChange={handleEquipmentChange}
                    onEquipmentModeChange={(mode) => setFormData({...formData, equipmentMode: mode})}
                    onAdditionalEquipmentModeChange={(mode) => setFormData({...formData, additionalEquipmentMode: mode})}
                  />
                )}

                {/* E1RM Eligible Toggle (Strength only) */}
                {exerciseType === 'Strength' && (
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
                )}

                {/* Auto-configured message (non-Strength) */}
                {exerciseType !== 'Strength' && (
                  <div className="col-span-12 bg-[var(--color-primary-soft)]/50 border border-[var(--color-primary-border)] rounded-2xl p-6 flex items-center gap-6 group transition-all hover:bg-[var(--color-primary-soft)] glass-panel">
                    <div className="p-4 bg-white rounded-xl text-[var(--color-primary)] shadow-sm group-hover:scale-110 transition-transform">
                      <Settings className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-[var(--color-primary-strong)] uppercase tracking-tight">
                        Auto-configured for {exerciseType}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)] font-medium">
                        Core parameters are locked for this activity type.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <FormActionBar
        isSubmitting={isSubmitting}
        onSubmit={() => handleSubmit()}
        onCancel={onCancel}
      />
    </div>
  )
}
