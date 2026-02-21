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
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,_0px))] pt-3 sm:px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-surface),transparent_4%)] p-2.5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
        <div className="grid grid-cols-2 items-center gap-2 sm:flex">
          {onFinish && (
            <Button
              variant="primary"
              onClick={onFinish}
              disabled={isFinishing}
              className="min-h-12 flex-1 text-sm font-bold"
            >
              <CheckCircle2 size={18} />
              <span className="truncate">{isFinishing ? 'Finishing…' : 'Finish workout'}</span>
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={onAddExercise}
            className="min-h-12 border-2 border-dashed text-sm font-bold sm:flex-1"
          >
            <Search size={18} />
            <span className="truncate">Add Exercise</span>
          </Button>

          {onReorder && (
            <Button
              variant="outline"
              onClick={onReorder}
              className="col-span-2 min-h-10 gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle sm:col-auto sm:min-h-12 sm:shrink-0 sm:text-sm sm:tracking-normal"
            >
              <ListFilter size={16} />
              <span>Reorder</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
