'use client';

import React, { useEffect, useState } from 'react';
import { ExerciseForm } from '@/components/admin/exercise-form/ExerciseForm';
import { Exercise, ExerciseCategory, MetricProfile } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { MUSCLE_MAPPING } from '@/lib/muscle-mapping';

const muscleOptions = Object.entries(MUSCLE_MAPPING).map(([slug, data]) => ({
  slug,
  label: data.label
})).sort((a, b) => a.label.localeCompare(b.label));

export default function EditWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;
  const [initialData, setInitialData] = useState<Partial<Exercise> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchExercise = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('exercise_catalog')
        .select(`
          id, name, category, focus, movement_pattern, metric_profile,
          primary_muscle, secondary_muscles, equipment,
          e1rm_eligible, is_interval, or_group
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching exercise:', error);
        toast('Failed to load exercise', 'error');
        setLoading(false);
        return;
      }

      // Map DB fields to Domain fields
      let category: ExerciseCategory = (data.category as ExerciseCategory) || 'Strength';
      const metricProfile: MetricProfile = (data.metric_profile as MetricProfile) || 'reps_weight';
      
      // Heuristic mapping for old/legacy data
      if (!data.category) {
        if (data.focus === 'cardio' || data.metric_profile === 'cardio_session') {
          category = 'Cardio';
        } else if (data.focus === 'mobility' || data.metric_profile === 'mobility_session') {
          category = 'Mobility';
        }
      }

      const exercise: Partial<Exercise> = {
        id: data.id,
        name: data.name,
        category: category,
        focus: data.focus,
        movementPattern: data.movement_pattern,
        metricProfile: metricProfile,
        equipment: data.equipment,
        primaryMuscle: data.primary_muscle,
        secondaryMuscles: data.secondary_muscles,
        isInterval: data.is_interval,
      };

      setInitialData(exercise);
      setLoading(false);
    };

    fetchExercise();
  }, [id, supabase, toast]);

  const handleSave = async (data: Exercise) => {
    // Map Domain fields back to DB fields
    // Assuming DB schema might not be fully migrated, we map back to what we can.
    // If DB has new columns (category, eligible_goals), use them.
    
    // We'll update both old and new fields to ensure compatibility
    const updates = {
      name: data.name,
      category: data.category,
      metric_profile: data.metricProfile,
      equipment: data.equipment,
      primary_muscle: data.primaryMuscle,
      secondary_muscles: data.secondaryMuscles,
      is_interval: data.isInterval,
    };

    const { error } = await supabase
      .from('exercise_catalog')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating exercise:', error);
      toast(`Failed to update exercise: ${error.message}`, 'error');
    } else {
      toast('Exercise updated successfully!', 'success');
      router.push('/exercises');
    }
  };

  if (loading) {
      return <div className="p-8 text-center text-muted">Loading exercise details...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-10 flex flex-col items-center text-center">
        <h1 className="text-3xl font-black tracking-tight text-strong uppercase">Edit Exercise</h1>
        <p className="text-muted mt-2 max-w-lg">Update existing exercise details and library parameters.</p>
        <div className="mt-6">
          <Link href="/exercises">
            <Button variant="outline" size="sm">Back to Exercises</Button>
          </Link>
        </div>
      </div>
      
      <ExerciseForm 
        initialData={initialData} 
        onSubmit={handleSave} 
        onCancel={() => router.back()}
        muscleOptions={muscleOptions}
      />
    </div>
  );
}
