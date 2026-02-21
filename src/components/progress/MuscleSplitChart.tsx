'use client'

import React, { useState } from 'react'
import {
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'

const chartColors = ['#f05a28', '#1f9d55', '#0ea5e9', '#f59e0b', '#ec4899']
const COMPACT_LIMIT = 5

const formatCompactNumber = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${Math.round(value)}`
}

export interface MuscleBreakdownPoint {
  muscle: string
  volume: number
  relativePct: number
  imbalanceIndex: number | null
  daysPerWeek: number
  recoveryEstimate: number
}

interface MuscleSplitChartProps {
  data: MuscleBreakdownPoint[]
  isCompact?: boolean
}

export function MuscleSplitChart({ data, isCompact = false }: MuscleSplitChartProps) {
  const [muscleVizMode, setMuscleVizMode] = useState<'absolute' | 'relative' | 'index'>('absolute')
  const [isExpanded, setIsExpanded] = useState(false)
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  const convertedData = React.useMemo(() => {
    if (isKg) {
      return data.map(m => ({
        ...m,
        volume: Math.round(m.volume * KG_PER_LB)
      }))
    }
    return data
  }, [data, isKg])

  const sortedData = React.useMemo(() => {
    return [...convertedData].sort((a, b) => {
      const valA = muscleVizMode === 'absolute' ? a.volume : muscleVizMode === 'relative' ? a.relativePct : (a.imbalanceIndex ?? 0)
      const valB = muscleVizMode === 'absolute' ? b.volume : muscleVizMode === 'relative' ? b.relativePct : (b.imbalanceIndex ?? 0)
      return valB - valA
    })
  }, [convertedData, muscleVizMode])

  const chartData = React.useMemo(() => {
    return sortedData
      .map(entry => {
        const value = muscleVizMode === 'absolute'
          ? entry.volume
          : muscleVizMode === 'relative'
            ? entry.relativePct
            : (entry.imbalanceIndex ?? 0)
        return { ...entry, value }
      })
      .filter(entry => entry.value > 0)
  }, [sortedData, muscleVizMode])

  const displayData = isCompact ? chartData.slice(0, COMPACT_LIMIT) : chartData
  const axisDomain = muscleVizMode === 'relative' ? [0, 100] : [0, 'dataMax']
  const axisFormatter = (value: number) => {
    if (muscleVizMode === 'absolute') return formatCompactNumber(value)
    if (muscleVizMode === 'relative') return `${value}%`
    return `${value}`
  }
  const tooltipFormatter = (value: number | string | undefined) => {
    if (typeof value !== 'number') return value ?? ''
    if (muscleVizMode === 'absolute') return `${value.toLocaleString()} ${displayUnit}`
    if (muscleVizMode === 'relative') return `${value}%`
    return `${value}`
  }

  return (
    <div className={isCompact ? 'flex flex-col h-full relative' : 'space-y-6'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold uppercase tracking-[0.15em] text-strong ${isCompact ? 'text-[11px]' : 'text-sm'}`}>Muscle Distribution</h3>
          {!isCompact && (
            <ChartInfoTooltip 
              description="Shows how much work each muscle group did. The longer the bar, the more work that muscle did."
              goal="Try to keep things even so you don't over-train one spot and under-train another."
            />
          )}
        </div>
        <div className="flex gap-1 bg-[var(--color-surface-muted)] p-1 rounded-lg border border-[var(--color-border)]">
          <button 
            type="button"
            onClick={() => setMuscleVizMode('absolute')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all uppercase tracking-wider ${muscleVizMode === 'absolute' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-strong'}`}
          >
            Abs
          </button>
          <button 
            type="button"
            onClick={() => setMuscleVizMode('relative')}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all uppercase tracking-wider ${muscleVizMode === 'relative' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-strong'}`}
          >
            %
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-4 ${isCompact ? 'flex-col' : 'flex-col xl:flex-row'}`}>
        <div className={isCompact ? 'h-40 w-full' : 'h-[280px] w-full xl:w-5/12'}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={displayData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: isCompact ? 0 : 12, bottom: 4 }}
            >
              {!isCompact && (
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              )}
              <XAxis
                type="number"
                domain={axisDomain as [number, number] | [number, 'dataMax']}
                tickFormatter={axisFormatter}
                stroke="var(--color-text-subtle)"
                fontSize={10}
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                hide={isCompact}
              />
              <YAxis
                type="category"
                dataKey="muscle"
                stroke="var(--color-text-subtle)"
                fontSize={isCompact ? 9 : 10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
                width={isCompact ? 0 : 80}
                hide={isCompact}
              />
              <Tooltip
                formatter={tooltipFormatter}
                contentStyle={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border)', 
                  color: 'var(--color-text)', 
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '12px',
                  padding: '10px',
                  boxShadow: 'var(--shadow-md)'
                }} 
              />
              <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={isCompact ? 12 : 16}>
                {displayData.map((entry, index) => (
                  <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className={`w-full space-y-1.5 ${isCompact ? 'mt-auto' : 'xl:w-7/12 pr-2'}`}>
          {!isCompact && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-subtle/60 border-b border-[var(--color-border)] pb-2 mb-3">
              {muscleVizMode === 'absolute' ? `Volume (${displayUnit})` : muscleVizMode === 'relative' ? 'Distribution (%)' : 'Target Index'}
            </p>
          )}
          {data.length === 0 ? (
            <p className="text-sm text-subtle italic font-medium">No data available.</p>
          ) : (
            sortedData
              .slice(0, isCompact ? COMPACT_LIMIT : undefined)
              .map((entry, idx) => {
                const displayVal = muscleVizMode === 'absolute' 
                  ? `${entry.volume.toLocaleString()} ${displayUnit}`
                  : muscleVizMode === 'relative' 
                    ? `${entry.relativePct}%` 
                    : entry.imbalanceIndex !== null ? entry.imbalanceIndex : 'N/A'
                
                return (
                  <div key={entry.muscle} className={`flex items-center justify-between border-b border-[var(--color-border)]/30 last:border-0 ${isCompact ? 'py-1.5' : 'py-2'}`}>
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shadow-sm" 
                        style={{ background: chartColors[idx % chartColors.length] }} 
                      />
                      <span className="text-muted font-bold uppercase text-[11px] tracking-widest truncate max-w-[100px]">{entry.muscle}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-strong font-semibold tabular-nums text-[11px] tracking-tight">{displayVal}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-subtle/70">
                        {entry.daysPerWeek.toFixed(1)} d/wk • {entry.recoveryEstimate}% rec
                      </p>
                    </div>
                  </div>
                )
              })
          )}
          {isCompact && data.length > COMPACT_LIMIT && (
            <button 
              type="button"
              onClick={() => setIsExpanded(true)}
              className="w-full text-[11px] text-[var(--color-primary)] hover:text-strong text-center mt-3 uppercase font-semibold tracking-[0.15em] py-2 border border-dashed border-[var(--color-primary)]/30 rounded-xl transition-all hover:bg-[var(--color-primary-soft)]/20"
            >
              + {data.length - COMPACT_LIMIT} More Groups
            </button>
          )}
        </div>
      </div>

      {isCompact && isExpanded && (
        <div className="absolute inset-0 z-50 bg-surface/98 backdrop-blur-md rounded-2xl p-5 flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-5 border-b border-[var(--color-border)] pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-strong">Detailed Breakdown</p>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-[11px] font-semibold uppercase tracking-widest text-subtle hover:text-strong transition-colors"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-hide">
            {sortedData.map((entry, idx) => {
              const displayVal = muscleVizMode === 'absolute' 
                ? `${entry.volume.toLocaleString()} ${displayUnit}`
                : muscleVizMode === 'relative' ? `${entry.relativePct}%` : (entry.imbalanceIndex ?? 'N/A')
              
              return (
                <div key={entry.muscle} className="flex items-center justify-between py-2 border-b border-[var(--color-border)]/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: chartColors[idx % chartColors.length] }} />
                    <span className="text-muted font-bold uppercase text-[11px] tracking-widest">{entry.muscle}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-strong font-semibold tabular-nums text-[11px] tracking-tight">{displayVal}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-subtle/70">
                      {entry.daysPerWeek.toFixed(1)} d/wk • {entry.recoveryEstimate}% rec
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
