'use client'

import { useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts'
import { ChartInfoTooltip } from '@/components/ui/ChartInfoTooltip'

const chartColors = ['#f05a28', '#1f9d55', '#0ea5e9', '#f59e0b', '#ec4899']

export interface MuscleBreakdownPoint {
  muscle: string
  volume: number
  relativePct: number
  imbalanceIndex: number | null
}

interface MuscleSplitChartProps {
  data: MuscleBreakdownPoint[]
}

export function MuscleSplitChart({ data }: MuscleSplitChartProps) {
  const [muscleVizMode, setMuscleVizMode] = useState<'absolute' | 'relative' | 'index'>('absolute')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-strong">Muscle group volume</h3>
          <ChartInfoTooltip 
            description="Shows how much work each muscle group did. The bigger the slice, the more work that muscle did."
            goal="Try to keep things even so you don't over-train one spot and under-train another."
          />
        </div>
        <div className="flex gap-1 bg-[var(--color-surface-muted)] p-1 rounded-lg">
          <button 
            onClick={() => setMuscleVizMode('absolute')}
            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${muscleVizMode === 'absolute' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-muted'}`}
          >
            ABS
          </button>
          <button 
            onClick={() => setMuscleVizMode('relative')}
            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${muscleVizMode === 'relative' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-muted'}`}
          >
            %
          </button>
          {data.some(m => m.imbalanceIndex !== null) && (
            <button 
              onClick={() => setMuscleVizMode('index')}
              className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${muscleVizMode === 'index' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-subtle hover:text-muted'}`}
            >
              INDEX
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row items-center gap-8">
        <div className="h-[280px] w-full xl:w-1/2">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie 
                data={data.map(m => ({
                  ...m,
                  value: muscleVizMode === 'absolute' ? m.volume : muscleVizMode === 'relative' ? m.relativePct : (m.imbalanceIndex ?? 0)
                })).filter(m => m.value > 0)} 
                dataKey="value" 
                nameKey="muscle" 
                outerRadius={100}
                innerRadius={70}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number | undefined) => {
                  if (typeof value !== 'number') return []
                  if (muscleVizMode === 'absolute') return [`${value.toLocaleString()} lb`, 'Volume']
                  if (muscleVizMode === 'relative') return [`${value}%`, 'Relative %']
                  return [value, 'Imbalance Index']
                }}
                contentStyle={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border)', 
                  color: 'var(--color-text)', 
                  fontSize: '12px',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="w-full xl:w-1/2 space-y-2 pr-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-subtle border-b border-[var(--color-border)] pb-2 mb-3">
            {muscleVizMode === 'absolute' ? 'Volume (lb)' : muscleVizMode === 'relative' ? 'Distribution (%)' : 'Target Index (100=target)'}
          </p>
          {data.length === 0 ? (
            <p className="text-xs text-subtle italic">No data available.</p>
          ) : (
            data
              .sort((a, b) => {
                const valA = muscleVizMode === 'absolute' ? a.volume : muscleVizMode === 'relative' ? a.relativePct : (a.imbalanceIndex ?? 0)
                const valB = muscleVizMode === 'absolute' ? b.volume : muscleVizMode === 'relative' ? b.relativePct : (b.imbalanceIndex ?? 0)
                return valB - valA
              })
              .map((entry, idx) => {
                const displayVal = muscleVizMode === 'absolute' 
                  ? `${entry.volume.toLocaleString()} lb`
                  : muscleVizMode === 'relative' 
                    ? `${entry.relativePct}%` 
                    : entry.imbalanceIndex !== null ? entry.imbalanceIndex : 'N/A'
                
                return (
                  <div key={entry.muscle} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--color-border)]/30 last:border-0">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ background: chartColors[idx % chartColors.length] }} 
                      />
                      <span className="text-muted font-bold uppercase text-[10px] tracking-tight">{entry.muscle}</span>
                    </div>
                    <span className="text-strong font-black tabular-nums text-[11px]">{displayVal}</span>
                  </div>
                )
              })
          )}
        </div>
      </div>
    </div>
  )
}
