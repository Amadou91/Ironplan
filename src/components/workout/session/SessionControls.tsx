'use client';

import React from 'react';
import { CheckCircle2, Plus, ListFilter, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SessionControlsProps {
  onFinish: () => void;
  onAddExercise: () => void;
  onReorder?: () => void;
  isFinishing?: boolean;
}

export function SessionControls({
  onFinish,
  onAddExercise,
  onReorder,
  isFinishing
}: SessionControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          variant="secondary"
          onClick={onFinish}
          disabled={isFinishing}
          className="flex items-center justify-center gap-2 py-4 h-auto text-base font-bold shadow-lg shadow-accent/10"
        >
          <CheckCircle2 size={20} />
          {isFinishing ? 'Finishing...' : 'Finish Workout'}
        </Button>
        
        <Button
          variant="outline"
          onClick={onAddExercise}
          className="flex items-center justify-center gap-2 py-4 h-auto text-base font-bold border-dashed border-2 hover:bg-[var(--color-primary-soft)]"
        >
          <Search size={20} />
          Add Exercise
        </Button>
      </div>

      {onReorder && (
        <Button
          variant="ghost"
          onClick={onReorder}
          className="flex items-center justify-center gap-2 py-2 text-subtle hover:text-strong"
        >
          <ListFilter size={16} />
          <span className="text-sm font-medium">Reorder Exercises</span>
        </Button>
      )}
    </div>
  );
}
