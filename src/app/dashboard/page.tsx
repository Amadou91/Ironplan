'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

type WorkoutSummary = {
  id: string
  title: string
  description: string | null
  goal: string | null
  level: string | null
  created_at: string
  exercises:
    | {
        summary?: {
          sessionsPerWeek?: number
          totalMinutes?: number
          impact?: { score?: number }
        }
      }
    | null
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: userLoading } = useUser()
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      setLoading(false)
      return
    }

    const loadWorkouts = async () => {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('workouts')
        .select('id, title, description, goal, level, exercises, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('Failed to load workouts', fetchError)
        setError('Unable to load workouts. Please try again.')
      } else {
        setWorkouts(data ?? [])
      }
      setLoading(false)
    }

    loadWorkouts()
  }, [supabase, user, userLoading])

  const workoutCards = useMemo(
    () =>
      workouts.map((workout) => {
        const summary = workout.exercises?.summary
        return {
          ...workout,
          sessionsPerWeek: summary?.sessionsPerWeek,
          totalMinutes: summary?.totalMinutes,
          impactScore: summary?.impact?.score
        }
      }),
    [workouts]
  )

  if (userLoading || loading) {
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
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Track your generated plans and jump back in fast.</p>
        </div>
        <Link href="/generate">
          <Button>Generate New Plan</Button>
        </Link>
      </div>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

      <Card className="border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Saved Workouts</h2>
          <span className="text-xs text-slate-400">{workoutCards.length} plan{workoutCards.length === 1 ? '' : 's'}</span>
        </div>
        <div className="space-y-4 p-6">
          {workoutCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              No saved workouts yet. Generate a plan to get started.
            </div>
          ) : (
            workoutCards.map((workout) => (
              <div
                key={workout.id}
                className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{workout.title}</p>
                  <p className="text-xs text-slate-400">Created {formatDate(workout.created_at)}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {workout.goal ? `Goal: ${workout.goal}` : 'Goal: —'}
                    {workout.level ? ` · Level: ${workout.level}` : ''}
                    {workout.sessionsPerWeek ? ` · ${workout.sessionsPerWeek} sessions` : ''}
                    {workout.totalMinutes ? ` · ${workout.totalMinutes} min` : ''}
                    {workout.impactScore ? ` · Impact ${workout.impactScore}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => router.push(`/workout/${workout.id}`)}>Open</Button>
                  <Link href="/generate">
                    <Button variant="secondary">Duplicate</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
