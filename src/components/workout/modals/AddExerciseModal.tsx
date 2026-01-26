'use client';

import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toMuscleLabel } from '@/lib/muscle-utils';
import type { Exercise } from '@/types/domain';

interface AddExerciseModalProps {
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
  focus?: string | null;
  style?: string | null;
}

export function AddExerciseModal({ onClose, onAdd, focus, style }: AddExerciseModalProps) {
  const [search, setSearch] = useState('');
  const { catalog } = useExerciseCatalog();

  const filteredLibrary = useMemo(() => {
    const s = search.toLowerCase();
    const unique = Array.from(new Map(catalog.map(ex => [ex.name.toLowerCase(), ex])).values());
    
    let base = unique;
    if (!s) {
      if (style === 'cardio' || focus === 'cardio') {
        base = unique.filter(ex => ex.focus === 'cardio' || ex.primaryMuscle === 'cardio');
      } else if (focus && focus !== 'full_body') {
        base = unique.filter(ex => ex.primaryMuscle?.toLowerCase().includes(focus.toLowerCase()));
      }
    }

    if (!s) return base.slice(0, 15);
    return base.filter(ex => 
      ex.name.toLowerCase().includes(s) || 
      ex.primaryMuscle?.toLowerCase().includes(s)
    ).slice(0, 15);
  }, [search, focus, style, catalog]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="surface-elevated w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="font-semibold text-strong">Add Workout</h3>
            <p className="text-xs text-subtle">Search and add a new exercise</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-strong">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 border-b border-[var(--color-border)]">
          <input
            type="text"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredLibrary.map((exercise) => (
            <button
              key={exercise.name}
              onClick={() => onAdd(exercise)}
              className="w-full text-left p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30 transition-all"
            >
              <p className="font-semibold text-sm text-strong">{exercise.name}</p>
              <p className="text-[10px] text-muted uppercase tracking-wider">{toMuscleLabel(exercise.primaryMuscle ?? '')}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
