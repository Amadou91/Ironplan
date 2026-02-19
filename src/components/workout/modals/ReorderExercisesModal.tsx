'use client';

import React, { useState, useCallback } from 'react';
import { X, GripVertical, Check } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import type { SessionExercise } from '@/types/domain';
import { cn } from '@/lib/utils';

interface SortableExerciseItemProps {
  exercise: SessionExercise;
  index: number;
}

function SortableExerciseItem({ exercise, index }: SortableExerciseItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border-2 transition-colors',
        isDragging
          ? 'opacity-50 scale-95 border-[var(--color-primary)] bg-[var(--color-primary-soft)]/20 z-50'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
      )}
    >
      <button
        className="text-muted cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Drag to reorder ${exercise.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} />
      </button>

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
    </div>
  );
}

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
  isSaving = false,
}: ReorderExercisesModalProps) {
  const [localExercises, setLocalExercises] = useState<SessionExercise[]>(() =>
    exercises.map((ex, idx) => ({ ...ex, orderIndex: idx }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalExercises(prev => {
      const oldIndex = prev.findIndex(ex => ex.id === active.id);
      const newIndex = prev.findIndex(ex => ex.id === over.id);
      const moved = arrayMove(prev, oldIndex, newIndex);
      return moved.map((ex, idx) => ({ ...ex, orderIndex: idx }));
    });
  }, []);

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
            <p className="text-xs text-subtle">Drag to reorder exercises</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-strong transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localExercises.map(ex => ex.id)}
              strategy={verticalListSortingStrategy}
            >
              {localExercises.map((exercise, index) => (
                <SortableExerciseItem
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                />
              ))}
            </SortableContext>
          </DndContext>
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
