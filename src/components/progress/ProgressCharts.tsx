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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-10 min-w-0">
        <div className="mb-6 flex items-center">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Volume & load</h3>
        </div>
        <WeeklyVolumeChart data={volumeTrend} />
      </Card>

      <Card className="p-10 min-w-0">
        <div className="mb-6 flex items-center">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Effort trend</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={effortTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-subtle)" fontSize={12} />
              <YAxis stroke="var(--color-text-subtle)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '14px', boxShadow: 'var(--shadow-md)' }} />
              <Line type="monotone" dataKey="effort" stroke="var(--color-success)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {exerciseTrend.length > 0 && (
        <Card className="p-10 min-w-0">
          <div className="mb-6 flex items-center">
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">e1RM trend ({displayUnit})</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={convertedExerciseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-text-subtle)" fontSize={12} />
                <YAxis stroke="var(--color-text-subtle)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '14px', boxShadow: 'var(--shadow-md)' }} />
                <Line type="monotone" dataKey="e1rm" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-10 min-w-0">
        <div className="mb-6 flex items-center">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Bodyweight trend ({displayUnit})</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={convertedBodyWeightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-subtle)" fontSize={12} />
              <YAxis domain={['auto', 'auto']} stroke="var(--color-text-subtle)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '14px', boxShadow: 'var(--shadow-md)' }} />
              <Line type="monotone" dataKey="weight" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-10 min-w-0">
        <div className="mb-6 flex items-center">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Readiness score trend</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readinessSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-subtle)" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="var(--color-text-subtle)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '14px', boxShadow: 'var(--shadow-md)' }} />
              <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-10 min-w-0">
        <div className="mb-6 flex items-center">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Readiness components</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={readinessComponents}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="metric" stroke="var(--color-text-subtle)" fontSize={12} />
              <YAxis domain={[1, 5]} stroke="var(--color-text-subtle)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', fontSize: '14px', boxShadow: 'var(--shadow-md)' }} />
              <Bar dataKey="value">
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
              <Scatter dataKey="ideal" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className={`p-10 min-w-0 ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
        <div className="mb-6 flex items-center">
          <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-subtle">Readiness vs session effort</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="readiness" type="number" domain={[0, 100]} stroke="var(--color-text-subtle)" fontSize={12} />
              <YAxis dataKey="effort" type="number" domain={[0, 10]} stroke="var(--color-text-subtle)" fontSize={12} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceArea x1={0} x2={50} y1={5} y2={10} fill="var(--color-danger)" fillOpacity={0.15} />
              <ReferenceArea x1={50} x2={100} y1={5} y2={10} fill="var(--color-success)" fillOpacity={0.15} />
              <ReferenceLine x={50} stroke="var(--color-border)" strokeDasharray="3 3" />
              <ReferenceLine y={5} stroke="var(--color-border)" strokeDasharray="3 3" />
              <Scatter data={readinessCorrelation} fill="var(--color-primary)" />
              <Line data={readinessTrendLine} dataKey="effort" stroke="var(--color-text-subtle)" strokeDasharray="5 5" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
