'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { createPastRange } from '@/hooks/useProgressMetrics'
import { formatDateForInput } from '@/lib/transformers/chart-data'

type DateRangePreset = {
  label: string
  getRange: () => { start: Date; end: Date }
}

const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    getRange: () => {
      const today = new Date()
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
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date()
      start.setMonth(today.getMonth() - 6)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: '12M',
    getRange: () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date()
      start.setFullYear(today.getFullYear() - 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: 'This Month',
    getRange: () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: 'This Year',
    getRange: () => {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today.getFullYear(), 0, 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: today }
    }
  },
  {
    label: 'Previous Year',
    getRange: () => {
      const lastYear = new Date().getFullYear() - 1
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
  const [activeDatePreset, setActiveDatePreset] = useState<string | null>(null)
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const handlePresetClick = (preset: DateRangePreset) => {
    if (activeDatePreset === preset.label) {
      setStartDate('')
      setEndDate('')
      setActiveDatePreset(null)
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
    <Card className="p-5 shadow-xl border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface)_92%,transparent)] backdrop-blur-lg">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[var(--color-primary)] rounded-full" />
            <h2 className="text-sm font-black uppercase tracking-[0.1em] text-strong">Insights Control</h2>
          </div>

          {/* Mobile toggle — only opens/closes the panel, selections never close it */}
          <button
            type="button"
            onClick={() => setMobileExpanded((prev) => !prev)}
            className="md:hidden flex items-center justify-between gap-2 rounded-lg px-3 h-10 border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-left transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-strong">
              <SlidersHorizontal className="h-4 w-4 text-subtle" />
              {mobileExpanded ? 'Filters' : (activeSummaryParts.length > 0 ? activeSummaryParts.join(' · ') : 'Filters')}
              {!mobileExpanded && activeFilterCount > 0 && (
                <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-black text-white">
                  {activeFilterCount}
                </span>
              )}
            </span>
            {mobileExpanded ? <ChevronUp className="h-4 w-4 text-subtle shrink-0" /> : <ChevronDown className="h-4 w-4 text-subtle shrink-0" />}
          </button>
          
          <div className="hidden md:flex flex-wrap items-center gap-1.5">
            <div className="flex flex-wrap items-center gap-1 bg-[var(--color-surface-muted)]/50 p-1.5 rounded-xl border border-[var(--color-border)]">
              {DATE_RANGE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant={activeDatePreset === preset.label ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className={`h-8 px-3 text-[11px] font-black transition-all duration-200 uppercase tracking-widest ${
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
          <div className="md:hidden space-y-4">
            <div className="-mx-1 overflow-x-auto no-scrollbar px-1">
              <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-1.5">
                {DATE_RANGE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant={activeDatePreset === preset.label ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className={`h-8 px-3 text-[11px] font-black uppercase tracking-[0.06em] ${
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
                <label className="text-[11px] uppercase font-black text-subtle/80 tracking-[0.08em]">Custom range</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-subtle uppercase tracking-wider">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset(null) }}
                      className="input-base text-sm h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-subtle uppercase tracking-wider">To</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset(null) }}
                      className="input-base text-sm h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase font-black text-subtle/80 tracking-[0.08em]">Muscle Focus</label>
                <select
                  value={selectedMuscle}
                  onChange={(e) => setSelectedMuscle(e.target.value)}
                  className="input-base text-sm h-11 font-bold"
                >
                  <option value="all">All Groups</option>
                  {MUSCLE_PRESETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase font-black text-subtle/80 tracking-[0.08em]">Movement</label>
                <select
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                  className="input-base text-sm h-11 font-bold"
                >
                  <option value="all">All Exercises</option>
                  {exerciseOptions.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            </div>

            {/* Explicit close row — filters are never auto-collapsed */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              {activeFilterCount > 0 && (
                <span className="text-xs text-subtle">
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

        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-subtle/80 tracking-widest ml-1">Time Horizon</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset(null); }}
                className="input-base text-sm h-11 bg-white/50"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset(null); }}
                className="input-base text-sm h-11 bg-white/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-subtle/80 tracking-widest ml-1">Muscle Focus</label>
            <select
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              className="input-base text-sm h-11 font-bold bg-white/50"
            >
              <option value="all">All Groups</option>
              {MUSCLE_PRESETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-[10px] uppercase font-black text-subtle/80 tracking-widest ml-1">Movement</label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="input-base text-sm h-11 font-bold bg-white/50"
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