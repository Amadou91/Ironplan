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
  const correlationZoom = useChartZoom({ data: readinessCorrelation, dataKey: 'readiness' })

  // Zoomed data subsets for Y-axis scaling
  const zoomedEffortTrend = React.useMemo(() => {
    if (!effortZoom.left || !effortZoom.right) return effortTrend
    const leftIndex = effortTrend.findIndex(i => i.day === effortZoom.left)
    const rightIndex = effortTrend.findIndex(i => i.day === effortZoom.right)
    const [start, end] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex]
    return effortTrend.slice(start, end + 1)
  }, [effortTrend, effortZoom.left, effortZoom.right])

  const zoomedExerciseTrend = React.useMemo(() => {
    if (!exerciseZoom.left || !exerciseZoom.right) return convertedExerciseTrend
    const leftIndex = convertedExerciseTrend.findIndex(i => i.day === exerciseZoom.left)
    const rightIndex = convertedExerciseTrend.findIndex(i => i.day === exerciseZoom.right)
    const [start, end] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex]
    return convertedExerciseTrend.slice(start, end + 1)
  }, [convertedExerciseTrend, exerciseZoom.left, exerciseZoom.right])

  const zoomedWeightData = React.useMemo(() => {
    if (!weightZoom.left || !weightZoom.right) return convertedBodyWeightData
    const leftIndex = convertedBodyWeightData.findIndex(i => i.day === weightZoom.left)
    const rightIndex = convertedBodyWeightData.findIndex(i => i.day === weightZoom.right)
    const [start, end] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex]
    return convertedBodyWeightData.slice(start, end + 1)
  }, [convertedBodyWeightData, weightZoom.left, weightZoom.right])

  const zoomedReadinessSeries = React.useMemo(() => {
    if (!readinessZoom.left || !readinessZoom.right) return readinessSeries
    const leftIndex = readinessSeries.findIndex(i => i.day === readinessZoom.left)
    const rightIndex = readinessSeries.findIndex(i => i.day === readinessZoom.right)
    const [start, end] = leftIndex < rightIndex ? [leftIndex, rightIndex] : [rightIndex, leftIndex]
    return readinessSeries.slice(start, end + 1)
  }, [readinessSeries, readinessZoom.left, readinessZoom.right])

  const zoomedCorrelation = React.useMemo(() => {
    if (!correlationZoom.left || !correlationZoom.right) return readinessCorrelation
    const [min, max] = [correlationZoom.left, correlationZoom.right]
    return readinessCorrelation.filter(i => i.readiness >= (min as number) && i.readiness <= (max as number))
  }, [readinessCorrelation, correlationZoom.left, correlationZoom.right])

  const zoomedCorrelationTrend = React.useMemo(() => {
    if (!correlationZoom.left || !correlationZoom.right) return readinessTrendLine
    const [min, max] = [correlationZoom.left, correlationZoom.right]
    return readinessTrendLine.filter(i => i.readiness >= (min as number) && i.readiness <= (max as number))
  }, [readinessTrendLine, correlationZoom.left, correlationZoom.right])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-10 min-w-0 select-none">
        <ChartHeader title="Volume & load" />
        <WeeklyVolumeChart data={volumeTrend} />
      </Card>

      <Card className="p-10 min-w-0 select-none">
        <ChartHeader title="Effort trend" isZoomed={effortZoom.isZoomed} onReset={effortZoom.zoomOut} />
        <div 
          className="h-64 w-full outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={zoomedEffortTrend}
              onMouseDown={(e) => { if (e?.activeLabel) effortZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (effortZoom.refAreaLeft && e?.activeLabel) effortZoom.setRefAreaRight(e.activeLabel) }}
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
                <ReferenceArea x1={effortZoom.refAreaLeft} x2={effortZoom.refAreaRight} stroke="none" fill="var(--color-success)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {exerciseTrend.length > 0 && (
        <Card className="p-10 min-w-0 select-none">
          <ChartHeader title={`e1RM trend (${displayUnit})`} isZoomed={exerciseZoom.isZoomed} onReset={exerciseZoom.zoomOut} />
          <div 
            className="h-64 w-full outline-none"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={zoomedExerciseTrend}
                onMouseDown={(e) => { if (e?.activeLabel) exerciseZoom.setRefAreaLeft(e.activeLabel) }}
                onMouseMove={(e) => { if (exerciseZoom.refAreaLeft && e?.activeLabel) exerciseZoom.setRefAreaRight(e.activeLabel) }}
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
                  <ReferenceArea x1={exerciseZoom.refAreaLeft} x2={exerciseZoom.refAreaRight} stroke="none" fill="var(--color-warning)" fillOpacity={0.1} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-10 min-w-0 select-none">
        <ChartHeader title={`Bodyweight trend (${displayUnit})`} isZoomed={weightZoom.isZoomed} onReset={weightZoom.zoomOut} />
        <div 
          className="h-64 w-full outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={zoomedWeightData}
              onMouseDown={(e) => { if (e?.activeLabel) weightZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (weightZoom.refAreaLeft && e?.activeLabel) weightZoom.setRefAreaRight(e.activeLabel) }}
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
                <ReferenceArea x1={weightZoom.refAreaLeft} x2={weightZoom.refAreaRight} stroke="none" fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-10 min-w-0 select-none">
        <ChartHeader title="Readiness score trend" isZoomed={readinessZoom.isZoomed} onReset={readinessZoom.zoomOut} />
        <div 
          className="h-64 w-full outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={zoomedReadinessSeries}
              onMouseDown={(e) => { if (e?.activeLabel) readinessZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (readinessZoom.refAreaLeft && e?.activeLabel) readinessZoom.setRefAreaRight(e.activeLabel) }}
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
                <ReferenceArea x1={readinessZoom.refAreaLeft} x2={readinessZoom.refAreaRight} stroke="none" fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-10 min-w-0 select-none">
        <ChartHeader title="Readiness components" />
        <div 
          className="h-64 w-full outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          tabIndex={-1}
          draggable="false"
        >
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

      <Card className={`p-10 min-w-0 select-none ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
        <ChartHeader 
          title="Readiness vs session effort" 
          isZoomed={correlationZoom.isZoomed} 
          onReset={correlationZoom.zoomOut} 
        />
        <div 
          className="h-64 w-full outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={zoomedCorrelation}
              onMouseDown={(e) => { if (e?.activeLabel) correlationZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (correlationZoom.refAreaLeft && e?.activeLabel) correlationZoom.setRefAreaRight(e.activeLabel) }}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="readiness" 
                type="number" 
                name="Readiness" 
                domain={[correlationZoom.left || 0, correlationZoom.right || 100]} 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700} 
                tickLine={false} 
                axisLine={false} 
                allowDataOverflow
              />
              <YAxis 
                dataKey="effort" 
                type="number" 
                name="Effort" 
                domain={correlationZoom.isZoomed ? ['auto', 'auto'] : [0, 10]} 
                stroke="var(--color-text-subtle)" 
                fontSize={10} 
                fontWeight={700} 
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip content={<CustomTooltip type="readiness" />} cursor={{ strokeDasharray: '3 3' }} />
              {/* Overreaching: Low Readiness, High Effort */}
              <ReferenceArea x1={0} x2={50} y1={5} y2={10} fill="var(--color-danger)" fillOpacity={0.1} stroke="none" strokeWidth={0} ifOverflow="extend" />
              {/* Optimal: High Readiness, High Effort */}
              <ReferenceArea x1={50} x2={100} y1={5} y2={10} fill="var(--color-success)" fillOpacity={0.1} stroke="none" strokeWidth={0} ifOverflow="extend" />
              {/* Recovery: Low Readiness, Low Effort */}
              <ReferenceArea x1={0} x2={50} y1={0} y2={5} fill="var(--color-success)" fillOpacity={0.1} stroke="none" strokeWidth={0} ifOverflow="extend" />
              {/* Undertraining: High Readiness, Low Effort */}
              <ReferenceArea x1={50} x2={100} y1={0} y2={5} fill="var(--color-warning)" fillOpacity={0.1} stroke="none" strokeWidth={0} ifOverflow="extend" />
              <ReferenceLine x={50} stroke="var(--color-border)" strokeDasharray="3 3" />
              <ReferenceLine y={5} stroke="var(--color-border)" strokeDasharray="3 3" />
              <Scatter data={zoomedCorrelation} name="Session" fill="var(--color-primary)" />
              {!correlationZoom.isZoomed && (
                <Line data={zoomedCorrelationTrend} dataKey="effort" name="Trend" stroke="var(--color-text-subtle)" strokeDasharray="5 5" dot={false} strokeWidth={2} />
              )}
              {correlationZoom.refAreaLeft && correlationZoom.refAreaRight && (
                <ReferenceArea x1={correlationZoom.refAreaLeft} x2={correlationZoom.refAreaRight} stroke="none" strokeWidth={0} fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
