'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { formatHeightFromInches } from '@/lib/body-metrics'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'

interface BodyMetricsFormProps {
  draft: {
    weightLb: string
    heightFeet: string
    heightInches: string
    bodyFatPercent: string
    birthdate: string
    sex: string
  }
  metrics: {
    weightLb: number | null
    heightIn: number | null
    bodyFatPercent: number | null
    age: number | null
    bmi: number | null
    leanMass: number | null
    bmr: number | null
  }
  loading: boolean
  saving: boolean
  hasChanges: boolean
  lastUpdated?: string | null
  /** Keys from ProfileSnapshot that are still missing/empty after initial load */
  missingFieldKeys?: string[]
  onChange: (field: string, value: string) => void
  onSave: () => void
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function BodyMetricsForm({
  draft,
  metrics,
  loading,
  saving,
  hasChanges,
  lastUpdated,
  missingFieldKeys = [],
  onChange,
  onSave
}: BodyMetricsFormProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  const isMissing = (key: string) => missingFieldKeys.includes(key)

  const displayWeight = metrics.weightLb 
    ? isKg ? Math.round(metrics.weightLb * KG_PER_LB * 10) / 10 : metrics.weightLb
    : null
    
  const displayLeanMass = metrics.leanMass
    ? isKg ? Math.round(metrics.leanMass * KG_PER_LB) : Math.round(metrics.leanMass)
    : null

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-strong">Body Metrics</h2>
          <p className="text-sm text-muted">These values power BMI, BMR, and training metrics.</p>
        </div>
        <Button
          size="sm"
          className="hidden sm:inline-flex"
          onClick={onSave}
          disabled={loading || saving || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save metrics'}
        </Button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs text-subtle">Weight ({displayUnit})</label>
              {isMissing('weight_lb') && (
                <span className="text-[10px] font-semibold text-[var(--color-danger)] uppercase tracking-wide" aria-hidden="true">Required</span>
              )}
            </div>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.weightLb}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('weightLb', val)
              }}
              className="mt-1"
              disabled={loading || saving}
              aria-invalid={isMissing('weight_lb') || undefined}
              aria-label={`Weight in ${displayUnit}`}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs text-subtle">Height</label>
              {isMissing('height_in') && (
                <span className="text-[10px] font-semibold text-[var(--color-danger)] uppercase tracking-wide" aria-hidden="true">Required</span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
              <label className="flex flex-col gap-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="ft"
                  value={draft.heightFeet}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('heightFeet', val)
                  }}
                  disabled={loading || saving}
                  aria-invalid={isMissing('height_in') || undefined}
                  aria-label="Height feet"
                />
                <span className="text-subtle">Feet</span>
              </label>
              <label className="flex flex-col gap-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="in"
                  value={draft.heightInches}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('heightInches', val)
                  }}
                  disabled={loading || saving}
                  aria-invalid={isMissing('height_in') || undefined}
                  aria-label="Height inches"
                />
                <span className="text-subtle">Inches</span>
              </label>
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-subtle">Body fat %</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.bodyFatPercent}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('bodyFatPercent', val)
              }}
              className="mt-1"
              disabled={loading || saving}
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs text-subtle">Birthdate</label>
              {isMissing('birthdate') && (
                <span className="text-[10px] font-semibold text-[var(--color-danger)] uppercase tracking-wide" aria-hidden="true">Required</span>
              )}
            </div>
            <Input
              type="date"
              value={draft.birthdate}
              onChange={(e) => onChange('birthdate', e.target.value)}
              className="mt-1"
              disabled={loading || saving}
              aria-invalid={isMissing('birthdate') || undefined}
            />
          </div>
          <div className="flex flex-col sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-subtle">Sex (for BMR)</label>
              {isMissing('sex') && (
                <span className="text-[10px] font-semibold text-[var(--color-danger)] uppercase tracking-wide" aria-hidden="true">Required</span>
              )}
            </div>
            <Select
              value={draft.sex}
              onChange={(e) => onChange('sex', e.target.value)}
              className="mt-1"
              disabled={loading || saving}
              aria-invalid={isMissing('sex') || undefined}
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-muted">
          <p className="text-[10px] uppercase tracking-wider text-subtle">Profile insights</p>
          <div className="mt-3 space-y-2">
            <p>Weight: <span className="text-strong">{displayWeight ? `${displayWeight} ${displayUnit}` : 'Add weight'}</span></p>
            <p>Height: <span className="text-strong">{metrics.heightIn ? formatHeightFromInches(metrics.heightIn) : 'Add height'}</span></p>
            <p>Age: <span className="text-strong">{typeof metrics.age === 'number' ? `${metrics.age}` : 'Add birthdate'}</span></p>
            <p>BMI: <span className="text-strong">{metrics.bmi ? metrics.bmi.toFixed(1) : 'Add weight + height'}</span></p>
            <p>Lean mass: <span className="text-strong">{displayLeanMass ? `${displayLeanMass} ${displayUnit}` : 'Add body fat %'}</span></p>
            <p>Estimated BMR: <span className="text-strong">{metrics.bmr ? `${Math.round(metrics.bmr)} kcal` : 'Add age + sex'}</span></p>
          </div>
        </div>
      </div>
      {lastUpdated && (
        <p className="mt-3 text-[10px] text-subtle">Last updated {formatDateTime(lastUpdated)}</p>
      )}

      <div className="mt-4 sm:hidden sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-20 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_8%)] p-2 backdrop-blur">
        <Button
          size="md"
          className="w-full"
          onClick={onSave}
          disabled={loading || saving || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save metrics'}
        </Button>
      </div>
    </Card>
  )
}
