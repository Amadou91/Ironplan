'use client';

import React, { useState, useMemo } from 'react';
import { Exercise, ExerciseCategory, Difficulty, Goal } from '@/types/domain';
import { MuscleGroupTree } from './MuscleGroupTree';
import { ExerciseList } from './ExerciseList';
import { ExerciseFilters } from './ExerciseFilters';

interface ExerciseBrowserProps {
  initialExercises: Exercise[];
}

export function ExerciseBrowser({ initialExercises }: ExerciseBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<{
    category: ExerciseCategory[];
    difficulty: Difficulty[];
    goal: Goal[];
  }>({
    category: [],
    difficulty: [],
    goal: []
  });
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  // Filter Logic
  const filteredExercises = useMemo(() => {
    let result = initialExercises;

    // 1. Text Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ex => 
        ex.name.toLowerCase().includes(q) ||
        ex.equipment.some(eq => eq.kind.toLowerCase().includes(q)) ||
        ex.primaryMuscle?.toLowerCase().includes(q)
      );
    }

    // 2. Chip Filters
    if (activeFilters.category.length > 0) {
      result = result.filter(ex => activeFilters.category.includes(ex.category));
    }
    if (activeFilters.difficulty.length > 0) {
      result = result.filter(ex => ex.difficulty && activeFilters.difficulty.includes(ex.difficulty));
    }
    // (Add goal filtering if eligibleGoals is reliably populated, usually implicit in category/exercise type)

    return result;
  }, [initialExercises, searchQuery, activeFilters]);

  // Display Logic: If a muscle is selected, narrow down the list. 
  // OTHERWISE, show all (filtered) exercises? Or just show a prompt?
  // User requested "Clicking a leaf ... shows the workouts ... in a clean list".
  // If nothing selected, maybe show recent or all? 
  // Let's show all matched by filters if no specific muscle selected, or just all.
  const displayExercises = useMemo(() => {
    if (selectedMuscle) {
      return filteredExercises.filter(ex => ex.primaryMuscle === selectedMuscle);
    }
    return filteredExercises;
  }, [filteredExercises, selectedMuscle]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Sidebar: Filters & Tree */}
      <aside className="lg:col-span-3 lg:sticky lg:top-4 space-y-6">
        <MuscleGroupTree 
          exercises={initialExercises} 
          filteredExercises={filteredExercises}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={setSelectedMuscle}
        />
      </aside>

      {/* Main Content */}
      <main className="lg:col-span-9 space-y-6">
        <ExerciseFilters 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
        />
        
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-bold tracking-tight">
             {selectedMuscle 
               ? `${selectedMuscle.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} Exercises` 
               : 'All Exercises'} 
             <span className="ml-2 text-muted-foreground text-sm font-normal">({displayExercises.length})</span>
           </h2>
        </div>

        <ExerciseList exercises={displayExercises} />
      </main>
    </div>
  );
}
