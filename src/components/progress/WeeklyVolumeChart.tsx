'use client'

import React from 'react'
import {
  CartesianGrid,
  Line,
  ComposedChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'
import { CustomTooltip } from '@/components/progress/CustomTooltip'

interface VolumeTrendPoint {
  label: string
  volume: number
  load: number
  isDaily?: boolean
}

interface WeeklyVolumeChartProps {
  data: VolumeTrendPoint[]
  zoomProps?: {
    left: string | number | null
    right: string | number | null
    refAreaLeft: string | number | null
    refAreaRight: string | number | null
    setRefAreaLeft: (val: string | number | null) => void
    setRefAreaRight: (val: string | number | null) => void
  }
}

const CHART_MARGIN = { top: 10, right: 10, left: 0, bottom: 30 }
const Y_AXIS_WIDTH = 45
const MIN_TICK_GAP = 16

const formatCompactNumber = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${Math.round(value)}`
}

const parseWeekLabel = (label: string | number) => {
  if (typeof label !== 'string') return null
  const match = label.match(/^(\d{4})-W(\d{1,2})$/)
  if (!match) return null
  return { year: match[1], week: match[2].padStart(2, '0') }
}

const formatWeekTick = (label: string | number) => {
  const parsed = parseWeekLabel(label)
  return parsed ? `W${parsed.week}` : String(label)
}

const formatWeekLabel = (label: string | number) => {
  const parsed = parseWeekLabel(label)
  return parsed ? `Week ${parsed.week}, ${parsed.year}` : String(label)
}

/**
 * Calculate linear regression trend line values
 */
function calculateTrendLine(data: number[]): number[] {
  if (data.length < 2) return data
  
  const n = data.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += data[i]
    sumXY += i * data[i]
    sumX2 += i * i
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  return data.map((_, i) => Math.max(0, intercept + slope * i))
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

  // Calculate trend lines for volume and load
  const dataWithTrends = React.useMemo(() => {
    if (convertedData.length < 2) return convertedData.map(p => ({ ...p, volumeTrend: p.volume, loadTrend: p.load }))
    
    const volumeValues = convertedData.map(p => p.volume)
    const loadValues = convertedData.map(p => p.load)
    
    const volumeTrend = calculateTrendLine(volumeValues)
    const loadTrend = calculateTrendLine(loadValues)
    
    return convertedData.map((p, i) => ({
      ...p,
      volumeTrend: Math.round(volumeTrend[i]),
      loadTrend: Math.round(loadTrend[i])
    }))
  }, [convertedData])

  const isDailyView = dataWithTrends[0]?.isDaily ?? false

  return (
    <div className="flex flex-col h-full">
      <div 
        className="h-64 w-full outline-none mt-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        tabIndex={-1}
        draggable="false"
      >
        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
          <ComposedChart 
            data={dataWithTrends}
            margin={CHART_MARGIN}
            style={{ outline: 'none' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis 
              dataKey="label" 
              stroke="var(--color-text-subtle)" 
              fontSize={11} 
              fontWeight={800}
              tickLine={false}
              axisLine={false}
              allowDataOverflow
              tickFormatter={isDailyView ? undefined : formatWeekTick}
              minTickGap={MIN_TICK_GAP}
              tickMargin={8}
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              stroke="var(--color-chart-volume)" 
              fontSize={11} 
              fontWeight={800}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactNumber}
              width={Y_AXIS_WIDTH}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="var(--color-primary)" 
              fontSize={11} 
              fontWeight={800}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompactNumber}
              width={Y_AXIS_WIDTH}
            />
            <Tooltip 
              content={<CustomTooltip unit={displayUnit} type="volume" labelFormatter={isDailyView ? undefined : formatWeekLabel} />} 
              isAnimationActive={false}
              wrapperStyle={{ pointerEvents: 'none' }}
            />
            
            <Bar 
              yAxisId="left"
              dataKey="volume" 
              name="Volume" 
              fill="var(--color-chart-volume)"
              fillOpacity={0.35}
              radius={[6, 6, 0, 0]}
              barSize={18}
              isAnimationActive={false}
            />

            {/* Volume trend line - subtle dashed line */}
            <Line 
              yAxisId="left"
              type="linear" 
              dataKey="volumeTrend" 
              name="Volume Trend" 
              stroke="var(--color-chart-volume)" 
              strokeWidth={1.5} 
              strokeDasharray="6 4"
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            
            {/* Load trend line - subtle dashed line */}
            <Line 
              yAxisId="right"
              type="linear" 
              dataKey="loadTrend" 
              name="Load Trend" 
              stroke="var(--color-primary)" 
              strokeWidth={1.5} 
              strokeDasharray="6 4"
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />
            
            <Line 
              yAxisId="right"
              type="linear" 
              dataKey="load" 
              name="Load" 
              stroke="var(--color-primary)" 
              strokeWidth={3} 
              dot={{ r: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

