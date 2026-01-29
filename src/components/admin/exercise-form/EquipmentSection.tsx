'use client'

import { Check } from 'lucide-react'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { 
  EQUIPMENT_KINDS, 
  MACHINE_TYPES, 
  OR_GROUPS,
  type ExerciseType 
} from './constants'
import type { 
  Exercise, 
  EquipmentKind, 
  MachineType, 
  EquipmentOrGroup 
} from '@/types/domain'

type Props = {
  formData: Partial<Exercise>
  exerciseType: ExerciseType
  onEquipmentChange: (kind: EquipmentKind, machineType?: MachineType) => void
  onOrGroupChange: (orGroup: EquipmentOrGroup | undefined) => void
}

/**
 * Equipment selection including machine types and substitution groups
 */
export function EquipmentSection({ 
  formData, 
  exerciseType, 
  onEquipmentChange,
  onOrGroupChange
}: Props) {
  const machineOption = formData.equipment?.find(e => e.kind === 'machine')
  const machineType = machineOption?.kind === 'machine' ? machineOption.machineType : undefined

  // Filter equipment kinds based on exercise type
  const filteredEquipmentKinds = EQUIPMENT_KINDS.filter(item => {
    if (exerciseType === 'Cardio') return item.value === 'machine'
    if (exerciseType === 'Yoga') return ['block', 'bolster', 'strap', 'bodyweight'].includes(item.value)
    return !['block', 'bolster', 'strap'].includes(item.value)
  })

  return (
    <div className="col-span-12 pt-6 border-t border-[var(--color-border)]/50 animate-in slide-in-from-top-4 duration-300">
      <Label className="block text-[var(--color-text-subtle)] uppercase text-[10px] font-black tracking-[0.2em] mb-4">
        Required Equipment
      </Label>
      <div className="flex flex-wrap gap-2">
        {filteredEquipmentKinds.map(item => {
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

      {/* OR-Group Selector - Equipment Substitution */}
      {exerciseType === 'Strength' && (formData.equipment?.length ?? 0) > 1 && (
        <div className="pt-4 animate-in zoom-in-95 fade-in duration-500">
          <div className="p-6 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl space-y-5">
            <div>
              <Label className="block text-amber-700 dark:text-amber-400 uppercase text-[10px] font-black tracking-widest">
                Equipment Substitution Group (Optional)
              </Label>
              <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-1">
                Allow any equipment in the group to satisfy this requirement
              </p>
            </div>
            <Select 
              value={formData.orGroup || ''} 
              onChange={(e) => onOrGroupChange(e.target.value as EquipmentOrGroup || undefined)}
            >
              <option value="">No substitution (AND logic)</option>
              {OR_GROUPS.map(g => (
                <option key={g.value} value={g.value}>{g.label} — {g.description}</option>
              ))}
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
