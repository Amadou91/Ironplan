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
  Label
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { WeeklyVolumeChart } from '@/components/progress/WeeklyVolumeChart'
import { useUIStore } from '@/store/uiStore'
import { LBS_PER_KG, KG_PER_LB } from '@/lib/units'
import { READINESS_HIGH_THRESHOLD, READINESS_LOW_THRESHOLD, EFFORT_HIGH_THRESHOLD } from '@/constants/training'
import { CustomTooltip } from '@/components/progress/CustomTooltip'
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

function ChartHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-h-[48px] antialiased">
      <div className="flex flex-col gap-2.5">
        <h3 className="text-[12px] sm:text-[13px] font-black uppercase tracking-[0.22em] text-strong leading-none">{title}</h3>
        {children}
      </div>
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
 */
const HIGHER_IS_BETTER = new Set(['Sleep', 'Motivation'])

/** Returns how far "in the bad direction" the value is from its ideal. */
function badDistance(entry: ReadinessComponentPoint): number {
  if (HIGHER_IS_BETTER.has(entry.metric)) {
    return Math.max(0, entry.ideal - entry.value)
  }
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 antialiased">
      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title="Volume & load">
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
        <WeeklyVolumeChart data={volumeTrend} />
      </Card>

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title="Effort trend">
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
              data={effortTrend}
              margin={CHART_MARGIN}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {exerciseTrend.length > 0 && (
        <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
          <ChartHeader title={`e1RM trend (${displayUnit})`}>
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
                data={convertedExerciseTrend}
                margin={CHART_MARGIN}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title={`Bodyweight trend (${displayUnit})`}>
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
              data={convertedBodyWeightData}
              margin={CHART_MARGIN}
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 min-w-0 select-none flex flex-col glass-panel">
        <ChartHeader title="Readiness score trend">
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
              data={readinessSeries}
              margin={CHART_MARGIN}
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
                {readinessComponents.map((entry: ReadinessComponentPoint) => {
                  const color = getReadinessComponentColor(entry)
                  return <Cell key={entry.metric} fill={color} fillOpacity={0.85} />
                })}
              </Bar>
              <Scatter dataKey="ideal" name="Ideal" shape="diamond" fill="var(--color-text)" stroke="var(--color-surface)" strokeWidth={2} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className={`p-6 min-w-0 select-none flex flex-col glass-panel ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
        <ChartHeader 
          title="Readiness vs session effort" 
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
              data={readinessCorrelation}
              margin={CHART_MARGIN}
              style={{ outline: 'none' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} horizontal={false} />
              <XAxis 
                dataKey="readiness" 
                type="number" 
                name="Readiness" 
                domain={[0, 100]} 
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
                domain={[0, 10]} 
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
              <Scatter data={readinessCorrelation} name="Session" fill="var(--color-primary)" isAnimationActive={false} />
              <Line data={readinessTrendLine} dataKey="effort" name="Trend" stroke="var(--color-text-subtle)" strokeDasharray="5 5" dot={false} strokeWidth={2} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
