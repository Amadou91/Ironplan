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

interface ProgressChartsProps {
  volumeTrend: any[]
  effortTrend: any[]
  exerciseTrend: any[]
  bodyWeightData: any[]
  readinessSeries: any[]
  readinessComponents: any[]
  readinessCorrelation: any[]
  readinessTrendLine: any[]
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
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6 min-w-0">
        <div className="mb-4 flex items-center">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Volume & load</h3>
        </div>
        <WeeklyVolumeChart data={volumeTrend} />
      </Card>

      <Card className="p-6 min-w-0">
        <div className="mb-4 flex items-center">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Effort trend</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={effortTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
              <YAxis stroke="var(--color-text-subtle)" />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="effort" stroke="var(--color-success)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {exerciseTrend.length > 0 && (
        <Card className="p-6 min-w-0">
          <div className="mb-4 flex items-center">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">e1RM trend</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exerciseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
                <YAxis stroke="var(--color-text-subtle)" />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="e1rm" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-6 min-w-0">
        <div className="mb-4 flex items-center">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Bodyweight trend</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bodyWeightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
              <YAxis domain={['auto', 'auto']} stroke="var(--color-text-subtle)" />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="weight" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="trend" stroke="var(--color-text-subtle)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 min-w-0">
        <div className="mb-4 flex items-center">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness score trend</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={readinessSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="day" stroke="var(--color-text-subtle)" />
              <YAxis domain={[0, 100]} stroke="var(--color-text-subtle)" />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="score" stroke="var(--color-primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6 min-w-0">
        <div className="mb-4 flex items-center">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness components</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={readinessComponents}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="metric" stroke="var(--color-text-subtle)" />
              <YAxis domain={[1, 5]} stroke="var(--color-text-subtle)" />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
              <Bar dataKey="value">
                {readinessComponents.map((entry: any) => {
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

      <Card className={`p-6 min-w-0 ${exerciseTrend.length > 0 ? 'lg:col-span-2' : ''}`}>
        <div className="mb-4 flex items-center">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Readiness vs session effort</h3>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="readiness" type="number" domain={[0, 100]} stroke="var(--color-text-subtle)" />
              <YAxis dataKey="effort" type="number" domain={[0, 10]} stroke="var(--color-text-subtle)" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceArea x1={0} x2={50} y1={5} y2={10} fill="var(--color-danger)" fillOpacity={0.03} />
              <ReferenceArea x1={50} x2={100} y1={5} y2={10} fill="var(--color-success)" fillOpacity={0.03} />
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
