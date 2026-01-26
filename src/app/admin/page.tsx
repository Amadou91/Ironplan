import React from 'react';
import { fetchExerciseCatalog } from '@/lib/generator/catalog-loader';
import { ExerciseTable } from '@/components/admin/ExerciseTable';

export default async function AdminDashboard() {
  const exercises = await fetchExerciseCatalog();

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      </div>

      <ExerciseTable exercises={exercises} />
    </div>
  );
}
