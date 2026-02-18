'use client';

import React from 'react';
import { ExerciseForm } from '@/components/admin/exercise-form/ExerciseForm';
import { Exercise } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MUSCLE_MAPPING } from '@/lib/muscle-mapping';
import { createExerciseAction } from '@/app/exercises/actions';

const muscleOptions = Object.entries(MUSCLE_MAPPING).map(([slug, data]) => ({
  slug,
  label: data.label
})).sort((a, b) => a.label.localeCompare(b.label));

export default function NewWorkoutPage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async (data: Exercise) => {
    const result = await createExerciseAction(data);

    if (!result.success) {
      toast(`Failed to create exercise: ${result.error}`, 'error');
    } else {
      toast('Exercise created successfully!', 'success');
      router.push('/exercises');
      router.refresh(); // Refresh the list
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-5xl">
      <div className="mb-10 flex flex-col items-center text-center">
        <h1 className="text-3xl font-black tracking-tight uppercase">Create New Exercise</h1>
        <p className="text-muted mt-2 max-w-lg">Define a new exercise or workout template for the library.</p>
        <div className="mt-6">
          <Link href="/exercises">
            <Button variant="outline" size="sm">Back to Exercises</Button>
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
