'use client'

import React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'

interface VolumeTrendPoint {
  label: string
  volume: number
  load: number
  isDaily?: boolean
}

interface WeeklyVolumeChartProps {
  data: VolumeTrendPoint[]
}

export function WeeklyVolumeChart({ data }: WeeklyVolumeChartProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  const convertedData = React.useMemo(() => {
    if (isKg) {
      return data.map(p => ({
        ...p,
        volume: Math.round(p.volume * KG_PER_LB),
        load: Math.round(p.load * KG_PER_LB)
      }))
    }
    return data
  }, [data, isKg])

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
        <LineChart data={convertedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" stroke="var(--color-text-subtle)" fontSize={12} font-weight={500} />
          <YAxis stroke="var(--color-text-subtle)" fontSize={12} font-weight={500} />
          <Tooltip 
            contentStyle={{ 
              background: 'var(--color-surface)', 
              border: '1px solid var(--color-border)', 
              color: 'var(--color-text)',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: 'var(--shadow-md)'
            }} 
            itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
            labelStyle={{ color: 'var(--color-text)', fontWeight: 700, marginBottom: '4px' }}
          />
          <Legend formatter={(value) => `${value} (${displayUnit})`} />
          <Line type="monotone" dataKey="volume" name="Volume" stroke="var(--color-primary)" strokeWidth={2} />
          <Line type="monotone" dataKey="load" name="Load" stroke="var(--color-warning)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
