'use client'

import { Check, Link2, Unlink } from 'lucide-react'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { 
  EQUIPMENT_KINDS, 
  MACHINE_TYPES,
  type ExerciseType 
} from './constants'
import type { 
  Exercise, 
  EquipmentKind, 
  MachineType,
  EquipmentRequirementMode,
  AdditionalEquipmentMode
} from '@/types/domain'
import { FREE_WEIGHT_EQUIPMENT } from '@/types/domain'

type Props = {
  formData: Partial<Exercise>
  exerciseType: ExerciseType
  onEquipmentChange: (kind: EquipmentKind, machineType?: MachineType) => void
  onEquipmentModeChange: (mode: EquipmentRequirementMode) => void
  onAdditionalEquipmentModeChange: (mode: AdditionalEquipmentMode) => void
}

/**
 * Equipment selection with explicit OR/AND logic for free-weight equipment
 * and Required/Optional toggle for bench and machine equipment.
 */
export function EquipmentSection({ 
  formData, 
  exerciseType, 
  onEquipmentChange,
  onEquipmentModeChange,
  onAdditionalEquipmentModeChange
}: Props) {
  const machineOption = formData.equipment?.find(e => e.kind === 'machine')
  const machineType = machineOption?.kind === 'machine' ? machineOption.machineType : undefined
  
  // Current equipment mode (default to 'or' for strength exercises)
  const equipmentMode = formData.equipmentMode ?? 'or'
  const additionalEquipmentMode = formData.additionalEquipmentMode ?? 'required'

  // Filter equipment kinds based on exercise type
  const filteredEquipmentKinds = EQUIPMENT_KINDS.filter(item => {
    if (exerciseType === 'Cardio') return item.value === 'machine'
    if (exerciseType === 'Yoga') return ['block', 'bolster', 'strap', 'bodyweight'].includes(item.value)
    return !['block', 'bolster', 'strap'].includes(item.value)
  })

  // Separate equipment into categories
  const freeWeightEquipment = filteredEquipmentKinds.filter(
    item => FREE_WEIGHT_EQUIPMENT.includes(item.value)
  )
  const additionalEquipment = filteredEquipmentKinds.filter(
    item => item.value === 'bench_press' || item.value === 'machine'
  )

  // Check which equipment is selected
  const selectedFreeWeight = freeWeightEquipment.filter(item => 
    formData.equipment?.some(e => e.kind === item.value)
  )
  const hasBenchOrMachine = formData.equipment?.some(e => 
    e.kind === 'bench_press' || e.kind === 'machine' || e.requires?.includes('bench_press')
  )
  
  // Show OR/AND toggle when multiple free-weight equipment selected
  const showEquipmentModeToggle = exerciseType === 'Strength' && selectedFreeWeight.length > 1

  return (
    <div className="col-span-12 pt-6 border-t border-[var(--color-border)]/50 animate-in slide-in-from-top-4 duration-300">
      
      {/* Free-Weight Equipment Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
            Primary Equipment
          </Label>
          {showEquipmentModeToggle && (
            <span className="text-[10px] text-muted font-medium">
              {equipmentMode === 'or' ? 'Any one satisfies requirement' : 'All must be available'}
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {freeWeightEquipment.map(item => {
            const isSelected = formData.equipment?.some(e => e.kind === item.value)
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onEquipmentChange(item.value)}
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
        
        {/* OR/AND Toggle for Free-Weight Equipment */}
        {showEquipmentModeToggle && (
          <div className="pt-3 animate-in fade-in duration-300">
            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl">
              <Label className="block text-blue-700 dark:text-blue-400 uppercase text-[10px] font-black tracking-widest mb-3">
                Equipment Logic
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEquipmentModeChange('or')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-[11px] font-bold transition-all",
                    equipmentMode === 'or'
                      ? "bg-blue-500 text-white border-blue-500 shadow-md"
                      : "bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-blue-300"
                  )}
                >
                  <Unlink className="w-4 h-4" />
                  <span>OR</span>
                  <span className="text-[9px] opacity-70 ml-1">(Any one)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEquipmentModeChange('and')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-[11px] font-bold transition-all",
                    equipmentMode === 'and'
                      ? "bg-blue-500 text-white border-blue-500 shadow-md"
                      : "bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-blue-300"
                  )}
                >
                  <Link2 className="w-4 h-4" />
                  <span>AND</span>
                  <span className="text-[9px] opacity-70 ml-1">(All required)</span>
                </button>
              </div>
              <p className="text-xs text-blue-600/70 dark:text-blue-500/70 mt-3">
                {equipmentMode === 'or' 
                  ? `${selectedFreeWeight.map(e => e.label).join(' OR ')} — user needs any one of these`
                  : `${selectedFreeWeight.map(e => e.label).join(' AND ')} — user needs all of these`
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Additional Equipment Section (Bench, Machine) */}
      {exerciseType === 'Strength' && (
        <div className="mt-6 pt-6 border-t border-[var(--color-border)]/30 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em]">
              Additional Equipment
            </Label>
            {hasBenchOrMachine && (
              <span className={cn(
                "text-[10px] font-medium",
                additionalEquipmentMode === 'required' ? "text-amber-600" : "text-green-600"
              )}>
                {additionalEquipmentMode === 'required' ? 'Required (AND)' : 'Optional (OR)'}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {additionalEquipment.map(item => {
              const isSelected = item.value === 'bench_press'
                ? formData.equipment?.some(e => e.requires?.includes('bench_press') || e.kind === 'bench_press')
                : formData.equipment?.some(e => e.kind === item.value)
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onEquipmentChange(item.value)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 rounded-xl border-2 text-[11px] font-black uppercase tracking-wider transition-all duration-200 min-h-[48px]",
                    isSelected
                      ? "bg-amber-500 text-white border-amber-500 shadow-md"
                      : "bg-white/30 text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                  )}
                >
                  {item.label}
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[4px]" />}
                </button>
              )
            })}
          </div>
          
          {/* Required/Optional Toggle for Additional Equipment */}
          {hasBenchOrMachine && (
            <div className="pt-3 animate-in fade-in duration-300">
              <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                <Label className="block text-amber-700 dark:text-amber-400 uppercase text-[10px] font-black tracking-widest mb-3">
                  Requirement Mode
                </Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAdditionalEquipmentModeChange('required')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-[11px] font-bold transition-all",
                      additionalEquipmentMode === 'required'
                        ? "bg-amber-500 text-white border-amber-500 shadow-md"
                        : "bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-300"
                    )}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>REQUIRED</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdditionalEquipmentModeChange('optional')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-[11px] font-bold transition-all",
                      additionalEquipmentMode === 'optional'
                        ? "bg-green-500 text-white border-green-500 shadow-md"
                        : "bg-white border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-green-300"
                    )}
                  >
                    <Unlink className="w-4 h-4" />
                    <span>OPTIONAL</span>
                  </button>
                </div>
                <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-3">
                  {additionalEquipmentMode === 'required' 
                    ? 'Equipment must be available for exercise to be selected'
                    : 'Exercise can be selected without this equipment (preferred only)'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Machine Type Sub-selector */}
      {machineOption && (
        <div className="pt-4 animate-in zoom-in-95 fade-in duration-500">
          <div className="p-6 bg-white/50 border border-[var(--color-border)] rounded-2xl space-y-5 shadow-inner">
            <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-widest">
              Select Machine Type
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {MACHINE_TYPES.map(m => {
                const isActive = machineType === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => onEquipmentChange('machine', m.value)}
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
  )
}
