'use client';

import React from 'react';
import { Exercise } from '@/types/domain';
import { Badge } from '@/components/ui/Badge'; // Assuming standard badge or will implement simple one
import { Dumbbell, Clock, Activity, Signal, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Helper for badges
function DifficultyBadge({ level }: { level?: string }) {
  const colors: Record<string, string> = {
    beginner: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900',
    intermediate: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900',
    advanced: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900',
  };
  const colorClass = level ? colors[level] || 'bg-slate-100 text-slate-600' : 'bg-slate-100 text-slate-600';
  
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
      {level || 'Unknown'}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
    const colors: Record<string, string> = {
      Strength: 'bg-blue-500/10 text-blue-600 border-blue-200',
      Cardio: 'bg-purple-500/10 text-purple-600 border-purple-200',
      Yoga: 'bg-teal-500/10 text-teal-600 border-teal-200',
    };
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${colors[category] || 'bg-gray-100 text-gray-600'}`}>
        {category}
      </span>
    );
}

export function ExerciseList({ exercises }: { exercises: Exercise[] }) {
  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-surface border border-border border-dashed rounded-xl">
        <Dumbbell className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-foreground">No exercises found</h3>
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {exercises.map(exercise => (
        <ExerciseCard key={exercise.id || exercise.name} exercise={exercise} />
      ))}
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <div className="group relative bg-surface border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/50 transition-all duration-200 flex flex-col gap-5">
      
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h4 className="font-bold text-xl text-foreground group-hover:text-primary transition-colors">
              {exercise.name}
            </h4>
            <CategoryBadge category={exercise.category} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
             {exercise.equipment && exercise.equipment.length > 0 && (
                <span className="flex items-center gap-1.5">
                   <Dumbbell className="w-4 h-4" />
                   {exercise.equipment.map(e => e.kind === 'machine' ? (e.machineType || 'Machine') : e.kind).join(', ')}
                </span>
             )}
          </div>
        </div>
        
        <Link href={`/admin/workouts/${exercise.id}/edit`}>
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-5 h-5" />
            </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mt-auto">
        <div className="bg-muted/40 rounded-lg p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                {exercise.isInterval ? 'Structure' : 'Volume'}
            </span>
            <span className="text-base font-bold tabular-nums">
                {exercise.isInterval 
                    ? `${exercise.sets} × ${exercise.intervalDuration}s/${exercise.intervalRest}s` 
                    : `${exercise.sets} × ${exercise.reps}`
                }
            </span>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Intensity</span>
            <div className="flex items-center gap-1.5">
                <Signal className="w-4 h-4 text-amber-500" />
                <span className="text-base font-bold tabular-nums">{exercise.rpe}</span>
            </div>
        </div>
        
        {/* Hide Rest block for Intervals if it duplicates the Off time (which it should) */}
        {!exercise.isInterval && (
            <div className="bg-muted/40 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Rest</span>
                <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-base font-bold tabular-nums">{exercise.restSeconds}s</span>
                </div>
            </div>
        )}
        
        {/* If Interval, maybe show total time estimate or leave empty to keep grid balance? 
            Let's show a placeholder or total duration if calculated. 
            For now, let's just leave the space or center the other two if needed.
            But grid-cols-3 expects 3 items. 
            We can show "Type: Interval" or similar? Or just keep Rest if it signifies "Rest Between Rounds"?
            Requirement: "do not show a separate 'Rest: X' unless it is 'rest between rounds'".
            Since we didn't implement complex rounds yet, we assume no extra rest. 
            I'll replace the 3rd column with something useful or just blank.
        */}
        {exercise.isInterval && (
             <div className="bg-muted/40 rounded-lg p-3 flex flex-col items-center justify-center text-center opacity-50">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Type</span>
                <span className="text-base font-bold tabular-nums">Intervals</span>
            </div>
        )}
      </div>

      {/* Footer Tags */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <DifficultyBadge level={exercise.difficulty} />
        {exercise.primaryMuscle && (
             <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Target: {exercise.primaryMuscle.replace('_', ' ')}
             </span>
        )}
      </div>
    </div>
  );
}
