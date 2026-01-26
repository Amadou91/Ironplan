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
      <div className="pointer-events-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl backdrop-blur-sm">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-subtle">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => {
            const isTrend = entry.dataKey === 'trend'
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
                  <span className="text-xs font-bold text-strong">{entry.name}:</span>
                </div>
                <span className="text-xs font-black text-strong tabular-nums">
                  {entry.value?.toLocaleString()} {!isTrend && unit ? unit : ''}
                </span>
              </div>
            )
          })}

          {type === 'readiness' && payload.length >= 2 && (
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              {(() => {
                const readiness = payload.find(p => p.dataKey === 'score' || p.dataKey === 'readiness')?.value as number
                const effort = payload.find(p => p.dataKey === 'effort')?.value as number
                
                if (readiness !== undefined && effort !== undefined) {
                  const normalizedEffort = effort * 10
                  const diff = readiness - normalizedEffort
                  
                  let status = { label: 'Optimal', color: 'text-green-500', icon: '✅' }
                  if (diff < -20) status = { label: 'Overreaching', color: 'text-red-500', icon: '⚠️' }
                  else if (diff > 20) status = { label: 'Undertraining', color: 'text-amber-500', icon: '📉' }
                  
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-subtle">Analysis:</span>
                      <span className={`text-[10px] font-black uppercase ${status.color}`}>
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
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              {(() => {
                const actual = payload.find(p => p.dataKey === 'weight')?.value as number
                const trend = payload.find(p => p.dataKey === 'trend')?.value as number
                if (actual && trend) {
                  const diff = actual - trend
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-subtle">Vs Trend:</span>
                      <span className={`text-[10px] font-black uppercase ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
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
