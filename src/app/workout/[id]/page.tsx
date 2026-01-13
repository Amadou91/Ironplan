'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, Activity, Clock, Flame, Trophy, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { PlanInput, WorkoutImpact } from '@/types/domain'

// Define types based on your DB schema
type Exercise = {
  name: string
  sets: number
  reps: string | number
  rpe: number
  load?: { label: string }
}

type Workout = {
  id: string
  title: string
  description: string
  goal: string
  level: string
  exercises:
    | { schedule?: { exercises?: Exercise[] }[]; summary?: { totalMinutes?: number; impact?: WorkoutImpact }; inputs?: PlanInput }
    | Exercise[]
    | null
  created_at: string
}

export default function WorkoutDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWorkout = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) {
        console.error('Error fetching workout:', error)
      } else {
        setWorkout(data)
      }
      setLoading(false)
    }

    if (params.id) fetchWorkout()
  }, [params.id, supabase])

  if (loading) return <div className="p-10 text-center text-slate-400">Loading workout...</div>
  if (!workout) return <div className="p-10 text-center text-slate-400">Workout not found.</div>

  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises
    : workout.exercises?.schedule?.flatMap((day) => day.exercises ?? []) ?? []
  const summary = !Array.isArray(workout.exercises) ? workout.exercises?.summary : undefined
  const impact = summary?.impact
  const inputs = !Array.isArray(workout.exercises) ? workout.exercises?.inputs : undefined

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center text-sm mb-6">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{workout.title}</h1>
              <p className="text-slate-400">{workout.description}</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              {workout.goal}
            </span>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Activity className="w-5 h-5 mr-2 text-emerald-500" />
              Regimen
            </h3>
            <div className="space-y-3">
              {exercises.map((ex, idx) => (
                <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{ex.name}</h4>
                        <p className="text-xs text-slate-400">{ex.load?.label ?? 'Target: General'}</p>
                      </div>
                   </div>
                   <div className="flex gap-4 text-sm text-slate-300 font-mono">
                      <span>{ex.sets} sets</span>
                      <span className="text-slate-600">|</span>
                      <span>{ex.reps} reps</span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
           <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Program Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                   <div className="flex items-center text-slate-300">
                     <Clock className="w-4 h-4 mr-2 text-slate-500" /> Duration
                   </div>
                   <span className="text-white font-medium">{summary?.totalMinutes ?? '~60'} min</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                   <div className="flex items-center text-slate-300">
                     <Flame className="w-4 h-4 mr-2 text-slate-500" /> Intensity
                   </div>
                   <span className="text-white font-medium capitalize">{inputs?.intensity ?? 'Moderate'}</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center text-slate-300">
                     <Trophy className="w-4 h-4 mr-2 text-slate-500" /> Level
                   </div>
                   <span className="text-white font-medium capitalize">{workout.level}</span>
                </div>
              </div>
              <Button className="w-full mt-6">
                Start Session
              </Button>
           </Card>

           <Card className="bg-slate-800 border-slate-700 p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Workout Impact</h3>
              {impact ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-slate-300">
                      <Gauge className="w-4 h-4 mr-2 text-slate-500" /> Score
                    </div>
                    <span className="text-white font-semibold">{impact.score}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Volume +{impact.breakdown.volume}, Intensity +{impact.breakdown.intensity}, Density +{impact.breakdown.density}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Impact score will appear after generation.</p>
              )}
           </Card>
        </div>
      </div>
    </div>
  )
}
