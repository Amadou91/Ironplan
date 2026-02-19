'use client';

import React from 'react';
import { CheckCircle2, ListFilter, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SessionControlsProps {
  onFinish?: () => void;
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
    <div className="fixed bottom-0 inset-x-0 z-30 surface-elevated/90 backdrop-blur-md border-t border-[var(--color-border)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,_0px))] pt-3">
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        {onFinish && (
          <Button
            variant="secondary"
            onClick={onFinish}
            disabled={isFinishing}
            className="flex items-center justify-center gap-2 py-3 h-auto text-sm font-bold flex-1 min-w-0"
          >
            <CheckCircle2 size={18} />
            <span className="truncate">{isFinishing ? 'Finishing…' : 'Finish'}</span>
          </Button>
        )}

        <Button
          variant="outline"
          onClick={onAddExercise}
          className="flex items-center justify-center gap-2 py-3 h-auto text-sm font-bold border-dashed border-2 hover:bg-[var(--color-primary-soft)] flex-1 min-w-0"
        >
          <Search size={18} />
          <span className="truncate">Add Exercise</span>
        </Button>

        {onReorder && (
          <Button
            variant="ghost"
            onClick={onReorder}
            className="flex items-center justify-center gap-1.5 py-3 h-auto text-subtle hover:text-strong shrink-0"
          >
            <ListFilter size={16} />
            <span className="text-sm font-medium hidden sm:inline">Reorder</span>
          </Button>
        )}
      </div>
    </div>
  );
}
