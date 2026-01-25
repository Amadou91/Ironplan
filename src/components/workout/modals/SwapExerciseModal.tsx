'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { getSwapSuggestions } from '@/lib/exercise-swap';
import { toMuscleLabel } from '@/lib/muscle-utils';
import type { Exercise, SessionExercise, EquipmentInventory } from '@/types/domain';

interface SwapExerciseModalProps {
  exercise: SessionExercise;
  onClose: () => void;
  onSwap: (newExercise: Exercise) => void;
  inventory: EquipmentInventory;
  exerciseLibrary: Exercise[];
  exerciseLibraryByName: Map<string, Exercise>;
  sessionExercises: SessionExercise[];
}

export function SwapExerciseModal({ 
  exercise, 
  onClose, 
  onSwap, 
  inventory, 
  exerciseLibrary, 
  exerciseLibraryByName,
  sessionExercises
}: SwapExerciseModalProps) {
  const swapSuggestions = useMemo(() => {
    const libraryMatch = exerciseLibraryByName.get(exercise.name.toLowerCase());
    if (!libraryMatch) return [];

    const sessionExsAsLibrary = sessionExercises
      .map(ex => exerciseLibraryByName.get(ex.name.toLowerCase()))
      .filter((ex): ex is Exercise => Boolean(ex));

    const { suggestions } = getSwapSuggestions({
      current: libraryMatch,
      sessionExercises: sessionExsAsLibrary,
      inventory,
      library: exerciseLibrary,
      limit: 6
    });

    return suggestions;
  }, [exercise, exerciseLibrary, exerciseLibraryByName, inventory, sessionExercises]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="surface-elevated w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="font-semibold text-strong">Swap Exercise</h3>
            <p className="text-xs text-subtle">Choose an alternative for {exercise.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-strong">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {swapSuggestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">No suitable alternatives found.</div>
          ) : (
            swapSuggestions.map(({ exercise: suggestion, score }) => (
              <button
                key={suggestion.name}
                onClick={() => onSwap(suggestion)}
                className="w-full text-left p-4 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-strong group-hover:text-[var(--color-primary-strong)]">{suggestion.name}</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-subtle">Match Score: {score}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{toMuscleLabel(suggestion.primaryMuscle ?? '')}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
