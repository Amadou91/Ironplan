'use client';

import React, { useState } from 'react';
import { Exercise } from '@/types/domain';
import { Badge } from '@/components/ui/Badge'; 
import { Dumbbell, Clock, Signal, Pencil, Trash2, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { deleteExerciseAction } from '@/app/workouts/actions';
import { cn } from '@/lib/utils';

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Strength: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900',
    Cardio: 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900',
    Mobility: 'bg-teal-500/10 text-teal-600 border-teal-200 dark:border-teal-900',
  };
    return (
      <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-md border ${colors[category] || 'bg-muted text-muted-foreground'}`}>
        {category}
      </span>
    );
}

export function ExerciseList({ exercises }: { exercises: Exercise[] }) {
  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-surface-subtle border-2 border-border border-dashed rounded-2xl">
        <Dumbbell className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-foreground">No exercises found</h3>
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {exercises.map(exercise => (
        <ExerciseCard key={exercise.id || exercise.name} exercise={exercise} />
      ))}
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const category = exercise.category || 'Strength';

  const categoryAccents: Record<string, string> = {
    Strength: 'hover:border-blue-500/50 hover:shadow-blue-500/5',
    Cardio: 'hover:border-rose-500/50 hover:shadow-rose-500/5',
    Mobility: 'hover:border-teal-500/50 hover:shadow-teal-500/5',
  };

  const categoryIconColors: Record<string, string> = {
    Strength: 'text-blue-500',
    Cardio: 'text-rose-500',
    Mobility: 'text-teal-500',
  };

  const handleDelete = async () => {
    if (!exercise.id) return;
    if (!confirm('Are you sure you want to delete this exercise?')) return;

    setIsDeleting(true);
    try {
      const res = await deleteExerciseAction(exercise.id);
      if (!res.success) {
        alert('Failed to delete: ' + res.error);
        setIsDeleting(false);
      }
    } catch (e) {
      alert('Error deleting exercise');
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn(
      "group relative bg-surface border border-border rounded-2xl p-6 transition-all duration-300 flex flex-col gap-6",
      categoryAccents[category] || 'hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30'
    )}>
      
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className={cn(
              "font-black text-xl tracking-tight text-foreground transition-colors",
              category === 'Strength' ? 'group-hover:text-blue-600' : 
              category === 'Cardio' ? 'group-hover:text-rose-600' : 
              category === 'Mobility' ? 'group-hover:text-teal-600' : 'group-hover:text-primary'
            )}>
              {exercise.name}
            </h4>
            <CategoryBadge category={category} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
             {exercise.equipment && exercise.equipment.length > 0 && (
                <span className="flex items-center gap-2">
                   <div className="p-1.5 bg-muted rounded-lg text-foreground/70">
                      <Dumbbell className="w-3.5 h-3.5" />
                   </div>
                   {exercise.equipment.map(e => e.kind === 'machine' ? (e.machineType || 'Machine') : e.kind).join(', ')}
                </span>
             )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 lg:opacity-0 group-hover:opacity-100 transition-all transform lg:translate-x-2 group-hover:translate-x-0">
          <Link href={`/workouts/${exercise.id}/edit`}>
              <Button 
                variant="secondary" 
                size="sm" 
                className={cn(
                  "h-9 w-9 p-0 rounded-xl transition-all",
                  category === 'Strength' ? 'hover:bg-blue-600 hover:text-white' : 
                  category === 'Cardio' ? 'hover:bg-rose-600 hover:text-white' : 
                  category === 'Mobility' ? 'hover:bg-teal-600 hover:text-white' : 'hover:bg-primary hover:text-primary-foreground'
                )}
                title="Edit"
              >
                  <Pencil className="w-4 h-4" />
              </Button>
          </Link>
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-9 w-9 p-0 rounded-xl hover:bg-destructive hover:text-destructive-foreground transition-all"
            onClick={handleDelete}
            disabled={isDeleting}
            title="Delete"
          >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className={cn(
          "bg-surface-subtle border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/metric transition-colors",
          category === 'Strength' ? 'hover:border-blue-500/20' : 
          category === 'Cardio' ? 'hover:border-rose-500/20' : 
          category === 'Mobility' ? 'hover:border-teal-500/20' : 'hover:border-primary/20'
        )}>
            <div className={cn(
              "flex items-center gap-2 mb-2 text-muted-foreground transition-colors",
              category === 'Strength' ? 'group-hover/metric:text-blue-500' : 
              category === 'Cardio' ? 'group-hover/metric:text-rose-500' : 
              category === 'Mobility' ? 'group-hover/metric:text-teal-500' : 'group-hover/metric:text-primary'
            )}>
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-black">
                    {exercise.isInterval ? 'Intervals' : 'Sets'}
                </span>
            </div>
            <span className="text-lg font-black tabular-nums text-foreground">
                {exercise.isInterval 
                    ? `${exercise.sets} × ${exercise.intervalDuration}s` 
                    : `${exercise.sets} × ${exercise.reps}`
                }
            </span>
        </div>

        <div className={cn(
          "bg-surface-subtle border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/metric transition-colors",
          category === 'Strength' ? 'hover:border-blue-500/20' : 
          category === 'Cardio' ? 'hover:border-rose-500/20' : 
          category === 'Mobility' ? 'hover:border-teal-500/20' : 'hover:border-primary/20'
        )}>
            <div className="flex items-center gap-2 mb-2 text-muted-foreground group-hover/metric:text-amber-500 transition-colors">
                <Signal className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-black">RPE</span>
            </div>
            <span className="text-lg font-black tabular-nums text-foreground">{exercise.rpe || 8}</span>
        </div>
        
        <div className={cn(
          "bg-surface-subtle border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/metric transition-colors",
          category === 'Strength' ? 'hover:border-blue-500/20' : 
          category === 'Cardio' ? 'hover:border-rose-500/20' : 
          category === 'Mobility' ? 'hover:border-teal-500/20' : 'hover:border-primary/20'
        )}>
            {exercise.isInterval ? (
              <>
                <div className="flex items-center gap-2 mb-2 text-muted-foreground group-hover/metric:text-blue-500 transition-colors">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black">Rest</span>
                </div>
                <span className="text-lg font-black tabular-nums text-foreground">{exercise.intervalRest}s</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2 text-muted-foreground group-hover/metric:text-blue-500 transition-colors">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black">Rest</span>
                </div>
                <span className="text-lg font-black tabular-nums text-foreground">{exercise.restSeconds}s</span>
              </>
            )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        {exercise.primaryMuscle ? (
             <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  category === 'Strength' ? 'bg-blue-500' : 
                  category === 'Cardio' ? 'bg-rose-500' : 
                  category === 'Mobility' ? 'bg-teal-500' : 'bg-primary'
                )} />
                <span className="text-[10px] text-strong uppercase tracking-[0.15em] font-black">
                  Target: {exercise.primaryMuscle.replace('_', ' ')}
                </span>
             </div>
        ) : <div />}
        
        {exercise.e1rmEligible && (
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
            category === 'Strength' ? 'text-blue-600 bg-blue-50 border-blue-100' : 
            category === 'Cardio' ? 'text-rose-600 bg-rose-50 border-rose-100' : 
            category === 'Mobility' ? 'text-teal-600 bg-teal-50 border-teal-100' : 'text-primary bg-primary/5 border-primary/10'
          )}>
            E1RM Enabled
          </span>
        )}
      </div>
    </div>
  );
}

