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
}

export function WeeklyVolumeChart({ data }: WeeklyVolumeChartProps) {
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

  const {
    left, right, refAreaLeft, refAreaRight,
    setRefAreaLeft, setRefAreaRight, zoom, zoomOut, isZoomed
  } = useChartZoom({ data: convertedData, dataKey: 'label' })

  const zoomedData = React.useMemo(() => {
    if (!left || !right) return convertedData
    const leftIndex = convertedData.findIndex(i => i.label === left)
    const rightIndex = convertedData.findIndex(i => i.label === right)
    const [start, end] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex]
    return convertedData.slice(start, end + 1)
  }, [convertedData, left, right])

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
           <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-primary)]" />
              <span className="text-[10px] font-black uppercase text-subtle">Volume ({displayUnit})</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[var(--color-warning)]" />
              <span className="text-[10px] font-black uppercase text-subtle">Training Load</span>
           </div>
        </div>
        {isZoomed && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={zoomOut}
            className="h-7 px-2 text-[10px] font-black uppercase tracking-widest gap-1.5"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Zoom
          </Button>
        )}
      </div>

      <div 
        className="h-64 w-full outline-none"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        tabIndex={-1}
        draggable="false"
      >
        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
          <LineChart 
            data={zoomedData}
            onMouseDown={(e) => { if (e?.activeLabel) setRefAreaLeft(e.activeLabel) }}
            onMouseMove={(e) => { if (refAreaLeft && e?.activeLabel) setRefAreaRight(e.activeLabel) }}
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
            />
            <YAxis 
              yAxisId="left"
              stroke="var(--color-primary)" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="var(--color-warning)" 
              fontSize={10} 
              fontWeight={700}
              tickLine={false}
              axisLine={false}
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

            {refAreaLeft && refAreaRight ? (
              <ReferenceArea yAxisId="left" x1={refAreaLeft} x2={refAreaRight} stroke="none" strokeWidth={0} fill="var(--color-primary)" fillOpacity={0.1} />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}