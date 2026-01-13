'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Wand2, ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function GeneratePage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    goal: 'strength',
    split: 'push_pull_legs',
    level: 'intermediate',
    daysPerWeek: '4',
    equipment: 'gym'
  })

  const generatePlan = async () => {
    if (!user) return
    setLoading(true)

    // SIMULATED GENERATION - Replace with your actual AI API call here
    // For now, we construct a dummy object to demonstrate the flow
    const newPlan = {
      user_id: user.id,
      title: `${formData.split.replace(/_/g, ' ').toUpperCase()} Protocol`,
      description: `A ${formData.daysPerWeek}-day ${formData.goal} program for ${formData.level} lifters.`,
      goal: formData.goal,
      level: formData.level,
      tags: [formData.goal, formData.split],
      // In a real app, this would be a JSON object or related table entries
      exercises: [
        { name: "Barbell Squat", sets: 4, reps: "6-8", rpe: 8 },
        { name: "Bench Press", sets: 4, reps: "6-8", rpe: 8 },
        { name: "Bent Over Row", sets: 3, reps: "8-10", rpe: 7 },
      ]
    }

    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert([newPlan])
        .select()
        .single()

      if (error) throw error
      
      if (data) {
        router.push(`/workout/${data.id}`)
      }
    } catch (err) {
      console.error("Failed to save plan", err)
      alert("Failed to generate plan. Check console.")
    } finally {
      setLoading(false)
    }
  }

  if (userLoading) return <div className="p-8 text-center text-slate-400">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white flex items-center text-sm mb-4">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Wand2 className="w-8 h-8 mr-3 text-emerald-500" />
          Generate New Protocol
        </h1>
        <p className="text-slate-400 mt-2">AI-driven programming tailored to your physiology and goals.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="space-y-6">
          {/* Goal Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Primary Goal</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Strength', 'Hypertrophy', 'Endurance'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFormData({...formData, goal: opt.toLowerCase()})}
                  className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${
                    formData.goal === opt.toLowerCase()
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Split Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Training Split</label>
            <select 
              value={formData.split}
              onChange={(e) => setFormData({...formData, split: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="push_pull_legs">Push / Pull / Legs</option>
              <option value="full_body">Full Body</option>
              <option value="upper_lower">Upper / Lower</option>
              <option value="bro_split">Body Part Split</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <Button 
              onClick={generatePlan} 
              disabled={loading}
              className="w-full py-6 text-lg"
            >
              {loading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-5 w-5" /> Generatin...
                </span>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate Program
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}