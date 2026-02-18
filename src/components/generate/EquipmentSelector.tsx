'use client'

import { Checkbox } from '@/components/ui/Checkbox'
import {
  bandLabels,
  machineLabels,
  BARBELL_PLATE_OPTIONS
} from '@/lib/equipment'
import type { BandResistance, MachineType, PlanInput } from '@/types/domain'

type WeightField = 'dumbbells' | 'kettlebells'

type WeightRange = {
  label: string
  weights: readonly number[]
}

const WEIGHT_RANGE_CONFIG: {
  field: WeightField
  label: string
  ranges: WeightRange[]
}[] = [
  {
    field: 'dumbbells',
    label: 'Dumbbells',
    ranges: [
      { label: '5-15 lb', weights: [5, 8, 10, 12, 15] },
      { label: '20-30 lb', weights: [20, 25, 30] },
      { label: '35-50 lb', weights: [35, 40, 45, 50] },
      { label: '55-60 lb', weights: [55, 60] }
    ]
  },
  {
    field: 'kettlebells',
    label: 'Kettlebells',
    ranges: [
      { label: '10-20 lb', weights: [10, 15, 20] },
      { label: '25-35 lb', weights: [25, 30, 35] },
      { label: '40-50 lb', weights: [40, 45, 50] },
      { label: '60 lb', weights: [60] }
    ]
  }
]

export const cardioMachineOptions: MachineType[] = ['treadmill', 'rower', 'indoor_bicycle', 'outdoor_bicycle']
export const strengthMachineOptions: MachineType[] = ['cable', 'leg_press']

type WeightRangeSelectorProps = {
  field: WeightField
  label: string
  ranges: WeightRange[]
  selected: number[]
  onToggleRange: (weights: readonly number[]) => void
}

const WeightRangeSelector = ({ field, label, ranges, selected, onToggleRange }: WeightRangeSelectorProps) => (
  <div className="space-y-3">
    <p className="text-sm font-semibold text-strong">{label}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ranges.map((range) => {
        const allSelected = range.weights.every(weight => selected.includes(weight))
        const someSelected = !allSelected && range.weights.some(weight => selected.includes(weight))
        return (
          <Checkbox
            key={`${field}-${range.label}`}
            label={range.label}
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={() => onToggleRange(range.weights)}
          />
        )
      })}
    </div>
  </div>
)

interface EquipmentSelectorProps {
  equipment: PlanInput['equipment']
  isCardioStyle: boolean
  isMobilityStyle: boolean
  onUpdateEquipment: (updater: (prev: PlanInput['equipment']) => PlanInput['equipment']) => void
}

export function EquipmentSelector({
  equipment,
  isCardioStyle,
  isMobilityStyle,
  onUpdateEquipment
}: EquipmentSelectorProps) {
  const { inventory } = equipment

  const toggleArrayValue = <T,>(values: T[], value: T) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]

  const toggleInventoryWeights = (field: WeightField, weights: readonly number[]) => {
    onUpdateEquipment(prev => {
      const nextWeights = new Set(prev.inventory[field])
      const hasAll = weights.every(weight => nextWeights.has(weight))
      weights.forEach(weight => {
        if (hasAll) {
          nextWeights.delete(weight)
        } else {
          nextWeights.add(weight)
        }
      })
      return {
        ...prev,
        preset: 'custom',
        inventory: {
          ...prev.inventory,
          [field]: Array.from(nextWeights).sort((a, b) => a - b)
        }
      }
    })
  }

  const toggleBarbellPlate = (weight: typeof BARBELL_PLATE_OPTIONS[number]) => {
    onUpdateEquipment(prev => {
      const hasWeight = prev.inventory.barbell.plates.includes(weight)
      const nextPlates = hasWeight
        ? prev.inventory.barbell.plates.filter(item => item !== weight)
        : [...prev.inventory.barbell.plates, weight]
      return {
        ...prev,
        preset: 'custom',
        inventory: {
          ...prev.inventory,
          barbell: {
            available: hasWeight ? prev.inventory.barbell.available : true,
            plates: nextPlates.sort((a, b) => a - b)
          }
        }
      }
    })
  }

  return (
    <div className="space-y-5">
      {!isCardioStyle && !isMobilityStyle && (
        <>
          <div className="surface-card-subtle p-5">
            <div className="border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Free weights</h3>
            </div>
            <div className="mt-4 space-y-6">
              <div className="space-y-5">
                {WEIGHT_RANGE_CONFIG.map((fieldConfig) => (
                  <WeightRangeSelector
                    key={fieldConfig.field}
                    field={fieldConfig.field}
                    label={fieldConfig.label}
                    ranges={fieldConfig.ranges}
                    selected={inventory[fieldConfig.field]}
                    onToggleRange={(weights) => toggleInventoryWeights(fieldConfig.field, weights)}
                  />
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-strong">Barbell + plates</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Checkbox
                    label="Barbell available"
                    checked={inventory.barbell.available}
                    onCheckedChange={() =>
                      onUpdateEquipment(prev => ({
                        ...prev,
                        preset: 'custom',
                        inventory: {
                          ...prev.inventory,
                          barbell: {
                            ...prev.inventory.barbell,
                            available: !prev.inventory.barbell.available
                          }
                        }
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BARBELL_PLATE_OPTIONS.map((plate) => (
                    <Checkbox
                      key={`barbell-${plate}`}
                      label={`${plate} lb`}
                      checked={inventory.barbell.plates.includes(plate)}
                      onCheckedChange={() => toggleBarbellPlate(plate)}
                      disabled={!inventory.barbell.available}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-subtle">Plate options are enabled when barbell is available.</p>
              </div>
            </div>
          </div>

          <div className="surface-card-subtle p-5">
            <div className="border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Machines</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Checkbox
                label="Bench Press available"
                checked={inventory.benchPress}
                onCheckedChange={() =>
                  onUpdateEquipment(prev => ({
                    ...prev,
                    preset: 'custom',
                    inventory: {
                      ...prev.inventory,
                      benchPress: !prev.inventory.benchPress
                    }
                  }))
                }
              />
              {strengthMachineOptions.map(machine => (
                <Checkbox
                  key={machine}
                  label={machineLabels[machine]}
                  checked={inventory.machines[machine]}
                  onCheckedChange={() =>
                    onUpdateEquipment(prev => ({
                      ...prev,
                      preset: 'custom',
                      inventory: {
                        ...prev.inventory,
                        machines: {
                          ...prev.inventory.machines,
                          [machine]: !prev.inventory.machines[machine]
                        }
                      }
                    }))
                  }
                />
              ))}
              {cardioMachineOptions.map(machine => (
                <Checkbox
                  key={machine}
                  label={machineLabels[machine]}
                  checked={inventory.machines[machine]}
                  onCheckedChange={() =>
                    onUpdateEquipment(prev => ({
                      ...prev,
                      preset: 'custom',
                      inventory: {
                        ...prev.inventory,
                        machines: {
                          ...prev.inventory.machines,
                          [machine]: !prev.inventory.machines[machine]
                        }
                      }
                    }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="surface-card-subtle p-5">
            <div className="border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Resistance & bodyweight</h3>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-strong">Bands</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['light', 'medium', 'heavy'] as BandResistance[]).map(level => (
                    <Checkbox
                      key={level}
                      label={bandLabels[level]}
                      checked={inventory.bands.includes(level)}
                      onCheckedChange={() =>
                        onUpdateEquipment(prev => ({
                          ...prev,
                          preset: 'custom',
                          inventory: {
                            ...prev.inventory,
                            bands: toggleArrayValue(prev.inventory.bands, level)
                          }
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-strong">Bodyweight</p>
                <Checkbox
                  label="Bodyweight movements"
                  checked={inventory.bodyweight}
                  onCheckedChange={() =>
                    onUpdateEquipment(prev => ({
                      ...prev,
                      preset: 'custom',
                      inventory: {
                        ...prev.inventory,
                        bodyweight: !prev.inventory.bodyweight
                      }
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}

      {isCardioStyle && (
        <>
          <div className="surface-card-subtle p-5">
            <div className="border-b border-[var(--color-border)] pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Cardio equipment</h3>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-strong">Machines</p>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cardioMachineOptions.map(machine => (
                    <Checkbox
                      key={machine}
                      label={machineLabels[machine]}
                      checked={inventory.machines[machine]}
                      onCheckedChange={() =>
                        onUpdateEquipment(prev => ({
                          ...prev,
                          preset: 'custom',
                          inventory: {
                            ...prev.inventory,
                            machines: {
                              ...prev.inventory.machines,
                              [machine]: !prev.inventory.machines[machine]
                            }
                          }
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isMobilityStyle && (
        <div className="surface-card-subtle p-5">
          <div className="border-b border-[var(--color-border)] pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-strong">Essentials</h3>
          </div>
          <div className="mt-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-strong">Bodyweight</p>
              <Checkbox
                label="Bodyweight movements"
                checked={true}
                disabled={true}
                onCheckedChange={() => {}}
              />
              <p className="mt-2 text-xs text-subtle">Yoga / Mobility requires bodyweight movements.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
