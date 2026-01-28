'use client';

import React, { useState } from 'react';
import { Exercise, EquipmentKind } from '@/types/domain';
import { Badge } from '@/components/ui/Badge'; 
import { 
  Dumbbell, 
  Clock, 
  Signal, 
  Pencil, 
  Trash2, 
  Loader2, 
  Layers, 
  User, 
  Zap, 
  Settings, 
  Box, 
  Circle, 
  Link as LinkIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { deleteExerciseAction } from '@/app/workouts/actions';
import { cn } from '@/lib/utils';

const EQUIPMENT_ICONS: Record<EquipmentKind, React.ElementType> = {
  bodyweight: User,
  dumbbell: Dumbbell,
  kettlebell: Dumbbell, // Often same icon category
  barbell: Dumbbell,
  machine: Settings,
  band: Zap,
  block: Box,
  bolster: Circle,
  strap: LinkIcon
};

function EquipmentBadge({ kind, machineType }: { kind: EquipmentKind, machineType?: string }) {
  const Icon = EQUIPMENT_ICONS[kind] || Dumbbell;
  const label = kind === 'machine' ? (machineType || 'Machine') : kind;
  
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/40 rounded-lg group/eq transition-all hover:bg-muted/60">
      <div className="p-1 bg-surface/50 rounded-md shadow-sm text-foreground/70 group-hover/eq:text-primary transition-colors">
        <Icon className="w-3 h-3" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/eq:text-foreground transition-colors">
        {label.replace(/_/g, ' ')}
      </span>
    </div>
  );
}

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
      "group relative bg-surface border border-border rounded-2xl p-6 transition-all duration-300 flex flex-col gap-5 min-h-[320px]",
      categoryAccents[category] || 'hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30'
    )}>
      
      {/* 1. Header: Title */}
      <div className="space-y-1">
        <h4 className={cn(
          "font-black text-xl tracking-tight text-foreground transition-colors",
          category === 'Strength' ? 'group-hover:text-blue-600' : 
          category === 'Cardio' ? 'group-hover:text-rose-600' : 
          category === 'Mobility' ? 'group-hover:text-teal-600' : 'group-hover:text-primary'
        )}>
          {exercise.name}
        </h4>
      </div>

      {/* 2. Secondary Info: Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={category} />
        {exercise.movementPattern && (
          <span className="text-[10px] uppercase tracking-widest font-black px-2.5 py-1 rounded-lg border-2 border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-text-strong)] shadow-sm">
            {exercise.movementPattern}
          </span>
        )}
      </div>

      {/* 3. Main Content: Equipment */}
      <div className="flex-1 flex flex-col gap-2">
         {exercise.equipment?.map((e, idx) => (
            <div key={idx} className="flex justify-start">
              <EquipmentBadge kind={e.kind} machineType={e.kind === 'machine' ? e.machineType : undefined} />
            </div>
         ))}
      </div>

      {/* 4. Footer: Metadata & Actions */}
      <div className="pt-5 border-t border-border/50 mt-auto">
        <div className="flex items-end justify-between gap-4 min-h-[48px]">
          
          {/* Metadata (Left) */}
          <div className="flex flex-col gap-1.5 min-w-0">
            {exercise.primaryMuscle && (
               <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    category === 'Strength' ? 'bg-blue-500' : 
                    category === 'Cardio' ? 'bg-rose-500' : 
                    category === 'Mobility' ? 'bg-teal-500' : 'bg-primary'
                  )} />
                  <span className="text-[10px] text-strong uppercase tracking-[0.15em] font-black truncate">
                    Primary: {exercise.primaryMuscle.replace('_', ' ')}
                  </span>
               </div>
            )}
            
            {exercise.primaryMuscle !== 'full_body' && exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
              <span className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-bold truncate opacity-70 pl-3.5">
                Secondary: {exercise.secondaryMuscles.map(m => m.replace('_', ' ')).join(', ')}
              </span>
            )}
          </div>

          {/* Actions & High-Level Badges (Right) */}
          <div className="flex items-center gap-2 shrink-0">
            {exercise.e1rmEligible && (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shrink-0",
                category === 'Strength' ? 'text-blue-600 bg-blue-50 border-blue-100' : 
                category === 'Cardio' ? 'text-rose-600 bg-rose-50 border-rose-100' : 
                category === 'Mobility' ? 'text-teal-600 bg-teal-50 border-teal-100' : 'text-primary bg-primary/5 border-primary/10'
              )}>
                E1RM
              </span>
            )}
            
            <div className="flex items-center gap-1.5 ml-2">
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
        </div>
      </div>
    </div>
  );
}

