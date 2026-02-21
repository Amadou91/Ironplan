'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Props = {
  isOpen: boolean
  isEditing: boolean
  weight: string
  date: string
  saving: boolean
  displayUnit: string
  onWeightChange: (value: string) => void
  onDateChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

/**
 * Modal for logging or editing body weight entries
 */
export function WeightLogModal({
  isOpen,
  isEditing,
  weight,
  date,
  saving,
  displayUnit,
  onWeightChange,
  onDateChange,
  onSave,
  onClose
}: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="surface-elevated w-full max-w-sm overflow-hidden flex flex-col p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-strong">
            {isEditing ? 'Edit weight' : 'Log body weight'}
          </h3>
          <p className="text-xs text-subtle">Enter your weight and the date recorded.</p>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase font-bold text-subtle">
              Weight ({displayUnit})
            </label>
            <Input 
              type="text" 
              inputMode="decimal" 
              placeholder="0.0" 
              value={weight} 
              onChange={(e) => { 
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) onWeightChange(val)
              }} 
              disabled={saving} 
              autoFocus 
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase font-bold text-subtle">Date</label>
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => onDateChange(e.target.value)} 
              disabled={saving} 
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button 
            variant="outline" 
            className="flex-1" 
            onClick={onClose} 
            disabled={saving}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1" 
            onClick={onSave} 
            disabled={saving || !weight || !date}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
