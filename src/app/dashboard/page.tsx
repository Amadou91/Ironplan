'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { toMuscleLabel } from '@/lib/muscle-utils'

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '—'
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—'
  const diff = Math.max(0, endDate.getTime() - startDate.getTime())
  const minutes = Math.round(diff / 60000)
  return `${minutes} min`
}

const getWeekKey = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${temp.getUTCFullYear()}-W${week}`
}

type SessionRow = {
  id: string
  name: string
  workout_id: string | null
  started_at: string
  ended_at: string | null
  status: string | null
  session_exercises: Array<{
    id: string
    exercise_name: string
    primary_muscle: string | null
    secondary_muscles: string[] | null
    order_index: number | null
    sets: Array<{
      id: string
      set_number: number | null
      reps: number | null
      weight: number | null
      rpe: number | null
      rir: number | null
      notes: string | null
      completed: boolean | null
      performed_at: string | null
    }>
  }>
}

const chartColors = ['#6366f1', '#22c55e', '#0ea5e9', '#f59e0b', '#ec4899']

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const setUser = useAuthStore((state) => state.setUser)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('all')
  const [selectedExercise, setSelectedExercise] = useState('all')
  const [deletingSessionIds, setDeletingSessionIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (userLoading) return
    if (user) return

    const hydrateUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? null })
      }
    }

    hydrateUser()
  }, [supabase, user, userLoading, setUser])

  useEffect(() => {
    if (userLoading) return
    if (!user) return

    const loadSessions = async () => {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('sessions')
        .select(
          'id, name, workout_id, started_at, ended_at, status, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, notes, completed, performed_at))'
        )
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      if (fetchError) {
        console.error('Failed to load sessions', fetchError)
        setError('Unable to load sessions. Please try again.')
      } else {
        setSessions((data as SessionRow[]) ?? [])
      }
      setLoading(false)
    }

    loadSessions()
  }, [supabase, user, userLoading])
  const isLoading = userLoading || loading

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return
    if (!confirm('Delete this session and all of its logged sets? This cannot be undone.')) return
    setError(null)
    setDeletingSessionIds(prev => ({ ...prev, [sessionId]: true }))

    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete session', deleteError)
      setError('Unable to delete session. Please try again.')
    } else {
      setSessions(prev => prev.filter(session => session.id !== sessionId))
    }

    setDeletingSessionIds(prev => ({ ...prev, [sessionId]: false }))
  }

  const muscleOptions = useMemo(() => {
    const muscles = new Set<string>()
    sessions.forEach((session) => {
      session.session_exercises.forEach((exercise) => {
        if (exercise.primary_muscle) muscles.add(exercise.primary_muscle)
        exercise.secondary_muscles?.forEach((muscle) => muscles.add(muscle))
      })
    })
    return Array.from(muscles).sort()
  }, [sessions])

  const exerciseOptions = useMemo(() => {
    const names = new Set<string>()
    sessions.forEach((session) => {
      session.session_exercises.forEach((exercise) => {
        names.add(exercise.exercise_name)
      })
    })
    return Array.from(names).sort()
  }, [sessions])

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const date = new Date(session.started_at)
      if (startDate) {
        const start = new Date(startDate)
        if (!Number.isNaN(start.getTime()) && date < start) return false
      }
      if (endDate) {
        const end = new Date(endDate)
        if (!Number.isNaN(end.getTime()) && date > new Date(end.getTime() + 86400000)) return false
      }
      if (selectedExercise !== 'all') {
        const hasExercise = session.session_exercises.some((exercise) => exercise.exercise_name === selectedExercise)
        if (!hasExercise) return false
      }
      if (selectedMuscle !== 'all') {
        const hasMuscle = session.session_exercises.some((exercise) =>
          exercise.primary_muscle === selectedMuscle || exercise.secondary_muscles?.includes(selectedMuscle)
        )
        if (!hasMuscle) return false
      }
      return true
    })
  }, [sessions, startDate, endDate, selectedExercise, selectedMuscle])

  const allSets = useMemo(() => {
    return filteredSessions.flatMap((session) =>
      session.session_exercises.flatMap((exercise) =>
        (exercise.sets ?? []).map((set) => ({
          sessionId: session.id,
          sessionName: session.name,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          exerciseName: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle,
          secondaryMuscles: exercise.secondary_muscles ?? [],
          ...set
        }))
      )
    )
  }, [filteredSessions])

  const volumeTrend = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      const key = getWeekKey(set.performed_at ?? set.startedAt)
      totals.set(key, (totals.get(key) ?? 0) + reps * weight)
    })
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
  }, [allSets])

  const effortTrend = useMemo(() => {
    const daily = new Map<string, { total: number; count: number }>()
    allSets.forEach((set) => {
      const raw = typeof set.rpe === 'number' ? set.rpe : typeof set.rir === 'number' ? 10 - set.rir : null
      if (raw === null) return
      const key = formatDate(set.performed_at ?? set.startedAt)
      const current = daily.get(key) ?? { total: 0, count: 0 }
      daily.set(key, { total: current.total + raw, count: current.count + 1 })
    })
    return Array.from(daily.entries()).map(([day, value]) => ({
      day,
      effort: Number((value.total / value.count).toFixed(1))
    }))
  }, [allSets])

  const exerciseTrend = useMemo(() => {
    if (selectedExercise === 'all') return []
    const daily = new Map<string, number>()
    allSets
      .filter((set) => set.exerciseName === selectedExercise)
      .forEach((set) => {
        const reps = set.reps ?? 0
        const weight = set.weight ?? 0
        if (!reps || !weight) return
        const e1rm = weight * (1 + reps / 30)
        const key = formatDate(set.performed_at ?? set.startedAt)
        const current = daily.get(key)
        daily.set(key, Math.max(current ?? 0, e1rm))
      })
    return Array.from(daily.entries()).map(([day, e1rm]) => ({ day, e1rm: Math.round(e1rm) }))
  }, [allSets, selectedExercise])

  const muscleBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      const muscle = set.primaryMuscle ?? 'unknown'
      totals.set(muscle, (totals.get(muscle) ?? 0) + reps * weight)
    })
    return Array.from(totals.entries()).map(([muscle, volume]) => ({ muscle: toMuscleLabel(muscle), volume: Math.round(volume) }))
  }, [allSets])

  const prMetrics = useMemo(() => {
    let maxWeight = 0
    let bestE1rm = 0
    let bestReps = 0
    allSets.forEach((set) => {
      const reps = set.reps ?? 0
      const weight = set.weight ?? 0
      if (!reps || !weight) return
      maxWeight = Math.max(maxWeight, weight)
      bestReps = Math.max(bestReps, reps)
      const e1rm = weight * (1 + reps / 30)
      bestE1rm = Math.max(bestE1rm, e1rm)
    })
    return {
      maxWeight,
      bestReps,
      bestE1rm: Math.round(bestE1rm)
    }
  }, [allSets])

  const sessionsPerWeek = useMemo(() => {
    const weeks = new Set<string>()
    filteredSessions.forEach((session) => {
      weeks.add(getWeekKey(session.started_at))
    })
    return weeks.size ? Number((filteredSessions.length / weeks.size).toFixed(1)) : 0
  }, [filteredSessions])

  if (isLoading) {
    return <div className="p-10 text-center text-slate-400">Loading dashboard...</div>
  }

  if (!user) {
    return (
      <div className="p-10 text-center text-slate-400">
        <p className="mb-4">Sign in to view your dashboard.</p>
        <Button onClick={() => router.push('/auth/login')}>Go to Login</Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Track your sessions, volume, and progress over time.</p>
        </div>
        <Link href="/generate">
          <Button>Generate New Plan</Button>
        </Link>
      </div>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

      <Card className="border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="flex flex-col">
              <label className="text-xs text-slate-400">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-400">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-400">Muscle group</label>
              <select
                value={selectedMuscle}
                onChange={(event) => setSelectedMuscle(event.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                {muscleOptions.map((muscle) => (
                  <option key={muscle} value={muscle}>
                    {toMuscleLabel(muscle)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-slate-400">Exercise</label>
              <select
                value={selectedExercise}
                onChange={(event) => setSelectedExercise(event.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                {exerciseOptions.map((exercise) => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Consistency</h3>
          <p className="mt-3 text-3xl font-semibold text-white">{sessionsPerWeek}</p>
          <p className="text-xs text-slate-500">sessions per week</p>
        </Card>
        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">PR Snapshot</h3>
          <div className="mt-3 space-y-1 text-sm text-slate-300">
            <p>Max weight: <span className="text-white">{prMetrics.maxWeight}</span></p>
            <p>Best reps: <span className="text-white">{prMetrics.bestReps}</span></p>
            <p>Best e1RM: <span className="text-white">{prMetrics.bestE1rm}</span></p>
          </div>
        </Card>
        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Sessions</h3>
          <p className="mt-3 text-3xl font-semibold text-white">{filteredSessions.length}</p>
          <p className="text-xs text-slate-500">in selected range</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Volume by week</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="week" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Effort trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={effortTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="effort" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">e1RM trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exerciseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="e1rm" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {selectedExercise === 'all' && (
            <p className="mt-3 text-xs text-slate-500">Select an exercise to see e1RM trends.</p>
          )}
        </Card>
        <Card className="border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Muscle group volume</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={muscleBreakdown} dataKey="volume" nameKey="muscle" outerRadius={90}>
                  {muscleBreakdown.map((entry, index) => (
                    <Cell key={entry.muscle} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1f2937', color: '#e2e8f0' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Session history</h2>
          <span className="text-xs text-slate-400">{filteredSessions.length} session(s)</span>
        </div>
        <div className="divide-y divide-slate-800">
          {filteredSessions.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">No sessions logged for this range yet.</div>
          ) : (
            filteredSessions.map((session) => (
              <div key={session.id} className="p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{session.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(session.started_at)} · {formatDuration(session.started_at, session.ended_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{session.session_exercises.length} exercise(s)</span>
                    <Button
                      type="button"
                      onClick={() => handleDeleteSession(session.id)}
                      className="h-8 px-3 text-xs border border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                      variant="outline"
                      disabled={Boolean(deletingSessionIds[session.id])}
                    >
                      {deletingSessionIds[session.id] ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {session.session_exercises.map((exercise) => (
                    <div key={exercise.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
                      <p className="text-sm font-semibold text-white">{exercise.exercise_name}</p>
                      <p className="text-slate-500">Primary: {exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : '—'}</p>
                      <p className="text-slate-500">Secondary: {exercise.secondary_muscles?.length ? exercise.secondary_muscles.map((muscle) => toMuscleLabel(muscle)).join(', ') : '—'}</p>
                      <div className="mt-2 space-y-1">
                        {(exercise.sets ?? []).map((set) => (
                          <div key={set.id} className="flex items-center justify-between rounded border border-slate-800 px-2 py-1">
                            <span>Set {set.set_number ?? '—'}</span>
                            <span>
                              {set.weight ?? '—'} lb × {set.reps ?? '—'} reps
                              {typeof set.rpe === 'number' ? ` · RPE ${set.rpe}` : ''}
                              {typeof set.rir === 'number' ? ` · RIR ${set.rir}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
