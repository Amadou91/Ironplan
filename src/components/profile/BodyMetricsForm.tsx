'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
  onChange,
  onSave
}: BodyMetricsFormProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

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
          onClick={onSave}
          disabled={loading || saving || !hasChanges}
        >
          {saving ? 'Saving...' : 'Save metrics'}
        </Button>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <div className="flex flex-col">
            <label className="text-xs text-subtle">Weight ({displayUnit})</label>
            <input
              type="text"
              inputMode="decimal"
              value={draft.weightLb}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('weightLb', val)
              }}
              className="input-base mt-1"
              disabled={loading || saving}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-subtle">Height</label>
            <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
              <label className="flex flex-col gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="ft"
                  value={draft.heightFeet}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('heightFeet', val)
                  }}
                  className="input-base"
                  disabled={loading || saving}
                />
                <span className="text-subtle">Feet</span>
              </label>
              <label className="flex flex-col gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="in"
                  value={draft.heightInches}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('heightInches', val)
                  }}
                  className="input-base"
                  disabled={loading || saving}
                />
                <span className="text-subtle">Inches</span>
              </label>
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-subtle">Body fat %</label>
            <input
              type="text"
              inputMode="decimal"
              value={draft.bodyFatPercent}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) onChange('bodyFatPercent', val)
              }}
              className="input-base mt-1"
              disabled={loading || saving}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-subtle">Birthdate</label>
            <input
              type="date"
              value={draft.birthdate}
              onChange={(e) => onChange('birthdate', e.target.value)}
              className="input-base mt-1"
              disabled={loading || saving}
            />
          </div>
          <div className="flex flex-col sm:col-span-2">
            <label className="text-xs text-subtle">Sex (for BMR)</label>
            <select
              value={draft.sex}
              onChange={(e) => onChange('sex', e.target.value)}
              className="input-base mt-1"
              disabled={loading || saving}
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
            </select>
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
    </Card>
  )
}
