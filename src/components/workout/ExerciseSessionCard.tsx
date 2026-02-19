'use client';

import React, { useCallback, useState, memo } from 'react';
import { Trash2, RefreshCcw, Copy, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { SetLogger } from '@/components/workout/SetLogger';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { isTimeBasedExercise } from '@/lib/muscle-utils';
import type { SessionExercise, WorkoutSet, WeightUnit } from '@/types/domain';
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
  const [setToRemove, setSetToRemove] = useState<number | null>(null);
  const completedCount = exercise.sets.filter(s => s.completed).length;
  const allCompleted = exercise.sets.length > 0 && completedCount === exercise.sets.length;

  const handleRemoveSetConfirm = useCallback(() => {
    if (setToRemove !== null) {
      onRemoveSet(setToRemove);
      setSetToRemove(null);
    }
  }, [setToRemove, onRemoveSet]);

  const handleToggleComplete = useCallback(
    (setIdx: number, set: WorkoutSet) => onSetUpdate(setIdx, 'completed', !set.completed),
    [onSetUpdate]
  );

  return (
    <div className="surface-card-muted p-4 md:p-6 scroll-mt-[220px]">
      {/* Always-visible exercise header */}
      <div className="flex justify-between items-start gap-4">
        <button type="button" onClick={onToggleCollapse} className="flex-1 min-w-0 text-left py-1">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold font-display text-strong truncate">{exercise.name}</h3>
            {movementPattern && (
              <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface text-subtle border border-border shrink-0">
                {movementPattern}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="badge-accent">{exercise.primaryMuscle}</span>
            {allCompleted && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-success)] uppercase tracking-wider bg-[var(--color-success-soft)] px-2 py-0.5 rounded-full">
                <Check size={14} strokeWidth={3} /> Done
              </span>
            )}
            {exercise.sets.length > 0 && !allCompleted && (
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                {completedCount}/{exercise.sets.length} sets
              </span>
            )}
            {exerciseTargetSummary && (
              <span className="text-xs text-muted font-medium bg-[var(--color-surface-subtle)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">Target: {exerciseTargetSummary}</span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button onClick={onSwap} className="p-3 -m-1.5 text-accent hover:text-accent/80 hover:bg-[var(--color-primary-soft)] rounded-xl transition-colors" title="Swap exercise"><RefreshCcw size={18} /></button>
          <button onClick={onRemove} className="p-3 -m-1.5 text-subtle hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-xl transition-colors" title="Remove exercise"><Trash2 size={18} /></button>
          <button onClick={onToggleCollapse} className="p-3 -m-1.5 text-muted hover:text-strong rounded-xl transition-colors" title={isCollapsed ? 'Expand' : 'Collapse'}>
            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {!isCollapsed && (
        <div className="mt-6">
          <div className="space-y-3">
            {exercise.sets.map((set, setIdx) => (
              <SetLogger
                key={set.id}
                set={set}
                weightOptions={weightOptions}
                onUpdate={(f, v) => onSetUpdate(setIdx, f, v)}
                onDelete={() => setSetToRemove(setIdx)}
                onToggleComplete={() => handleToggleComplete(setIdx, set)}
                metricProfile={exercise.metricProfile}
                isTimeBased={isTimeBasedExercise(exercise.name, exerciseTargets[exercise.name.toLowerCase()]?.reps)}
              />
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            {hasSets && (
              <button
                onClick={onCopyLastSet}
                className="flex-1 py-3 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-bold text-muted hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Copy size={16} /> Copy Last
              </button>
            )}
            <button
              onClick={onAddSet}
              className="flex-1 py-3 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-bold text-muted hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              + Add Set
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={setToRemove !== null}
        onClose={() => setSetToRemove(null)}
        onConfirm={handleRemoveSetConfirm}
        title="Delete Set"
        description={`Are you sure you want to delete Set ${setToRemove !== null ? exercise.sets[setToRemove]?.setNumber ?? setToRemove + 1 : ''}? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
});
