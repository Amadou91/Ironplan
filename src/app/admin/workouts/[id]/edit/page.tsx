'use client';

import React, { useEffect, useState } from 'react';
import { WorkoutEditor } from '@/components/admin/WorkoutEditor';
import { Exercise } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditWorkoutPage() {
  const params = useParams();
  const id = params?.id as string;
  const [initialData, setInitialData] = useState<Partial<Exercise> | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetch data
    if (id) {
        // TODO: Fetch from Supabase
        console.log('Fetching workout/exercise with ID:', id);
        
        // Simulating fetch delay
        setTimeout(() => {
            setInitialData({
                id: id,
                name: 'Mock Loaded Exercise',
                focus: 'chest',
                metricProfile: 'strength',
                difficulty: 'intermediate',
                sets: 4,
                reps: '8-10',
                rpe: 9,
                // ... populate other fields as needed
            });
            setLoading(false);
        }, 500);
    }
  }, [id]);

  const handleSave = async (data: Exercise) => {
    console.log('Updating workout (exercise):', data);
    // TODO: Implement update logic
    alert('Workout/Exercise updated! (Check console for data)');
  };

  if (loading) {
      return <div className="p-8 text-center">Loading exercise data...</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Workout</h1>
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
