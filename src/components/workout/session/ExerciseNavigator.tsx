'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { SessionExercise } from '@/types/domain';

interface ExerciseNavigatorProps {
  exercises: SessionExercise[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function ExerciseNavigator({
  exercises,
  currentIndex,
  onSelect
}: ExerciseNavigatorProps) {
  if (!exercises.length) return null;

  return (
    <div className="sticky top-[calc(196px+env(safe-area-inset-top,_0px))] z-10 -mx-4 overflow-x-auto border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_6%)] px-4 backdrop-blur-xl no-scrollbar scroll-smooth">
      <div className="flex min-w-max items-center gap-1.5 py-2.5">
        {exercises.map((ex, idx) => {
          const isCompleted = ex.sets.length > 0 && ex.sets.every(s => s.completed);
          const isActive = currentIndex === idx;
          
          return (
            <button
              key={`${ex.id}-${idx}`}
              onClick={() => onSelect(idx)}
              className={cn(
                'rounded-xl border-2 px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-all min-h-10',
                isActive 
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-border)] shadow-sm'
                  : 'text-muted hover:text-strong hover:bg-[var(--color-surface-muted)] border-transparent',
                isCompleted && !isActive && 'text-accent/70'
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-md font-mono text-[11px] font-bold',
                  isActive ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-muted)]'
                )}>
                  {idx + 1}
                </span>
                {ex.name}
                {isCompleted && (
                  <div className="h-2 w-2 rounded-full bg-accent" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
