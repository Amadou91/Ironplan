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
    <div className="sticky top-[148px] z-10 surface-elevated/80 backdrop-blur-md border-b border-[var(--color-border)] -mx-4 px-4 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="flex items-center gap-1.5 py-3 min-w-max">
        {exercises.map((ex, idx) => {
          const isCompleted = ex.sets.length > 0 && ex.sets.every(s => s.completed);
          const isActive = currentIndex === idx;
          
          return (
            <button
              key={`${ex.id}-${idx}`}
              onClick={() => onSelect(idx)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border-2",
                isActive 
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-border)] shadow-sm"
                  : "text-muted hover:text-strong hover:bg-[var(--color-surface-muted)] border-transparent",
                isCompleted && !isActive && "text-accent/70"
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold font-mono",
                  isActive ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-muted)]"
                )}>
                  {idx + 1}
                </span>
                {ex.name}
                {isCompleted && (
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
