'use client';

import React from 'react';
import { ExerciseForm } from '@/components/admin/exercise-form/ExerciseForm';
import { Exercise } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { MUSCLE_MAPPING } from '@/lib/muscle-mapping';

const muscleOptions = Object.entries(MUSCLE_MAPPING).map(([slug, data]) => ({
  slug,
  label: data.label
})).sort((a, b) => a.label.localeCompare(b.label));

export default function NewWorkoutPage() {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async (data: Exercise) => {
    // Map Domain fields to DB fields
    const payload = {
      name: data.name,
      category: data.category || 'Strength',
      focus: data.focus,
      eligible_goals: data.eligibleGoals || [],
      goal: data.goal,
      metric_profile: data.metricProfile || 'reps_weight',
      sets: data.sets,
      reps: data.reps,
      rpe: data.rpe,
      equipment: data.equipment,
      difficulty: data.difficulty,
      duration_minutes: data.durationMinutes,
      rest_seconds: data.restSeconds,
      primary_muscle: data.primaryMuscle,
      secondary_muscles: data.secondaryMuscles || [],
      instructions: data.instructions || [],
      video_url: data.videoUrl,
      e1rm_eligible: data.e1rmEligible || false,
      is_interval: data.isInterval || false,
      interval_duration: data.intervalDuration,
      interval_rest: data.intervalRest
    };

    const { error } = await supabase
      .from('exercise_catalog')
      .insert(payload);
    
    if (error) {
      console.error('Error creating exercise:', error);
      toast(`Failed to create exercise: ${error.message}`, 'error');
    } else {
      toast('Exercise created successfully!', 'success');
      router.push('/workouts');
      router.refresh(); // Refresh the list
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-5xl">
      <div className="mb-10 flex flex-col items-center text-center">
        <h1 className="text-3xl font-black tracking-tight uppercase">Create New Exercise</h1>
        <p className="text-slate-500 mt-2 max-w-lg">Define a new exercise or workout template for the library.</p>
        <div className="mt-6">
          <Link href="/workouts">
            <Button variant="outline" size="sm">Back to Workouts</Button>
          </Link>
        </div>
      </div>
      
      <div className="flex justify-center">
        <div className="w-full">
          <ExerciseForm 
            onSubmit={handleSave} 
            onCancel={() => router.back()}
            muscleOptions={muscleOptions}
          />
        </div>
      </div>
    </div>
  );
}
