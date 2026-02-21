'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createPastRange } from '@/hooks/useProgressMetrics'
import { formatDateForInput, getNowET } from '@/lib/date-utils'

type DateRangePreset = {
  label: string
  getRange: () => { start: Date; end: Date }
}

const ALL_TIME_LABEL = 'All Time'

const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: ALL_TIME_LABEL,
    getRange: () => ({ start: new Date(0), end: getNowET() })
  },
  {
    label: 'Today',
    getRange: () => {
      const today = getNowET()
      today.setHours(0, 0, 0, 0)
      return { start: today, end: today }
    }
  },
  { label: '7D', getRange: () => createPastRange(7) },
  { label: '30D', getRange: () => createPastRange(30) },
  { label: '90D', getRange: () => createPastRange(90) },
  {
    label: '6M',
    getRange: () => {
      const today = getNowET()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today)
      start.setMonth(today.getMonth() - 6)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: '12M',
    getRange: () => {
      const today = getNowET()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today)
      start.setFullYear(today.getFullYear() - 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: 'This Month',
    getRange: () => {
      const today = getNowET()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: 'This Year',
    getRange: () => {
      const today = getNowET()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today.getFullYear(), 0, 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: 'Previous Year',
    getRange: () => {
      const etNow = getNowET()
      const lastYear = etNow.getFullYear() - 1
      const start = new Date(lastYear, 0, 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(lastYear, 11, 31)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
]

const MUSCLE_PRESETS = [
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Legs', value: 'legs' },
  { label: 'Arms', value: 'arms' },
  { label: 'Core', value: 'core' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Yoga / Mobility', value: 'mobility' }
]

interface ProgressFiltersProps {
  startDate: string
  setStartDate: (date: string) => void
  endDate: string
  setEndDate: (date: string) => void
  selectedMuscle: string
  setSelectedMuscle: (muscle: string) => void
  selectedExercise: string
  setSelectedExercise: (exercise: string) => void
  exerciseOptions: string[]
}

export function ProgressFilters({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedMuscle,
  setSelectedMuscle,
  selectedExercise,
  setSelectedExercise,
  exerciseOptions
}: ProgressFiltersProps) {
  const [activeDatePreset, setActiveDatePreset] = useState<string | null>(ALL_TIME_LABEL)
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const handlePresetClick = (preset: DateRangePreset) => {
    if (activeDatePreset === preset.label) {
      // Toggling off → reset to All Time
      setStartDate('')
      setEndDate('')
      setActiveDatePreset(ALL_TIME_LABEL)
    } else if (preset.label === ALL_TIME_LABEL) {
      setStartDate('')
      setEndDate('')
      setActiveDatePreset(ALL_TIME_LABEL)
    } else {
      const { start, end } = preset.getRange()
      setStartDate(formatDateForInput(start))
      setEndDate(formatDateForInput(end))
      setActiveDatePreset(preset.label)
    }
    // Panel intentionally stays open so user can stack additional filters
  }

  const activeFilterCount = [
    startDate || endDate ? 'date' : null,
    selectedMuscle !== 'all' ? 'muscle' : null,
    selectedExercise !== 'all' ? 'exercise' : null
  ].filter(Boolean).length

  const activeSummaryParts = [
    activeDatePreset ?? (startDate || endDate ? `${startDate || '…'} → ${endDate || '…'}` : null),
    selectedMuscle !== 'all' ? MUSCLE_PRESETS.find(m => m.value === selectedMuscle)?.label : null,
    selectedExercise !== 'all' ? selectedExercise : null,
  ].filter(Boolean)

  return (
    <Card className="border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface)_92%,transparent)] p-4 shadow-xl backdrop-blur-lg sm:p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[var(--color-primary)] rounded-full" />
            <h2 className="type-overline text-strong">Insights control</h2>
          </div>

          {/* Mobile toggle — only opens/closes the panel, selections never close it */}
          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="lg:hidden flex h-10 items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 text-left transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-strong">
              <SlidersHorizontal className="h-4 w-4 text-subtle" />
              {mobileExpanded ? 'Filters' : (activeSummaryParts.length > 0 ? activeSummaryParts.join(' · ') : 'Filters')}
              {!mobileExpanded && activeFilterCount > 0 && (
                <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </span>
            {mobileExpanded ? <ChevronUp className="h-4 w-4 text-subtle shrink-0" /> : <ChevronDown className="h-4 w-4 text-subtle shrink-0" />}
          </button>
          
          <div className="hidden lg:flex flex-wrap items-center gap-1.5">
            <div className="flex flex-wrap items-center gap-1 bg-[var(--color-surface-muted)]/50 p-1.5 rounded-xl border border-[var(--color-border)]">
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant={activeDatePreset === preset.label ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className={`h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all duration-200 ${
                    activeDatePreset === preset.label 
                      ? 'shadow-sm' 
                      : 'text-subtle hover:text-strong'
                  }`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {mobileExpanded && (
          <div className="lg:hidden space-y-4">
            <div className="-mx-1 overflow-x-auto no-scrollbar px-1">
              <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-1.5">
                {DATE_RANGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant={activeDatePreset === preset.label ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className={`h-8 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                      activeDatePreset === preset.label ? 'shadow-sm' : 'text-subtle hover:text-strong'
                    }`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="type-overline text-subtle/80">Custom range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-subtle">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset(null) }}
                      className="input-base h-11 text-[15px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-subtle">To</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset(null) }}
                      className="input-base h-11 text-[15px]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="type-overline text-subtle/80">Muscle focus</label>
                <select
                  value={selectedMuscle}
                  onChange={(e) => setSelectedMuscle(e.target.value)}
                  className="input-base h-11 text-[15px] font-medium"
                >
                  <option value="all">All Groups</option>
                  {MUSCLE_PRESETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="type-overline text-subtle/80">Movement</label>
                <select
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                  className="input-base h-11 text-[15px] font-medium"
                >
                  <option value="all">All Exercises</option>
                  {exerciseOptions.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Explicit close row — filters are never auto-collapsed */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              {activeFilterCount > 0 && (
                <span className="text-[12px] text-subtle">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="ml-auto"
                onClick={() => setMobileExpanded(false)}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        <div className="hidden lg:grid grid-cols-1 lg:grid-cols-4 gap-5 items-end">
          <div className="space-y-2">
                <label className="type-overline ml-1 text-subtle/80">Time horizon</label>
                <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset(null); }}
                className="input-base h-11 bg-white/50 text-[15px]"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset(null); }}
                className="input-base h-11 bg-white/50 text-[15px]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="type-overline ml-1 text-subtle/80">Muscle focus</label>
            <select
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              className="input-base h-11 bg-white/50 text-[15px] font-medium"
            >
              <option value="all">All Groups</option>
              {MUSCLE_PRESETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="type-overline ml-1 text-subtle/80">Movement</label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="input-base h-11 bg-white/50 text-[15px] font-medium"
            >
              <option value="all">All Exercises</option>
              {exerciseOptions.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Card>
  )
}
