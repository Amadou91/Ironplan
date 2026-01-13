'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase/client'
import { Dumbbell, Plus, ChevronRight, Activity, Calendar, Trophy, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useUser } from '../hooks/useUser'

type Workout = {
  id: string
  title: string
  description: string
  tags: string[]
  created_at: string
}

export default function HomePage() {
  const { user, loading: authLoading } = useUser()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loadingWorkouts, setLoadingWorkouts] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      const fetchWorkouts = async () => {
        const { data, error } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading workouts:', error)
        } else {
          setWorkouts(data || [])
        }
        setLoadingWorkouts(false)
      }
      fetchWorkouts()
    }
  }, [user, supabase])

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500"></div>
      </div>
    )
  }

  // 2. Public Landing Page (Not Logged In)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Navbar */}
        <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
             <div className="flex items-center">
               <Dumbbell className="h-6 w-6 text-emerald-500 mr-2" />
               <span className="font-bold text-lg text-white">Ironplan</span>
             </div>
             <Link href="/login">
               <Button variant="outline">Sign In</Button>
             </Link>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
          <h1 className="text-4xl sm:text-6xl font-bold text-white tracking-tight mb-6">
            Forge Your Perfect <span className="text-emerald-500">Physique</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mb-10">
            AI-powered workout programming tailored to your goals, equipment, and recovery capacity. Stop guessing and start progressing.
          </p>
          <Link href="/login">
            <Button className="px-8 py-6 text-lg">
              Start Training <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // 3. Authenticated Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Dumbbell className="h-6 w-6 text-emerald-500 mr-2" />
            <span className="font-bold text-lg text-white">Ironplan</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline">{user.email}</span>
            <Button 
                variant="ghost" 
                onClick={() => supabase.auth.signOut()}
                className="text-slate-400 hover:text-white"
            >
                Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400">Welcome back, Athlete.</p>
          </div>
          <Link href="/generate">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> New Plan
            </Button>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
           <Card className="bg-slate-800 border-slate-700 p-6 flex items-center">
             <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mr-4">
               <Activity className="h-6 w-6 text-emerald-500" />
             </div>
             <div>
               <p className="text-sm text-slate-400">Active Plans</p>
               <p className="text-2xl font-bold text-white">{workouts.length}</p>
             </div>
           </Card>
           {/* Static stats for now */}
           <Card className="bg-slate-800 border-slate-700 p-6 flex items-center">
             <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mr-4">
               <Calendar className="h-6 w-6 text-blue-500" />
             </div>
             <div>
               <p className="text-sm text-slate-400">Workouts / Week</p>
               <p className="text-2xl font-bold text-white">4</p>
             </div>
           </Card>
           <Card className="bg-slate-800 border-slate-700 p-6 flex items-center">
             <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mr-4">
               <Trophy className="h-6 w-6 text-amber-500" />
             </div>
             <div>
               <p className="text-sm text-slate-400">Streak</p>
               <p className="text-2xl font-bold text-white">12 Days</p>
             </div>
           </Card>
        </div>

        {/* Workouts List */}
        <h2 className="text-lg font-semibold text-white mb-4">Your Protocols</h2>
        
        {loadingWorkouts ? (
           <div className="text-center py-10 text-slate-500">Loading workouts...</div>
        ) : workouts.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
            <Dumbbell className="h-12 w-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No plans yet</h3>
            <p className="text-slate-500 mb-6">Generate your first Ironplan to get started.</p>
            <Link href="/generate">
              <Button variant="secondary">Create Plan</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.map(workout => (
              <Link href={`/workout/${workout.id}`} key={workout.id}>
                <div className="group bg-slate-800 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-900/10 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                     <div className="h-10 w-10 bg-slate-700 rounded-lg flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                       <Dumbbell className="h-5 w-5" />
                     </div>
                     <span className="text-xs text-slate-500">
                       {new Date(workout.created_at).toLocaleDateString()}
                     </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">{workout.title}</h3>
                  <p className="text-sm text-slate-400 mb-4 line-clamp-2 flex-grow">{workout.description}</p>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                     {workout.tags?.map(tag => (
                       <span key={tag} className="text-xs bg-slate-900 text-slate-400 px-2 py-1 rounded border border-slate-700 capitalize">
                         {tag}
                       </span>
                     ))}
                  </div>
                  <div className="flex items-center text-emerald-500 text-sm font-medium mt-auto">
                     View Details <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}