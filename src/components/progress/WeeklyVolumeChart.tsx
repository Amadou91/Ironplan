'use client'

import React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea
} from 'recharts'
import { useUIStore } from '@/store/uiStore'
import { KG_PER_LB } from '@/lib/units'
import { useChartZoom } from '@/hooks/useChartZoom'
import { CustomTooltip } from '@/components/progress/CustomTooltip'
import { Button } from '@/components/ui/Button'
import { RotateCcw } from 'lucide-react'

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

export function WeeklyVolumeChart({ data, zoomProps }: WeeklyVolumeChartProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  const convertedData = React.useMemo(() => {
    if (isKg) {
      return data.map(p => ({
        ...p,
        volume: Math.round(p.volume * KG_PER_LB),
      }))
    }
    return data
  }, [data, isKg])

  const internalZoom = useChartZoom({ data: convertedData, dataKey: 'label' })
  const zoom = zoomProps || internalZoom

  const zoomedData = React.useMemo(() => {
    if (!zoom.left || !zoom.right) return convertedData
    const leftIndex = convertedData.findIndex(i => i.label === zoom.left)
    const rightIndex = convertedData.findIndex(i => i.label === zoom.right)
    const [start, end] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex]
    return convertedData.slice(start, end + 1)
  }, [convertedData, zoom.left, zoom.right])

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
          <LineChart 
            data={zoomedData}
            margin={CHART_MARGIN}
            onMouseDown={(e) => { if (e?.activeLabel) zoom.setRefAreaLeft(e.activeLabel) }}
            onMouseMove={(e) => { if (zoom.refAreaLeft && e?.activeLabel) zoom.setRefAreaRight(e.activeLabel) }}
            style={{ outline: 'none' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis 
              dataKey="label" 
              stroke="var(--color-text-subtle)" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              allowDataOverflow
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              stroke="var(--color-primary)" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
              width={Y_AXIS_WIDTH}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="var(--color-warning)" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
            />
            <Tooltip content={<CustomTooltip unit={displayUnit} type="volume" />} />
            
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="volume" 
              name="Volume" 
              stroke="var(--color-primary)" 
              strokeWidth={3} 
              dot={{ r: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={300}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="load" 
              name="Load" 
              stroke="var(--color-warning)" 
              strokeWidth={3} 
              dot={{ r: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationDuration={300}
            />

            {zoom.refAreaLeft && zoom.refAreaRight ? (
              <ReferenceArea yAxisId="left" x1={zoom.refAreaLeft} x2={zoom.refAreaRight} stroke="none" strokeWidth={0} fill="var(--color-primary)" fillOpacity={0.1} />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}