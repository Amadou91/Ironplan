'use client';

import React, { useCallback, memo } from 'react';
import { Trash2, RefreshCcw, Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { SetLogger } from '@/components/workout/SetLogger';
import { isTimeBasedExercise } from '@/lib/muscle-utils';
import type { SessionExercise, Exercise, WorkoutSet, WeightUnit } from '@/types/domain';
import type { WeightOption } from '@/lib/equipment';

interface ExerciseSessionCardProps {
  exercise: SessionExercise;
  exIdx: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSwap: () => void;
  onRemove: () => void;
  onSetUpdate: (setIdx: number, field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  onRemoveSet: (setIdx: number) => void;
  onAddSet: () => void;
  onCopyLastSet: () => void;
  weightOptions: WeightOption[];
  exerciseTargetSummary: string | null;
  movementPattern?: string | null;
  exerciseTargets: Record<string, { reps?: string | number }>;
  preferredUnit: WeightUnit;
  hasSets: boolean;
}

export const ExerciseSessionCard = memo(function ExerciseSessionCard({
  exercise,
  isCollapsed,
  onToggleCollapse,
  onSwap,
  onRemove,
  onSetUpdate,
  onRemoveSet,
  onAddSet,
  onCopyLastSet,
  weightOptions,
  exerciseTargetSummary,
  movementPattern,
  exerciseTargets,
  hasSets,
}: ExerciseSessionCardProps) {
  const completedCount = exercise.sets.filter(s => s.completed).length;
  const allCompleted = exercise.sets.length > 0 && completedCount === exercise.sets.length;

  const handleToggleComplete = useCallback(
    (setIdx: number, set: WorkoutSet) => onSetUpdate(setIdx, 'completed', !set.completed),
    [onSetUpdate]
  );

  return (
    <div className="surface-card-muted p-4 md:p-6 scroll-mt-[220px]">
      {/* Always-visible exercise header */}
      <div className="flex justify-between items-start">
        <button type="button" onClick={onToggleCollapse} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-strong truncate">{exercise.name}</h3>
            {movementPattern && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface text-subtle border border-border shrink-0">
                {movementPattern}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="badge-accent">{exercise.primaryMuscle}</span>
            {allCompleted && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--color-success)] uppercase tracking-wider">
                <Check size={12} /> Done
              </span>
            )}
            {exercise.sets.length > 0 && !allCompleted && (
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {completedCount}/{exercise.sets.length} sets
              </span>
            )}
            {exerciseTargetSummary && (
              <span className="text-[10px] text-muted">Target: {exerciseTargetSummary}</span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button onClick={onSwap} className="p-2 -m-1 text-accent hover:text-accent/80 hover:bg-[var(--color-accent-soft)] rounded-lg transition-colors" title="Swap exercise"><RefreshCcw size={16} /></button>
          <button onClick={onRemove} className="p-2 -m-1 text-subtle hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-lg transition-colors" title="Remove exercise"><Trash2 size={16} /></button>
          <button onClick={onToggleCollapse} className="p-2 -m-1 text-muted hover:text-strong rounded-lg transition-colors" title={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {!isCollapsed && (
        <div className="mt-4">
          <div className="space-y-2">
            {exercise.sets.map((set, setIdx) => (
              <SetLogger
                key={set.id}
                set={set}
                weightOptions={weightOptions}
                onUpdate={(f, v) => onSetUpdate(setIdx, f, v)}
                onDelete={() => onRemoveSet(setIdx)}
                onToggleComplete={() => handleToggleComplete(setIdx, set)}
                metricProfile={exercise.metricProfile}
                isTimeBased={isTimeBasedExercise(exercise.name, exerciseTargets[exercise.name.toLowerCase()]?.reps)}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            {hasSets && (
              <button
                onClick={onCopyLastSet}
                className="flex-1 py-2 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-medium text-muted hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] flex items-center justify-center gap-2"
              >
                <Copy size={14} /> Copy Last
              </button>
            )}
            <button
              onClick={onAddSet}
              className="flex-1 py-2 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-medium text-muted hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)]"
            >
              + Add Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
