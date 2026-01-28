'use client';

import React from 'react';
import { ExerciseForm } from '@/components/admin/exercise-form/ExerciseForm';
import { Exercise } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MUSCLE_MAPPING } from '@/lib/muscle-mapping';

const muscleOptions = Object.entries(MUSCLE_MAPPING).map(([slug, data]) => ({
  slug,
  label: data.label
})).sort((a, b) => a.label.localeCompare(b.label));

export default function NewWorkoutPage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async (data: Exercise) => {
    console.log('Saving new workout (exercise):', data);
    // TODO: Implement actual save logic (e.g., to Supabase 'exercise_catalog' or 'workouts' table)
    // const { error } = await supabase.from('exercise_catalog').insert({...})
    
    // Simulating success for now
    toast('Workout created successfully!', 'success');
    router.push('/workouts');
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Standard Workout</h1>
          <p className="text-slate-500">Define a new exercise or workout template for the library.</p>
        </div>
        <Link href="/workouts">
          <Button variant="outline" size="sm">Back to Workouts</Button>
        </Link>
      </div>
      
      <ExerciseForm 
        onSubmit={handleSave} 
        onCancel={() => router.back()}
        muscleOptions={muscleOptions}
      />
    </div>
  );
}
