'use client';

import React, { useEffect, useState } from 'react';
import { WorkoutEditor } from '@/components/admin/WorkoutEditor';
import { Exercise, ExerciseCategory, MetricProfile, Goal } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';

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
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching exercise:', error);
        toast('Failed to load exercise', 'error');
        setLoading(false);
        return;
      }

      // Map DB fields to Domain fields
      // Defaulting category/metricProfile based on old data if needed
      let category: ExerciseCategory = 'Strength';
      let metricProfile: MetricProfile = 'reps_weight';
      
      // Heuristic mapping for old data
          if (data.focus === 'cardio' || data.goal === 'cardio' || data.metric_profile === 'cardio_session') {
            category = 'Cardio';
          } else if (data.focus === 'mobility' || data.metric_profile === 'mobility_session') {
            category = 'Mobility';
          } else {
        // Strength defaults
        if (data.metric_profile === 'timed_strength') metricProfile = 'duration';
        else if (data.metric_profile === 'bodyweight') metricProfile = 'reps_only'; // assuming bodyweight mapped
        else metricProfile = 'reps_weight';
      }

      const exercise: Partial<Exercise> = {
        id: data.id,
        name: data.name,
        category: category, // Derived
        focus: data.focus,
        metricProfile: metricProfile, // Derived/Mapped
        sets: data.sets,
        reps: data.reps,
        rpe: data.rpe,
        equipment: data.equipment,
        difficulty: data.difficulty,
        eligibleGoals: data.eligible_goals || (data.goal ? [data.goal] : []), // Use new column or fallback
        goal: data.goal,
        durationMinutes: data.duration_minutes,
        restSeconds: data.rest_seconds,
        primaryMuscle: data.primary_muscle,
        // ... map other fields if necessary
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
          focus: data.category === 'Cardio' ? 'cardio' : data.category === 'Mobility' ? 'mobility' : data.focus, // Fallback focus
          // category: data.category, // Uncomment if DB column exists
          // eligible_goals: data.eligibleGoals, // Uncomment if DB column exists
          goal: data.eligibleGoals?.[0] || data.goal, // Fallback goal
          metric_profile: data.metricProfile === 'reps_weight' ? 'reps_weight' 
            : data.metricProfile === 'duration' ? (data.category === 'Mobility' ? 'mobility_session' : 'timed_strength')
            : data.metricProfile,      sets: data.sets,
      reps: data.reps,
      rpe: data.rpe,
      equipment: data.equipment,
      difficulty: data.difficulty,
      duration_minutes: data.durationMinutes,
      rest_seconds: data.restSeconds,
      primary_muscle: data.primaryMuscle,
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
      router.push('/admin');
    }
  };

  if (loading) {
      return <div className="p-8 text-center text-slate-500">Loading exercise details...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Edit Workout</h1>
          <p className="text-slate-500">Update existing exercise details.</p>
        </div>
         <Link href="/admin">
          <Button variant="outline" size="sm">Back to Admin</Button>
        </Link>
      </div>
      
      <WorkoutEditor initialData={initialData} onSubmit={handleSave} />
    </div>
  );
}
