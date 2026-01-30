'use client';

import React, { useState, useCallback } from 'react';
import { X, GripVertical, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SessionExercise } from '@/types/domain';
import { cn } from '@/lib/utils';

interface ReorderExercisesModalProps {
  exercises: SessionExercise[];
  onClose: () => void;
  onSave: (reorderedExercises: SessionExercise[]) => void;
  isSaving?: boolean;
}

export function ReorderExercisesModal({
  exercises,
  onClose,
  onSave,
  isSaving = false
}: ReorderExercisesModalProps) {
  const [localExercises, setLocalExercises] = useState<SessionExercise[]>(() => 
    exercises.map((ex, idx) => ({ ...ex, orderIndex: idx }))
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const moveExercise = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setLocalExercises(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((ex, idx) => ({ ...ex, orderIndex: idx }));
    });
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      moveExercise(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      moveExercise(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < localExercises.length - 1) {
      moveExercise(index, index + 1);
    }
  };

  const handleSave = () => {
    onSave(localExercises);
  };

  const hasChanges = localExercises.some((ex, idx) => {
    const original = exercises.find(e => e.id === ex.id);
    return original && exercises.indexOf(original) !== idx;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="surface-elevated w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="font-semibold text-strong">Reorder Exercises</h3>
            <p className="text-xs text-subtle">Drag to reorder or use arrow buttons</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-strong transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {localExercises.map((exercise, index) => (
            <div
              key={exercise.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing",
                draggedIndex === index && "opacity-50 scale-95",
                dragOverIndex === index && "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/20",
                dragOverIndex !== index && draggedIndex !== index && "border-[var(--color-border)] bg-[var(--color-surface)]",
                "hover:border-[var(--color-border-strong)]"
              )}
            >
              <div className="text-muted cursor-grab">
                <GripVertical size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-xs font-bold text-muted">
                    {index + 1}
                  </span>
                  <span className="font-medium text-strong truncate">{exercise.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{exercise.primaryMuscle}</span>
                  <span className="text-[10px] text-subtle">• {exercise.sets.length} sets</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    index === 0 
                      ? "text-muted/30 cursor-not-allowed" 
                      : "text-muted hover:text-strong hover:bg-[var(--color-surface-muted)]"
                  )}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === localExercises.length - 1}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    index === localExercises.length - 1 
                      ? "text-muted/30 cursor-not-allowed" 
                      : "text-muted hover:text-strong hover:bg-[var(--color-surface-muted)]"
                  )}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="flex items-center gap-2"
          >
            <Check size={16} />
            {isSaving ? 'Saving...' : 'Save Order'}
          </Button>
        </div>
      </div>
    </div>
  );
}
