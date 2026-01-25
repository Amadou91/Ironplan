'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MuscleSplitChart, type MuscleBreakdownPoint } from '@/components/progress/MuscleSplitChart'
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
  { label: 'Last 30 days', getRange: () => createPastRange(30) },
  { label: 'Last 90 days', getRange: () => createPastRange(90) },
  {
    label: 'This month',
    getRange: () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start, end: today }
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
  muscleBreakdown: MuscleBreakdownPoint[]
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
  exerciseOptions,
  muscleBreakdown
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
    <Card className="p-6 md:p-8">
      <div className="flex flex-col gap-10">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-subtle">Data Insights Control</h2>
            <div className="h-px flex-1 bg-[var(--color-border)] opacity-50" />
          </div>
          
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5 space-y-10">
              {/* Date Selection */}
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-strong mb-3">Time Horizon</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-[9px] uppercase font-bold text-subtle mb-1 ml-1">From</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(event) => {
                          setStartDate(event.target.value)
                          setActiveDatePreset(null)
                        }}
                        className="input-base text-sm"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] uppercase font-bold text-subtle mb-1 ml-1">To</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(event) => {
                          setEndDate(event.target.value)
                          setActiveDatePreset(null)
                        }}
                        className="input-base text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] uppercase font-bold text-subtle mb-2.5 ml-1">Quick Ranges</p>
                  <div className="flex flex-wrap gap-2">
                    {DATE_RANGE_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant={activeDatePreset === preset.label ? 'primary' : 'outline'}
                        size="sm"
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className={`h-8 px-3 text-[11px] font-bold transition-all ${
                          activeDatePreset === preset.label 
                            ? 'shadow-md' 
                            : 'bg-transparent text-muted border-[var(--color-border)] hover:border-strong'
                        }`}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Focus Selection */}
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-strong mb-3">Muscle Group Focus</p>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLE_PRESETS.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={selectedMuscle === preset.value ? 'primary' : 'outline'}
                        size="sm"
                        type="button"
                        onClick={() => {
                          setSelectedMuscle(selectedMuscle === preset.value ? 'all' : preset.value)
                        }}
                        className={`h-8 px-4 text-[11px] font-bold transition-all ${
                          selectedMuscle === preset.value 
                            ? 'shadow-md scale-105' 
                            : 'bg-transparent text-muted border-[var(--color-border)] hover:border-strong'
                        }`}
                      >
                        {preset.label}
                      </Button>
                    ))}
                    <Button
                      variant={selectedMuscle === 'all' ? 'primary' : 'outline'}
                      size="sm"
                      type="button"
                      onClick={() => setSelectedMuscle('all')}
                      className={`h-8 px-4 text-[11px] font-bold transition-all ${
                        selectedMuscle === 'all' 
                          ? 'shadow-md' 
                          : 'bg-transparent text-muted border-[var(--color-border)] hover:border-strong'
                      }`}
                    >
                      All Groups
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-strong mb-3">Specific Movement</label>
                  <select
                    value={selectedExercise}
                    onChange={(event) => setSelectedExercise(event.target.value)}
                    className="input-base text-sm font-semibold"
                  >
                    <option value="all">All Exercises</option>
                    {exerciseOptions.map((exercise) => (
                      <option key={exercise} value={exercise}>
                        {exercise}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:border-l lg:border-[var(--color-border)] lg:pl-10">
              <MuscleSplitChart data={muscleBreakdown} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
