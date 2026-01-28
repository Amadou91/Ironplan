'use client'

import React from 'react'
import { TooltipProps } from 'recharts'
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

interface CustomTooltipProps extends TooltipProps<ValueType, NameType> {
  type?: 'volume' | 'effort' | 'bodyweight' | 'readiness'
  unit?: string
}

export function CustomTooltip({ active, payload, label, type, unit }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="pointer-events-none rounded-2xl border border-[var(--color-border)] glass-panel p-4 shadow-2xl">
        <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-subtle opacity-70">{label}</p>
        <div className="space-y-2">
          {payload.map((entry, index) => {
            const isTrend = entry.dataKey === 'trend'
            return (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full shadow-sm" style={{ background: entry.color }} />
                  <span className="text-xs font-black text-strong opacity-80 uppercase tracking-tight">{entry.name}:</span>
                </div>
                <span className="text-xs font-black text-strong tabular-nums">
                  {entry.value?.toLocaleString()} {!isTrend && unit ? unit : ''}
                </span>
              </div>
            )
          })}

          {type === 'readiness' && payload.length >= 1 && (
            <div className="mt-3 border-t border-[var(--color-border)]/50 pt-3">
              {(() => {
                const readiness = payload.find(p => p.dataKey === 'score' || p.dataKey === 'readiness')?.value as number
                const effort = payload.find(p => p.dataKey === 'effort')?.value as number
                
                if (readiness !== undefined && effort !== undefined) {
                  let status = { label: 'Optimal', color: 'text-[var(--color-success)]', icon: '✅' }
                  
                  // Quadrant Logic
                  if (readiness < 50 && effort >= 5) {
                    status = { label: 'Overreaching', color: 'text-[var(--color-danger)]', icon: '⚠️' }
                  } else if (readiness >= 50 && effort >= 5) {
                    status = { label: 'Optimal', color: 'text-[var(--color-success)]', icon: '🔥' }
                  } else if (readiness < 50 && effort < 5) {
                    status = { label: 'Recovery', color: 'text-blue-500', icon: '💤' }
                  } else {
                    status = { label: 'Undertraining', color: 'text-[var(--color-warning)]', icon: '📉' }
                  }
                  
                  return (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-black uppercase text-subtle tracking-widest">Status:</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${status.color}`}>
                        {status.icon} {status.label}
                      </span>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          )}

          {type === 'bodyweight' && payload.length >= 2 && (
            <div className="mt-3 border-t border-[var(--color-border)]/50 pt-3">
              {(() => {
                const actual = payload.find(p => p.dataKey === 'weight')?.value as number
                const trend = payload.find(p => p.dataKey === 'trend')?.value as number
                if (actual && trend) {
                  const diff = actual - trend
                  return (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-black uppercase text-subtle tracking-widest">Vs Trend:</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${diff > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)} {unit}
                      </span>
                    </div>
                  )
                }
                return null
              })()}
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}
