'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EquipmentSelector } from '@/components/generate/EquipmentSelector'
import { cloneInventory, equipmentPresets, normalizeInventory } from '@/lib/equipment'
import { normalizePreferences } from '@/lib/preferences'
import type { PlanInput } from '@/types/domain'

interface EquipmentSettingsFormProps {
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export function EquipmentSettingsForm({ onSuccess, onError }: EquipmentSettingsFormProps) {
  const supabase = useSupabase()
  const { user } = useUser()

  const [equipment, setEquipment] = useState<PlanInput['equipment']>(() => ({
    preset: 'custom',
    inventory: cloneInventory(equipmentPresets.custom),
  }))
  const [loading, setLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()

      if (!error && data?.preferences) {
        const normalized = normalizePreferences(data.preferences)
        if (normalized.equipment?.inventory) {
          // Use normalizeInventory to merge with full defaults, preventing
          // phantom entries from partial/legacy DB data (e.g. old 4-machine schema).
          setEquipment({ preset: 'custom', inventory: normalizeInventory(normalized.equipment.inventory) })
        }
      }
      setHasUnsavedChanges(false)
      setSaveState('idle')
      setLoading(false)
    }
    load()
  }, [user, supabase])

  const handleSave = async () => {
    if (!user || !hasUnsavedChanges) return
    setSaveState('saving')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      const normalized = normalizePreferences(data?.preferences)
      const updated = {
        ...normalized,
        equipment: { inventory: equipment.inventory },
      }

      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, preferences: updated }, { onConflict: 'id' })

      if (saveError) throw saveError

      setSaveState('saved')
      setHasUnsavedChanges(false)
      onSuccess?.('Equipment preferences saved.')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (err) {
      console.error('Failed to save equipment', err)
      setSaveState('error')
      onError?.('Unable to save equipment preferences.')
    }
  }

  const updateEquipment = (updater: (prev: PlanInput['equipment']) => PlanInput['equipment']) => {
    setEquipment((prev) => {
      const next = updater(prev)
      if (!loading && JSON.stringify(next.inventory) !== JSON.stringify(prev.inventory)) {
        setHasUnsavedChanges(true)
        if (saveState !== 'saving') setSaveState('idle')
      }
      return next
    })
  }

  const machineCount = Object.values(equipment.inventory.machines).filter(Boolean).length
  const summary = [
    equipment.inventory.bodyweight ? 'Bodyweight' : null,
    equipment.inventory.benchPress ? 'Bench press' : null,
    equipment.inventory.dumbbells.length
      ? `Dumbbells (${equipment.inventory.dumbbells.length})`
      : null,
    equipment.inventory.kettlebells.length
      ? `Kettlebells (${equipment.inventory.kettlebells.length})`
      : null,
    equipment.inventory.bands.length ? `Bands (${equipment.inventory.bands.length})` : null,
    equipment.inventory.barbell.available
      ? `Barbell${equipment.inventory.barbell.plates.length ? ` + plates (${equipment.inventory.barbell.plates.length})` : ''}`
      : null,
    machineCount ? `Machines (${machineCount})` : null,
  ].filter(Boolean)

  return (
    <div className="grid grid-cols-1 gap-6 pb-[calc(env(safe-area-inset-bottom)+8rem)] md:pb-0">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-strong">Equipment defaults</h2>
            <p className="text-xs text-subtle">Used automatically when generating a workout session.</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="hidden md:inline-flex"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saveState === 'saving'}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save equipment'}
          </Button>
        </div>

        {summary.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
              Current selection
            </p>
            <p className="mt-1 text-sm text-muted">{summary.join(' · ')}</p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
              Current selection
            </p>
            <p className="mt-1 text-sm text-muted italic">None selected — workouts will use bodyweight movements</p>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
          <EquipmentSelector
            equipment={equipment}
            isCardioStyle={false}
            isMobilityStyle={false}
            onUpdateEquipment={updateEquipment}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-xs text-subtle">
            {hasUnsavedChanges
              ? 'You have unsaved equipment changes.'
              : 'Equipment preferences are saved.'}
          </p>
          {saveState === 'saved' ? (
            <p className="text-[10px] text-accent font-medium">Saved</p>
          ) : null}
        </div>
      </Card>

      {/* Mobile sticky save */}
      <div className="md:hidden sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-20 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_8%)] p-2 backdrop-blur">
        <Button
          type="button"
          size="md"
          className="w-full"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || saveState === 'saving'}
        >
          {saveState === 'saving' ? 'Saving…' : 'Save equipment'}
        </Button>
      </div>
    </div>
  )
}
