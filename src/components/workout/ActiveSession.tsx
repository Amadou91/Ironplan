'use client';

import React, { useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { SetLogger } from './SetLogger';
import { Plus, Save, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SessionExercise, WorkoutSet } from '@/types/domain';

export default function ActiveSession() {
  const { activeSession, addSet, removeSet, updateSet, endSession } = useWorkoutStore();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  if (!activeSession) return null;

  const handleFinishWorkout = async () => {
    if (!confirm('Are you sure you want to finish this workout?')) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create Session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .insert({
            user_id: user.id,
            plan_id: activeSession.planId,
            name: activeSession.name,
            started_at: activeSession.startedAt,
            ended_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error('Failed to create session record');

      // 2. Process Exercises & Sets
      for (const ex of activeSession.exercises) {
        const { data: exData, error: exError } = await supabase
            .from('session_exercises')
            .insert({
                session_id: sessionData.id,
                exercise_name: ex.name,
                primary_muscle: ex.primaryMuscle,
                secondary_muscles: ex.secondaryMuscles,
                order_index: ex.orderIndex
            })
            .select()
            .single();
        
        if (exError) throw exError;
        if (!exData) throw new Error('Failed to create exercise record');

        // Insert Sets
        const validSets = ex.sets.filter((s: WorkoutSet) => s.completed || (s.reps && s.weight));
        
        if (validSets.length > 0) {
            const setsPayload = validSets.map((s: WorkoutSet) => ({
                session_exercise_id: exData.id,
                set_number: s.setNumber,
                reps: Number(s.reps),
                weight: Number(s.weight),
                rpe: s.rpe ? Number(s.rpe) : null,
                completed: true
            }));

            const { error: setError } = await supabase.from('sets').insert(setsPayload);
            if (setError) throw setError;
        }
      }

      endSession();
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to save workout:', error);
      alert('Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="bg-white sticky top-0 z-10 p-4 border-b border-gray-100 shadow-sm flex justify-between items-center rounded-xl mb-6">
        <div>
            <h2 className="text-xl font-bold text-gray-900">{activeSession.name}</h2>
            <div className="flex items-center text-sm text-gray-500 gap-1">
                <Clock size={14} />
                <span>Started at {new Date(activeSession.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        </div>
        <button 
            onClick={handleFinishWorkout}
            disabled={isSaving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
            {isSaving ? 'Saving...' : <><Save size={18} /> Finish</>}
        </button>
      </div>

      <div className="space-y-6">
        {activeSession.exercises.map((exercise: SessionExercise, exIdx: number) => (
          <div key={`${exercise.name}-${exIdx}`} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">{exercise.name}</h3>
                    <div className="flex gap-2 mt-1">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                            {exercise.primaryMuscle}
                        </span>
                        {exercise.secondaryMuscles?.map((m: string) => (
                             <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                             {m}
                         </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-1">
                {exercise.sets.map((set: WorkoutSet, setIdx: number) => (
                    <SetLogger 
                        key={set.id}
                        set={set}
                        onUpdate={(field, val) => updateSet(exIdx, setIdx, field, val)}
                        onDelete={() => removeSet(exIdx, setIdx)}
                        onToggleComplete={() => updateSet(exIdx, setIdx, 'completed', !set.completed)}
                    />
                ))}
            </div>

            <button 
                onClick={() => addSet(exIdx)}
                className="w-full mt-3 py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 font-medium hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex justify-center items-center gap-2"
            >
                <Plus size={18} /> Add Set
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}