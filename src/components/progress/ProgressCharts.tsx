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
  ReferenceLine,
  Label,
  LabelList
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { WeeklyVolumeChart } from '@/components/progress/WeeklyVolumeChart'
import { useUIStore } from '@/store/uiStore'
import { LBS_PER_KG, KG_PER_LB } from '@/lib/units'
import { READINESS_HIGH_THRESHOLD, READINESS_LOW_THRESHOLD, EFFORT_HIGH_THRESHOLD } from '@/constants/training'
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

function ChartHeader({ title, isZoomed, onReset, children }: { title: string; isZoomed?: boolean; onReset?: () => void; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-h-[48px] antialiased">
      <div className="flex flex-col gap-2.5">
        <h3 className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.22em] text-strong leading-none">{title}</h3>
        {children}
      </div>
      {isZoomed && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReset}
          className="h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2 self-start sm:self-auto shrink-0 transition-all active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Zoom
        </Button>
      )}
    </div>
  )
}

const CHART_MARGIN = { top: 10, right: 10, left: 0, bottom: 30 }
const Y_AXIS_WIDTH = 45
const MIN_TICK_GAP = 16
const READINESS_EFFORT_SPLIT = Math.round((READINESS_LOW_THRESHOLD + READINESS_HIGH_THRESHOLD) / 2)

const formatCompactNumber = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${Math.round(value)}`
}

const IDEAL_TOLERANCE = 0.6
const WARNING_TOLERANCE = 1.3

/**
 * Metrics where a higher value is better (Sleep, Motivation).
 * For these, only penalise when value is BELOW the ideal.
 * Being above the ideal is never worse — it's green.
 *
 * Metrics not listed here (Soreness, Stress) are "lower is better":
 * penalise only when value is ABOVE the ideal.
 */
const HIGHER_IS_BETTER = new Set(['Sleep', 'Motivation'])

/** Returns how far "in the bad direction" the value is from its ideal. */
function badDistance(entry: ReadinessComponentPoint): number {
  if (HIGHER_IS_BETTER.has(entry.metric)) {
    // Penalise being below ideal; being above is fine (0 penalty)
    return Math.max(0, entry.ideal - entry.value)
  }
  // Penalise being above ideal; being below is fine (0 penalty)
  return Math.max(0, entry.value - entry.ideal)
}

function getReadinessComponentColor(entry: ReadinessComponentPoint) {
  const bad = badDistance(entry)
  if (bad <= IDEAL_TOLERANCE) return 'var(--color-success)'
  if (bad <= WARNING_TOLERANCE) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function getReadinessStatus(entry: ReadinessComponentPoint): string {
  const bad = badDistance(entry)
  if (bad <= IDEAL_TOLERANCE) return 'Good'
  if (bad <= WARNING_TOLERANCE) return 'Fair'
  return 'Poor'
}

function ReadinessBarLabel(props: { x?: number; y?: number; width?: number; value?: number; index?: number; readinessComponents: ReadinessComponentPoint[] }) {
  const { x = 0, y = 0, width = 0, value, index, readinessComponents } = props
  if (typeof value !== 'number' || typeof index !== 'number') return null
  const entry = readinessComponents[index]
  if (!entry) return null
  const color = getReadinessComponentColor(entry)
  return (
    <text x={x + width / 2} y={y - 8} fill={color} textAnchor="middle" fontSize={12} fontWeight={800}>
      {value}
    </text>
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
  const volumeCadenceLabel = volumeTrend[0]?.isDaily ? 'Daily totals' : 'Weekly totals'

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
  const volumeZoom = useChartZoom({ data: volumeTrend, dataKey: 'label' })
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 antialiased">
      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader 
          title="Volume & load" 
          isZoomed={volumeZoom.isZoomed} 
          onReset={volumeZoom.zoomOut}
        >
          <div className="flex flex-col gap-2">
            <div className="flex gap-5">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-chart-volume)]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-subtle/70">Volume ({displayUnit})</span>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-subtle/70">Training Load</span>
               </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">{volumeCadenceLabel} • dashed = trend</p>
          </div>
        </ChartHeader>
        <WeeklyVolumeChart data={volumeTrend} zoomProps={volumeZoom} />
      </Card>

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title="Effort trend" isZoomed={effortZoom.isZoomed} onReset={effortZoom.zoomOut}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">Avg session effort (RPE 1-10)</p>
        </ChartHeader>
        <div 
          className="h-64 w-full outline-none mt-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={zoomedEffortTrend}
              margin={CHART_MARGIN}
              onMouseDown={(e) => { if (e?.activeLabel) effortZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (effortZoom.refAreaLeft && e?.activeLabel) effortZoom.setRefAreaRight(e.activeLabel) }}
              onTouchStart={(e) => { if (e?.activeLabel) effortZoom.setRefAreaLeft(e.activeLabel) }}
              onTouchMove={(e) => { if (effortZoom.refAreaLeft && e?.activeLabel) effortZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => { effortZoom.setRefAreaLeft(null); effortZoom.setRefAreaRight(null) }}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                allowDataOverflow
                minTickGap={MIN_TICK_GAP}
                tickMargin={8}
                dy={10}
              />
              <YAxis 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                domain={[0, 10]}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <Line type="linear" dataKey="effort" name="Effort" stroke="var(--color-success)" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              {effortZoom.refAreaLeft && effortZoom.refAreaRight && (
                <ReferenceArea x1={effortZoom.refAreaLeft} x2={effortZoom.refAreaRight} stroke="none" fill="var(--color-success)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {exerciseTrend.length > 0 && (
        <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
          <ChartHeader title={`e1RM trend (${displayUnit})`} isZoomed={exerciseZoom.isZoomed} onReset={exerciseZoom.zoomOut}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">Daily bests • dashed = 7-day trend</p>
          </ChartHeader>
          <div 
            className="h-64 w-full outline-none mt-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseMove={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            tabIndex={-1}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={zoomedExerciseTrend}
                margin={CHART_MARGIN}
                onMouseDown={(e) => { if (e?.activeLabel) exerciseZoom.setRefAreaLeft(e.activeLabel) }}
                onMouseMove={(e) => { if (exerciseZoom.refAreaLeft && e?.activeLabel) exerciseZoom.setRefAreaRight(e.activeLabel) }}
                onTouchStart={(e) => { if (e?.activeLabel) exerciseZoom.setRefAreaLeft(e.activeLabel) }}
                onTouchMove={(e) => { if (exerciseZoom.refAreaLeft && e?.activeLabel) exerciseZoom.setRefAreaRight(e.activeLabel) }}
                onMouseLeave={() => { exerciseZoom.setRefAreaLeft(null); exerciseZoom.setRefAreaRight(null) }}
                style={{ outline: 'none' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="var(--color-text-subtle)" 
                  fontSize={11} 
                  fontWeight={800}
                  tickLine={false}
                  axisLine={false}
                  allowDataOverflow
                  minTickGap={MIN_TICK_GAP}
                  tickMargin={8}
                  dy={10}
                />
                <YAxis 
                  stroke="var(--color-text-subtle)" 
                  fontSize={11} 
                  fontWeight={800}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  tickFormatter={formatCompactNumber}
                  width={Y_AXIS_WIDTH}
                />
                <Tooltip 
                  content={<CustomTooltip unit={displayUnit} />} 
                  isAnimationActive={false}
                  wrapperStyle={{ pointerEvents: 'none' }}
                />
                <Scatter dataKey="e1rm" name="Daily best" fill="var(--color-warning)" isAnimationActive={false} />
                <Line type="linear" dataKey="trend" name="7-day trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                {exerciseZoom.refAreaLeft && exerciseZoom.refAreaRight && (
                  <ReferenceArea x1={exerciseZoom.refAreaLeft} x2={exerciseZoom.refAreaRight} stroke="none" fill="var(--color-warning)" fillOpacity={0.1} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title={`Bodyweight trend (${displayUnit})`} isZoomed={weightZoom.isZoomed} onReset={weightZoom.zoomOut}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">Dashed = linear trend</p>
        </ChartHeader>
        <div 
          className="h-64 w-full outline-none mt-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={zoomedWeightData}
              margin={CHART_MARGIN}
              onMouseDown={(e) => { if (e?.activeLabel) weightZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (weightZoom.refAreaLeft && e?.activeLabel) weightZoom.setRefAreaRight(e.activeLabel) }}
              onTouchStart={(e) => { if (e?.activeLabel) weightZoom.setRefAreaLeft(e.activeLabel) }}
              onTouchMove={(e) => { if (weightZoom.refAreaLeft && e?.activeLabel) weightZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => { weightZoom.setRefAreaLeft(null); weightZoom.setRefAreaRight(null) }}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                allowDataOverflow
                minTickGap={MIN_TICK_GAP}
                tickMargin={8}
                dy={10}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCompactNumber}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip 
                content={<CustomTooltip unit={displayUnit} type="bodyweight" />} 
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <Line type="linear" dataKey="weight" name="Weight" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              <Line type="linear" dataKey="trend" name="Trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
              {weightZoom.refAreaLeft && weightZoom.refAreaRight && (
                <ReferenceArea x1={weightZoom.refAreaLeft} x2={weightZoom.refAreaRight} stroke="none" fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title="Readiness score trend" isZoomed={readinessZoom.isZoomed} onReset={readinessZoom.zoomOut}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">
            0-100 score • low &lt; {READINESS_LOW_THRESHOLD} • high ≥ {READINESS_HIGH_THRESHOLD}
          </p>
        </ChartHeader>
        <div 
          className="h-64 w-full outline-none mt-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={zoomedReadinessSeries}
              margin={CHART_MARGIN}
              onMouseDown={(e) => { if (e?.activeLabel) readinessZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (readinessZoom.refAreaLeft && e?.activeLabel) readinessZoom.setRefAreaRight(e.activeLabel) }}
              onTouchStart={(e) => { if (e?.activeLabel) readinessZoom.setRefAreaLeft(e.activeLabel) }}
              onTouchMove={(e) => { if (readinessZoom.refAreaLeft && e?.activeLabel) readinessZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => { readinessZoom.setRefAreaLeft(null); readinessZoom.setRefAreaRight(null) }}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis 
                dataKey="day" 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                allowDataOverflow
                minTickGap={MIN_TICK_GAP}
                tickMargin={8}
                dy={10}
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800}
                tickLine={false}
                axisLine={false}
                width={Y_AXIS_WIDTH}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              <ReferenceLine y={READINESS_LOW_THRESHOLD} stroke="var(--color-warning)" strokeDasharray="4 4" />
              <ReferenceLine y={READINESS_HIGH_THRESHOLD} stroke="var(--color-success)" strokeDasharray="4 4" />
              <Line type="linear" dataKey="score" name="Score" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              {readinessZoom.refAreaLeft && readinessZoom.refAreaRight && (
                <ReferenceArea x1={readinessZoom.refAreaLeft} x2={readinessZoom.refAreaRight} stroke="none" fill="var(--color-primary)" fillOpacity={0.1} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title="Readiness components">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">1-5 scale • ◆ = ideal target</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-success)]" />
                <span className="text-[10px] font-bold text-subtle/70">Good</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-warning)]" />
                <span className="text-[10px] font-bold text-subtle/70">Fair</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[var(--color-danger)]" />
                <span className="text-[10px] font-bold text-subtle/70">Needs work</span>
              </div>
            </div>
            <p className="text-[9px] text-subtle/50">Sleep & Motivation: higher is better • Soreness & Stress: lower is better</p>
          </div>
        </ChartHeader>
        <div 
          className="h-64 w-full outline-none mt-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={readinessComponents} 
              margin={{ ...CHART_MARGIN, top: 24 }} 
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="metric" stroke="var(--color-text-subtle)" fontSize={11} fontWeight={800} tickLine={false} axisLine={false} minTickGap={MIN_TICK_GAP} tickMargin={8} dy={10} />
              <YAxis domain={[0, 5]} tickCount={6} stroke="var(--color-text-subtle)" fontSize={11} fontWeight={800} tickLine={false} axisLine={false} width={Y_AXIS_WIDTH} />
              <Tooltip
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0]?.payload as ReadinessComponentPoint | undefined
                  if (!entry) return null
                  const status = getReadinessStatus(entry)
                  const color = getReadinessComponentColor(entry)
                  return (
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-lg text-xs">
                      <p className="font-bold text-strong mb-1">{entry.metric}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-subtle">Score:</span>
                        <span className="font-bold" style={{ color }}>{entry.value}</span>
                        <span className="font-bold" style={{ color }}>({status})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-subtle">Ideal:</span>
                        <span className="font-bold text-strong">{entry.ideal}</span>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="value" name="Score" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                <LabelList
                  dataKey="value"
                  position="top"
                  content={(props) => <ReadinessBarLabel {...props as { x: number; y: number; width: number; value: number; index: number }} readinessComponents={readinessComponents} />}
                />
                {readinessComponents.map((entry: ReadinessComponentPoint) => {
                  const color = getReadinessComponentColor(entry)
                  return <Cell key={entry.metric} fill={color} fillOpacity={0.85} />
                })}
              </Bar>
              <Scatter dataKey="ideal" name="Ideal" shape="diamond" fill="var(--color-text)" stroke="var(--color-surface)" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className={`p-6 min-w-0 select-none flex flex-col glass-panel ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
        <ChartHeader 
          title="Readiness vs session effort" 
          isZoomed={correlationZoom.isZoomed} 
          onReset={correlationZoom.zoomOut} 
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle/50">Quadrants highlight recovery vs overreach • readiness split at {READINESS_EFFORT_SPLIT}</p>
        </ChartHeader>
        <div 
          className="h-64 w-full outline-none mt-auto"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
          draggable="false"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={zoomedCorrelation}
              margin={CHART_MARGIN}
              onMouseDown={(e) => { if (e?.activeLabel) correlationZoom.setRefAreaLeft(e.activeLabel) }}
              onMouseMove={(e) => { if (correlationZoom.refAreaLeft && e?.activeLabel) correlationZoom.setRefAreaRight(e.activeLabel) }}
              onTouchStart={(e) => { if (e?.activeLabel) correlationZoom.setRefAreaLeft(e.activeLabel) }}
              onTouchMove={(e) => { if (correlationZoom.refAreaLeft && e?.activeLabel) correlationZoom.setRefAreaRight(e.activeLabel) }}
              onMouseLeave={() => { correlationZoom.setRefAreaLeft(null); correlationZoom.setRefAreaRight(null) }}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} horizontal={false} />
              <XAxis 
                dataKey="readiness" 
                type="number" 
                name="Readiness" 
                domain={[correlationZoom.left || 0, correlationZoom.right || 100]} 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800} 
                tickLine={false} 
                axisLine={false} 
                allowDataOverflow
                minTickGap={MIN_TICK_GAP}
                tickMargin={8}
                dy={10}
              />
              <YAxis 
                dataKey="effort" 
                type="number" 
                name="Effort" 
                domain={correlationZoom.isZoomed ? ['auto', 'auto'] : [0, 10]} 
                stroke="var(--color-text-subtle)" 
                fontSize={11} 
                fontWeight={800} 
                tickLine={false} 
                axisLine={false} 
                width={Y_AXIS_WIDTH}
              />
              <Tooltip 
                content={<CustomTooltip type="readiness" />} 
                cursor={{ strokeDasharray: '3 3' }} 
                isAnimationActive={false}
                wrapperStyle={{ pointerEvents: 'none' }}
              />
              {/* Overreaching: Low Readiness, High Effort */}
              <ReferenceArea x1={0} x2={READINESS_EFFORT_SPLIT} y1={EFFORT_HIGH_THRESHOLD} y2={10} fill="var(--color-danger)" fillOpacity={0.08} stroke="none" strokeWidth={0} ifOverflow="extendDomain">
                <Label value="Overreaching" position="insideTopLeft" offset={10} fill="var(--color-danger)" fillOpacity={0.25} style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </ReferenceArea>
              {/* Optimal: High Readiness, High Effort */}
              <ReferenceArea x1={READINESS_EFFORT_SPLIT} x2={100} y1={EFFORT_HIGH_THRESHOLD} y2={10} fill="var(--color-success)" fillOpacity={0.08} stroke="none" strokeWidth={0} ifOverflow="extendDomain">
                <Label value="Optimal" position="insideTopRight" offset={10} fill="var(--color-success)" fillOpacity={0.25} style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </ReferenceArea>
              {/* Recovery: Low Readiness, Low Effort */}
              <ReferenceArea x1={0} x2={READINESS_EFFORT_SPLIT} y1={0} y2={EFFORT_HIGH_THRESHOLD} fill="var(--color-success)" fillOpacity={0.08} stroke="none" strokeWidth={0} ifOverflow="extendDomain">
                <Label value="Recovery" position="insideBottomLeft" offset={10} fill="var(--color-success)" fillOpacity={0.25} style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </ReferenceArea>
              {/* Undertraining: High Readiness, Low Effort */}
              <ReferenceArea x1={READINESS_EFFORT_SPLIT} x2={100} y1={0} y2={EFFORT_HIGH_THRESHOLD} fill="var(--color-warning)" fillOpacity={0.08} stroke="none" strokeWidth={0} ifOverflow="extendDomain">
                <Label value="Undertraining" position="insideBottomRight" offset={10} fill="var(--color-warning)" fillOpacity={0.25} style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              </ReferenceArea>
              <ReferenceLine x={READINESS_EFFORT_SPLIT} stroke="var(--color-border)" strokeDasharray="3 3" />
              <ReferenceLine y={EFFORT_HIGH_THRESHOLD} stroke="var(--color-border)" strokeDasharray="3 3" />
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
