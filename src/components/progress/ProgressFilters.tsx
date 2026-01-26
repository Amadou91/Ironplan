'use client'

import { useState } from 'react'
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
  { label: 'Last 7 days', getRange: () => createPastRange(7) },
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
  { label: 'Last 30 days', getRange: () => createPastRange(30) },
  { label: 'Last 90 days', getRange: () => createPastRange(90) },
  {
    label: 'Last 6 months',
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
    label: 'Last 12 months',
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
  { label: 'Core', value: 'core' }
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
  }

  return (
    <Card className="p-4 shadow-xl border-[var(--color-primary)]/20 backdrop-blur-md bg-surface/80">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[var(--color-primary)] rounded-full" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-strong">Data Insights Control</h2>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {DATE_RANGE_PRESETS.slice(1, 8).map((preset) => (
              <Button
                key={preset.label}
                variant={activeDatePreset === preset.label ? 'primary' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className="h-7 px-3 text-[10px] font-bold"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-bold text-subtle ml-1">Time Horizon</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset(null); }}
                className="input-base text-xs h-9"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset(null); }}
                className="input-base text-xs h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] uppercase font-bold text-subtle ml-1">Muscle Focus</label>
            <select
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              className="input-base text-xs h-9 font-bold"
            >
              <option value="all">All Groups</option>
              {MUSCLE_PRESETS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-[9px] uppercase font-bold text-subtle ml-1">Movement</label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="input-base text-xs h-9 font-bold"
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