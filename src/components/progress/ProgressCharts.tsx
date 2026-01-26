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
  ComposedChart,
  Bar,
  Cell,
  Scatter,
  ReferenceArea,
  ReferenceLine
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { WeeklyVolumeChart } from '@/components/progress/WeeklyVolumeChart'
import { useUIStore } from '@/store/uiStore'
import { LBS_PER_KG, KG_PER_LB } from '@/lib/units'
import { useChartZoom } from '@/hooks/useChartZoom'
import { CustomTooltip } from '@/components/progress/CustomTooltip'
import { Button } from '@/components/ui/Button'
import { RotateCcw } from 'lucide-react'
import type { 
  VolumeTrendPoint, 
  EffortTrendPoint, 
  ExerciseTrendPoint, 
  BodyWeightTrendPoint, 
  ReadinessTrendPoint 
} from '@/lib/transformers/chart-data'

export interface ReadinessComponentPoint {
  metric: string
  value: number
  ideal: number
}

export interface ReadinessCorrelationPoint {
  readiness: number
  effort: number
  workload: number
}

export interface ReadinessTrendLinePoint {
  readiness: number
  effort: number
}

interface ProgressChartsProps {
  volumeTrend: VolumeTrendPoint[]
  effortTrend: EffortTrendPoint[]
  exerciseTrend: ExerciseTrendPoint[]
  bodyWeightData: BodyWeightTrendPoint[]
  readinessSeries: ReadinessTrendPoint[]
  readinessComponents: ReadinessComponentPoint[]
  readinessCorrelation: ReadinessCorrelationPoint[]
  readinessTrendLine: ReadinessTrendLinePoint[]
}

function ChartHeader({ title, isZoomed, onReset }: { title: string; isZoomed?: boolean; onReset?: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-subtle">{title}</h3>
      {isZoomed && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReset}
          className="h-7 px-2 text-[10px] font-black uppercase tracking-widest gap-1.5"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Zoom
        </Button>
      )}
    </div>
  )
}

export function ProgressCharts({
  volumeTrend,
  effortTrend,
  exerciseTrend,
  bodyWeightData,
  readinessSeries,
  readinessComponents,
  readinessCorrelation,
  readinessTrendLine
}: ProgressChartsProps) {
  const { displayUnit } = useUIStore()
  const isKg = displayUnit === 'kg'

  const convertedExerciseTrend = React.useMemo(() => {
    if (!isKg) {
      return exerciseTrend.map(p => ({
        ...p,
        e1rm: Math.round(p.e1rm * LBS_PER_KG),
        trend: p.trend ? Math.round(p.trend * LBS_PER_KG) : null
      }))
    }
    return exerciseTrend
  }, [exerciseTrend, isKg])

  const convertedBodyWeightData = React.useMemo(() => {
    if (isKg) {
      return bodyWeightData.map(p => ({
        ...p,
        weight: Math.round(p.weight * KG_PER_LB * 10) / 10,
        trend: p.trend ? Math.round(p.trend * KG_PER_LB * 10) / 10 : null
      }))
    }
    return bodyWeightData
  }, [bodyWeightData, isKg])

  // Zoom states
  const effortZoom = useChartZoom({ data: effortTrend, dataKey: 'day' })
  const exerciseZoom = useChartZoom({ data: convertedExerciseTrend, dataKey: 'day' })
  const weightZoom = useChartZoom({ data: convertedBodyWeightData, dataKey: 'day' })
  const readinessZoom = useChartZoom({ data: readinessSeries, dataKey: 'day' })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-10 min-w-0">
        <ChartHeader title="Volume & load" />
        <WeeklyVolumeChart data={volumeTrend} />
      </Card>

      <Card className="p-10 min-w-0">
        <ChartHeader title="Effort trend" isZoomed={effortZoom.isZoomed} onReset={effortZoom.zoomOut} />
        <div className="h-64 w-full select-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={effortTrend}
              onMouseDown={(e) => { if (e?.activeLabel) effortZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (effortZoom.refAreaLeft && e?.activeLabel) effortZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => effortZoom.setRefAreaRight(null)}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700}
                tickLine={false}
                axisLine={false}
                domain={[effortZoom.left || 'auto', effortZoom.right || 'auto']}
                allowDataOverflow
              />
              <YAxis 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700}
                tickLine={false}
                axisLine={false}
                domain={[0, 10]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="effort" name="Effort" stroke="var(--color-success)" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} animationDuration={300} />
              {effortZoom.refAreaLeft && effortZoom.refAreaRight && (
                <ReferenceArea x1={effortZoom.refAreaLeft} x2={effortZoom.refAreaRight} strokeOpacity={0.3} fill="var(--color-success)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {exerciseTrend.length > 0 && (
        <Card className="p-10 min-w-0">
          <ChartHeader title={`e1RM trend (${displayUnit})`} isZoomed={exerciseZoom.isZoomed} onReset={exerciseZoom.zoomOut} />
          <div className="h-64 w-full select-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={convertedExerciseTrend}
                onMouseDown={(e) => { if (e?.activeLabel) exerciseZoom.setRefAreaLeft(e.activeLabel) }}
                onMouseMove={(e) => { if (exerciseZoom.refAreaLeft && e?.activeLabel) exerciseZoom.setRefAreaRight(e.activeLabel) }}
                onMouseLeave={() => exerciseZoom.setRefAreaRight(null)}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="var(--color-text-subtle)" 
                  fontSize={10} 
                  fontWeight={700}
                  tickLine={false}
                  axisLine={false}
                  domain={[exerciseZoom.left || 'auto', exerciseZoom.right || 'auto']}
                  allowDataOverflow
                />
                <YAxis 
                  stroke="var(--color-text-subtle)" 
                  fontSize={10} 
                  fontWeight={700}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip unit={displayUnit} />} />
                <Line type="monotone" dataKey="e1rm" name="e1RM" stroke="var(--color-warning)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} animationDuration={300} />
                <Line type="monotone" dataKey="trend" name="Trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                {exerciseZoom.refAreaLeft && exerciseZoom.refAreaRight && (
                  <ReferenceArea x1={exerciseZoom.refAreaLeft} x2={exerciseZoom.refAreaRight} strokeOpacity={0.3} fill="var(--color-warning)" fillOpacity={0.1} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-10 min-w-0">
        <ChartHeader title={`Bodyweight trend (${displayUnit})`} isZoomed={weightZoom.isZoomed} onReset={weightZoom.zoomOut} />
        <div className="h-64 w-full select-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={convertedBodyWeightData}
              onMouseDown={(e) => { if (e?.activeLabel) weightZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (weightZoom.refAreaLeft && e?.activeLabel) weightZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => weightZoom.setRefAreaRight(null)}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700}
                tickLine={false}
                axisLine={false}
                domain={[weightZoom.left || 'auto', weightZoom.right || 'auto']}
                allowDataOverflow
              />
              <YAxis 
                domain={['auto', 'auto']} 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip unit={displayUnit} type="bodyweight" />} />
              <Line type="monotone" dataKey="weight" name="Weight" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} animationDuration={300} />
              <Line type="monotone" dataKey="trend" name="Trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              {weightZoom.refAreaLeft && weightZoom.refAreaRight && (
                <ReferenceArea x1={weightZoom.refAreaLeft} x2={weightZoom.refAreaRight} strokeOpacity={0.3} fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-10 min-w-0">
        <ChartHeader title="Readiness score trend" isZoomed={readinessZoom.isZoomed} onReset={readinessZoom.zoomOut} />
        <div className="h-64 w-full select-none">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={readinessSeries}
              onMouseDown={(e) => { if (e?.activeLabel) readinessZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (readinessZoom.refAreaLeft && e?.activeLabel) readinessZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => readinessZoom.setRefAreaRight(null)}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700}
                tickLine={false}
                axisLine={false}
                domain={[readinessZoom.left || 'auto', readinessZoom.right || 'auto']}
                allowDataOverflow
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="score" name="Score" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} animationDuration={300} />
              {readinessZoom.refAreaLeft && readinessZoom.refAreaRight && (
                <ReferenceArea x1={readinessZoom.refAreaLeft} x2={readinessZoom.refAreaRight} strokeOpacity={0.3} fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-10 min-w-0">
        <ChartHeader title="Readiness components" />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={readinessComponents} style={{ outline: 'none' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="metric" stroke="var(--color-text-subtle)" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} />
              <YAxis domain={[1, 5]} stroke="var(--color-text-subtle)" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Score">
                {readinessComponents.map((entry: ReadinessComponentPoint) => {
                  let color = '#0ea5e9'
                  if (entry.metric === 'Sleep' || entry.metric === 'Motivation') {
                    if (entry.value >= 4) color = '#1f9d55'
                    else if (entry.value >= 3) color = '#f59e0b'
                    else color = '#f05a28'
                  } else {
                    if (entry.value <= 2) color = '#1f9d55'
                    else if (entry.value <= 3) color = '#f59e0b'
                    else color = '#f05a28'
                  }
                  return <Cell key={entry.metric} fill={color} />
                })}
              </Bar>
              <Scatter dataKey="ideal" name="Ideal" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className={`p-10 min-w-0 ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
        <ChartHeader title="Readiness vs session effort" />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart style={{ outline: 'none' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="readiness" type="number" name="Readiness" domain={[0, 100]} stroke="var(--color-text-subtle)" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} />
              <YAxis dataKey="effort" type="number" name="Effort" domain={[0, 10]} stroke="var(--color-text-subtle)" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip type="readiness" />} cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceArea x1={0} x2={50} y1={5} y2={10} fill="var(--color-danger)" fillOpacity={0.1} />
              <ReferenceArea x1={50} x2={100} y1={0} y2={5} fill="var(--color-success)" fillOpacity={0.1} />
              <ReferenceLine x={50} stroke="var(--color-border)" strokeDasharray="3 3" />
              <ReferenceLine y={5} stroke="var(--color-border)" strokeDasharray="3 3" />
              <Scatter data={readinessCorrelation} name="Session" fill="var(--color-primary)" />
              <Line data={readinessTrendLine} dataKey="effort" name="Trend" stroke="var(--color-text-subtle)" strokeDasharray="5 5" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
