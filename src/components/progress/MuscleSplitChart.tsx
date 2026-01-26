'use client'

import React, { useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'

const chartColors = ['#f05a28', '#1f9d55', '#0ea5e9', '#f59e0b', '#ec4899']

export interface MuscleBreakdownPoint {
  muscle: string
  volume: number
  relativePct: number
  imbalanceIndex: number | null
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

  return (
    <div className={isCompact ? 'flex flex-col h-full relative' : 'space-y-6'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className={`font-black uppercase tracking-widest text-strong ${isCompact ? 'text-[10px]' : 'text-xs'}`}>Muscle group volume</h3>
          {!isCompact && (
            <ChartInfoTooltip 
              description="Shows how much work each muscle group did. The bigger the slice, the more work that muscle did."
              goal="Try to keep things even so you don't over-train one spot and under-train another."
            />
          )}
        </div>
        <div className="flex gap-1 bg-[var(--color-surface-muted)] p-0.5 rounded-md">
          <button 
            type="button"
            onClick={() => setMuscleVizMode('absolute')}
            className={`px-1.5 py-0.5 text-[8px] font-black rounded transition-all ${muscleVizMode === 'absolute' ? 'bg-[var(--color-primary)] text-white' : 'text-subtle'}`}
          >
            ABS
          </button>
          <button 
            type="button"
            onClick={() => setMuscleVizMode('relative')}
            className={`px-1.5 py-0.5 text-[8px] font-black rounded transition-all ${muscleVizMode === 'relative' ? 'bg-[var(--color-primary)] text-white' : 'text-subtle'}`}
          >
            %
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-4 ${isCompact ? 'flex-col' : 'flex-col xl:flex-row'}`}>
        <div className={isCompact ? 'h-32 w-full' : 'h-[280px] w-full xl:w-5/12'}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie 
                data={sortedData.map(m => ({
                  ...m,
                  value: muscleVizMode === 'absolute' ? m.volume : muscleVizMode === 'relative' ? m.relativePct : (m.imbalanceIndex ?? 0)
                })).filter(m => m.value > 0)} 
                dataKey="value" 
                nameKey="muscle" 
                outerRadius={isCompact ? 60 : 110}
                innerRadius={isCompact ? 40 : 75}
                paddingAngle={2}
                stroke="none"
              >
                {sortedData.map((entry, index) => (
                  <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number | undefined) => {
                  if (typeof value !== 'number') return []
                  if (muscleVizMode === 'absolute') return [`${value.toLocaleString()} ${displayUnit}`, 'Volume']
                  if (muscleVizMode === 'relative') return [`${value}%`, 'Relative %']
                  return [value, 'Imbalance Index']
                }}
                contentStyle={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border)', 
                  color: 'var(--color-text)', 
                  fontSize: '10px',
                  borderRadius: '8px',
                  padding: '8px'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className={`w-full space-y-1 ${isCompact ? 'mt-auto' : 'xl:w-7/12 pr-2'}`}>
          {!isCompact && (
            <p className="text-[10px] font-black uppercase tracking-widest text-subtle border-b border-[var(--color-border)] pb-2 mb-3">
              {muscleVizMode === 'absolute' ? `Volume (${displayUnit})` : muscleVizMode === 'relative' ? 'Distribution (%)' : 'Target Index (100=target)'}
            </p>
          )}
          {data.length === 0 ? (
            <p className="text-xs text-subtle italic">No data available.</p>
          ) : (
            sortedData
              .slice(0, isCompact ? 3 : undefined)
              .map((entry, idx) => {
                const displayVal = muscleVizMode === 'absolute' 
                  ? `${entry.volume.toLocaleString()} ${displayUnit}`
                  : muscleVizMode === 'relative' 
                    ? `${entry.relativePct}%` 
                    : entry.imbalanceIndex !== null ? entry.imbalanceIndex : 'N/A'
                
                return (
                  <div key={entry.muscle} className={`flex items-center justify-between border-b border-[var(--color-border)]/30 last:border-0 ${isCompact ? 'py-1' : 'py-1.5'}`}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ background: chartColors[idx % chartColors.length] }} 
                      />
                      <span className="text-muted font-bold uppercase text-[9px] tracking-tight truncate max-w-[80px]">{entry.muscle}</span>
                    </div>
                    <span className="text-strong font-black tabular-nums text-[10px]">{displayVal}</span>
                  </div>
                )
              })
          )}
          {isCompact && data.length > 3 && (
            <button 
              type="button"
              onClick={() => setIsExpanded(true)}
              className="w-full text-[8px] text-[var(--color-primary)] hover:text-strong text-center mt-2 uppercase font-black tracking-[0.2em] py-1 border border-dashed border-[var(--color-primary)]/30 rounded-md transition-colors"
            >
              + {data.length - 3} More Groups
            </button>
          )}
        </div>
      </div>

      {isCompact && isExpanded && (
        <div className="absolute inset-0 z-50 bg-surface/95 backdrop-blur-sm rounded-xl p-4 flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-strong">Detailed Breakdown</p>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-[10px] font-black uppercase tracking-widest text-subtle hover:text-strong"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-hide">
            {sortedData.map((entry, idx) => {
              const displayVal = muscleVizMode === 'absolute' 
                ? `${entry.volume.toLocaleString()} ${displayUnit}`
                : muscleVizMode === 'relative' ? `${entry.relativePct}%` : (entry.imbalanceIndex ?? 'N/A')
              
              return (
                <div key={entry.muscle} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: chartColors[idx % chartColors.length] }} />
                    <span className="text-muted font-bold uppercase text-[9px] tracking-tight">{entry.muscle}</span>
                  </div>
                  <span className="text-strong font-black tabular-nums text-[10px]">{displayVal}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
