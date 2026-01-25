'use client'

import React, { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel } from '@/lib/muscle-utils'
import type { FocusArea, Goal, EquipmentInventory } from '@/types/domain'

interface SessionPreviewProps {
  focus: FocusArea
  style: Goal
  intensityLabel: string
  equipmentInventory?: EquipmentInventory
}

export function SessionPreview({
  focus,
  style,
  intensityLabel,
  equipmentInventory
}: SessionPreviewProps) {
  const equipmentSummary = useMemo(() => {
    if (!equipmentInventory) return []
    const labels = [] as string[]
    if (equipmentInventory.bodyweight) labels.push('Bodyweight')
    if (equipmentInventory.dumbbells?.length) labels.push(`Dumbbells (${equipmentInventory.dumbbells.join(', ')} lb)`)
    if (equipmentInventory.kettlebells?.length) labels.push(`Kettlebells (${equipmentInventory.kettlebells.join(', ')} lb)`)
    if (equipmentInventory.bands?.length) labels.push(`Bands (${equipmentInventory.bands.join(', ')})`)
    if (equipmentInventory.barbell?.available) labels.push('Barbell')
    const machines = equipmentInventory.machines
      ? Object.entries(equipmentInventory.machines)
          .filter(([, available]) => available)
          .map(([machine]) => (machine as string).replace('_', ' '))
      : []
    if (machines.length) labels.push(`Machines (${machines.join(', ')})`)
    return labels
  }, [equipmentInventory])

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold text-strong">Session preview</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
          <p className="text-xs text-subtle">Focus</p>
          <p className="font-semibold text-strong">{toMuscleLabel(focus)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
          <p className="text-xs text-subtle">Style</p>
          <p className="font-semibold text-strong">{style.replace('_', ' ')}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm">
          <p className="text-xs text-subtle">Session intensity</p>
          <p className="font-semibold text-strong">{intensityLabel}</p>
        </div>
      </div>
      {equipmentSummary.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-subtle">Equipment</p>
          <p className="text-sm text-muted">{equipmentSummary.join(' · ')}</p>
        </div>
      )}
    </Card>
  )
}
