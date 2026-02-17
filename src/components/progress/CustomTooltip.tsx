'use client'

import React from 'react'
import type { Payload } from 'recharts/types/component/DefaultTooltipContent'
import { READINESS_HIGH_THRESHOLD, READINESS_LOW_THRESHOLD } from '@/constants/training'

const READINESS_EFFORT_SPLIT = Math.round((READINESS_LOW_THRESHOLD + READINESS_HIGH_THRESHOLD) / 2)
const EFFORT_HIGH_THRESHOLD = 5

type PayloadItem = Payload<number | string, string>

type CustomTooltipProps = {
  active?: boolean
  payload?: PayloadItem[]
  label?: string | number
  type?: 'volume' | 'effort' | 'bodyweight' | 'readiness'
  unit?: string
  labelFormatter?: (label: string | number) => string
}

export function CustomTooltip(props: CustomTooltipProps) {
  const { active, payload, label, type, unit, labelFormatter } = props
  if (active && payload && payload.length) {
    const formattedLabel = labelFormatter && label !== undefined ? labelFormatter(label) : label
    const displayLabel = type === 'readiness' && typeof label === 'number' && !labelFormatter
      ? `Readiness ${Math.round(label)}`
      : formattedLabel

    return (
      <div className="pointer-events-none rounded-2xl border border-[var(--color-border)] glass-panel p-4 shadow-2xl">
        <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-subtle opacity-70">{displayLabel}</p>
        <div className="space-y-2">
          {payload.map((entry: PayloadItem, index: number) => {
            const isTrend = entry.dataKey === 'trend'
            const displayName = type === 'readiness' && entry.name === 'Session' ? 'Effort' : entry.name
            const valueLabel = typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value ?? '--'
            const readinessSuffix = type === 'readiness' && displayName === 'Effort' ? '/10' : ''
            return (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full shadow-sm" style={{ background: entry.color }} />
                  <span className="text-xs font-black text-strong opacity-80 uppercase tracking-tight">{displayName}:</span>
                </div>
                <span className="text-xs font-black text-strong tabular-nums">
                  {valueLabel}{readinessSuffix}{!isTrend && unit ? ` ${unit}` : ''}
                </span>
              </div>
            )
          })}

          {type === 'readiness' && payload.length >= 1 && (
            <div className="mt-3 border-t border-[var(--color-border)]/50 pt-3">
              {(() => {
                const readiness = payload.find((p: PayloadItem) => p.dataKey === 'score' || p.dataKey === 'readiness')?.value as number
                const effort = payload.find((p: PayloadItem) => p.dataKey === 'effort')?.value as number
                
                if (readiness !== undefined && effort !== undefined) {
                  let status = { label: 'Optimal', color: 'text-[var(--color-success)]', icon: '✅' }
                  
                  // Quadrant Logic
                  if (readiness < READINESS_EFFORT_SPLIT && effort >= EFFORT_HIGH_THRESHOLD) {
                    status = { label: 'Overreaching', color: 'text-[var(--color-danger)]', icon: '⚠️' }
                  } else if (readiness >= READINESS_EFFORT_SPLIT && effort >= EFFORT_HIGH_THRESHOLD) {
                    status = { label: 'Optimal', color: 'text-[var(--color-success)]', icon: '🔥' }
                  } else if (readiness < READINESS_EFFORT_SPLIT && effort < EFFORT_HIGH_THRESHOLD) {
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
                const actual = payload.find((p: PayloadItem) => p.dataKey === 'weight')?.value as number
                const trend = payload.find((p: PayloadItem) => p.dataKey === 'trend')?.value as number
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
