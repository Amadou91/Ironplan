import React from 'react';
import { fetchExerciseCatalog } from '@/lib/generator/catalog-loader';
import { ExerciseBrowser } from '@/components/admin/exercise-browser/ExerciseBrowser';
import { DataManagementToolbar } from '@/components/admin/DataManagementToolbar';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default async function AdminDashboard() {
  const exercises = await fetchExerciseCatalog();

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Exercises</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
             <DataManagementToolbar />
             <Link href="/exercises/new" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto shadow-sm bg-primary text-primary-foreground hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  New Exercise
                </Button>
             </Link>
        </div>
      </div>

      <ExerciseBrowser initialExercises={exercises} />
    </div>
  );
}
