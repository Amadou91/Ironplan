'use client';

import React, { useState } from 'react';
import { Exercise } from '@/types/domain';
import { Badge } from '@/components/ui/Badge'; 
import { Dumbbell, Clock, Signal, Pencil, Trash2, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { deleteExerciseAction } from '@/app/workouts/actions';

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Strength: 'bg-primary/10 text-primary border-primary/20',
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
    <div className="group relative bg-surface border border-border rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="font-black text-xl tracking-tight text-foreground group-hover:text-primary transition-colors">
              {exercise.name}
            </h4>
            <CategoryBadge category={exercise.category || 'Strength'} />
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
                className="h-9 w-9 p-0 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all"
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
        <div className="bg-surface-subtle border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/metric hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground group-hover/metric:text-primary transition-colors">
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

        <div className="bg-surface-subtle border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/metric hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground group-hover/metric:text-amber-500 transition-colors">
                <Signal className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-black">RPE</span>
            </div>
            <span className="text-lg font-black tabular-nums text-foreground">{exercise.rpe || 8}</span>
        </div>
        
        <div className="bg-surface-subtle border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center group/metric hover:border-primary/20 transition-colors">
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
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] text-strong uppercase tracking-[0.15em] font-black">
                  Target: {exercise.primaryMuscle.replace('_', ' ')}
                </span>
             </div>
        ) : <div />}
        
        {exercise.e1rmEligible && (
          <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">
            E1RM Enabled
          </span>
        )}
      </div>
    </div>
  );
}
