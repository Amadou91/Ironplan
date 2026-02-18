'use client'

import { useState, useEffect } from 'react'
import { Ruler, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EquipmentSelector } from '@/components/generate/EquipmentSelector'
import { cloneInventory, equipmentPresets } from '@/lib/equipment'
import { defaultPreferences, normalizePreferences, type SettingsPreferences } from '@/lib/preferences'
import { useUIStore } from '@/store/uiStore'
import type { PlanInput } from '@/types/domain'

interface AppSettingsProps {
  onSuccess?: (msg: string) => void
  onError?: (msg: string) => void
}

export function AppSettings({ onSuccess, onError }: AppSettingsProps) {
  const supabase = createClient()
  const { user } = useUser()
  const setDisplayUnit = useUIStore((state) => state.setDisplayUnit)
  
  const [settings, setSettings] = useState<SettingsPreferences>(() => ({
    ...defaultPreferences.settings!
  }))
  const [equipment, setEquipment] = useState<PlanInput['equipment']>(() => ({
    preset: 'custom',
    inventory: cloneInventory(equipmentPresets.custom)
  }))
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSettingsState, setSaveSettingsState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!user) return
    const loadSettings = async () => {
      setLoadingPrefs(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!error && data?.preferences) {
        const normalized = normalizePreferences(data.preferences)
        if (normalized.settings) {
          setSettings(normalized.settings)
        }
        if (normalized.equipment?.inventory) {
          setEquipment({
            preset: 'custom',
            inventory: cloneInventory(normalized.equipment.inventory)
          })
        }
      }
      setHasUnsavedChanges(false)
      setSaveSettingsState('idle')
      setLoadingPrefs(false)
    }
    loadSettings()
  }, [user, supabase])

  const persistPreferences = async (nextSettings: SettingsPreferences, nextEquipment: PlanInput['equipment']) => {
    if (!user) return
    setSaveSettingsState('saving')
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
        settings: nextSettings,
        equipment: {
          inventory: nextEquipment.inventory
        }
      }
      
      const { error: saveError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, preferences: updated }, { onConflict: 'id' })
      
      if (saveError) throw saveError
      setSaveSettingsState('saved')
      setHasUnsavedChanges(false)
      onSuccess?.('Preferences saved.')
      setTimeout(() => setSaveSettingsState('idle'), 2000)
    } catch (err) {
      console.error('Failed to save settings', err)
      setSaveSettingsState('error')
      onError?.('Unable to save settings.')
    }
  }

  const updateSettings = (updater: (prev: SettingsPreferences) => SettingsPreferences) => {
    setSettings((prev) => {
      const next = updater(prev)
      if (next.units !== prev.units) {
        setDisplayUnit(next.units)
      }
      if (!loadingPrefs && JSON.stringify(next) !== JSON.stringify(prev)) {
        setHasUnsavedChanges(true)
        if (saveSettingsState !== 'saving') {
          setSaveSettingsState('idle')
        }
      }
      return next
    })
  }

  const updateEquipment = (updater: (prev: PlanInput['equipment']) => PlanInput['equipment']) => {
    setEquipment((prev) => {
      const next = updater(prev)
      if (!loadingPrefs && JSON.stringify(next.inventory) !== JSON.stringify(prev.inventory)) {
        setHasUnsavedChanges(true)
        if (saveSettingsState !== 'saving') {
          setSaveSettingsState('idle')
        }
      }
      return next
    })
  }

  const handleSavePreferences = async () => {
    if (!user || !hasUnsavedChanges) return
    await persistPreferences(settings, equipment)
  }

  const machineCount = Object.values(equipment.inventory.machines).filter(Boolean).length
  const equipmentSummary = [
    equipment.inventory.bodyweight ? 'Bodyweight' : null,
    equipment.inventory.benchPress ? 'Bench press' : null,
    equipment.inventory.dumbbells.length ? `Dumbbells (${equipment.inventory.dumbbells.length})` : null,
    equipment.inventory.kettlebells.length ? `Kettlebells (${equipment.inventory.kettlebells.length})` : null,
    equipment.inventory.bands.length ? `Bands (${equipment.inventory.bands.length})` : null,
    equipment.inventory.barbell.available ? `Barbell${equipment.inventory.barbell.plates.length ? ` + plates (${equipment.inventory.barbell.plates.length})` : ''}` : null,
    machineCount ? `Machines (${machineCount})` : null
  ].filter(Boolean)

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Ruler className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-sm font-semibold text-strong">Units</h2>
            <p className="text-xs text-subtle">Choose your preferred measurement system.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={settings.units === 'lb' ? 'primary' : 'secondary'}
            onClick={() => updateSettings((prev) => ({ ...prev, units: 'lb' }))}
          >
            Pounds (lb)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={settings.units === 'kg' ? 'primary' : 'secondary'}
            onClick={() => updateSettings((prev) => ({ ...prev, units: 'kg' }))}
          >
            Kilograms (kg)
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-accent" />
              <h2 className="text-base font-semibold text-strong">Workout equipment defaults</h2>
            </div>
            <p className="text-xs text-subtle">
              This is used automatically when starting a session.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="hidden md:inline-flex"
            onClick={handleSavePreferences}
            disabled={!hasUnsavedChanges || saveSettingsState === 'saving'}
          >
            {saveSettingsState === 'saving' ? 'Saving...' : 'Save preferences'}
          </Button>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Current selection summary</p>
          <p className="mt-1 text-sm text-muted">
            {equipmentSummary.length > 0 ? equipmentSummary.join(' · ') : 'No equipment selected yet.'}
          </p>
        </div>

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
            {hasUnsavedChanges ? 'You have unsaved preference changes.' : 'All preference changes are saved.'}
          </p>
          {saveSettingsState === 'saved' && (
            <p className="text-[10px] text-accent font-medium">Preferences saved</p>
          )}
        </div>
      </Card>

      <div className="md:hidden sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-20 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_8%)] p-2 backdrop-blur">
        <Button
          type="button"
          size="md"
          className="w-full"
          onClick={handleSavePreferences}
          disabled={!hasUnsavedChanges || saveSettingsState === 'saving'}
        >
          {saveSettingsState === 'saving' ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </div>
  )
}
