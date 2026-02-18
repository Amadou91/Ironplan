'use client';

import React, { useState, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toMuscleLabel } from '@/lib/muscle-utils';
import { isExerciseEquipmentAvailable } from '@/lib/equipment';
import type { Exercise, EquipmentInventory } from '@/types/domain';

interface AddExerciseModalProps {
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
  focus?: string | null;
  style?: string | null;
  inventory?: EquipmentInventory | null;
}

export function AddExerciseModal({ onClose, onAdd, focus, style, inventory }: AddExerciseModalProps) {
  const [search, setSearch] = useState('');
  const { catalog, loading } = useExerciseCatalog();

  const checkEquipmentAvailable = (exercise: Exercise): boolean => {
    if (!inventory || !exercise.equipment?.length) return true;
    return isExerciseEquipmentAvailable(inventory, exercise.equipment);
  };

  const filteredLibrary = useMemo(() => {
    const s = search.trim().toLowerCase();
    const unique = Array.from(new Map(catalog.map((ex) => [ex.name.toLowerCase(), ex])).values())
      .sort((a, b) => a.name.localeCompare(b.name));

    let base = unique;
    if (style === 'cardio' || focus === 'cardio') {
      base = unique.filter((ex) => ex.focus === 'cardio' || ex.primaryMuscle === 'cardio');
    } else if (focus && focus !== 'full_body') {
      base = unique.filter((ex) => ex.primaryMuscle?.toLowerCase().includes(focus.toLowerCase()));
    }

    if (base.length === 0) {
      base = unique;
    }

    if (!s) {
      return base.slice(0, 60);
    }

    return base
      .filter((ex) =>
        ex.name.toLowerCase().includes(s) ||
        ex.primaryMuscle?.toLowerCase().includes(s) ||
        ex.movementPattern?.toLowerCase().includes(s) ||
        ex.category?.toLowerCase().includes(s)
      )
      .slice(0, 30);
  }, [search, focus, style, catalog]);

  const categoryGroups = useMemo(() => {
    if (search.trim().length > 0) return [] as Array<{ category: string; exercises: Exercise[] }>;

    const groups = filteredLibrary.reduce<Record<string, Exercise[]>>((acc, exercise) => {
      const key = exercise.category ?? 'Other';
      acc[key] = acc[key] ?? [];
      acc[key].push(exercise);
      return acc;
    }, {});

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, exercises]) => ({ category, exercises }));
  }, [filteredLibrary, search]);

  const renderExerciseOption = (exercise: Exercise) => {
    const hasEquipment = checkEquipmentAvailable(exercise);

    return (
      <button
        key={exercise.name}
        onClick={() => onAdd(exercise)}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
          hasEquipment
            ? 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30'
            : 'border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-strong">{exercise.name}</p>
          {!hasEquipment && (
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded">
              <AlertTriangle size={10} />
              No equipment
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{toMuscleLabel(exercise.primaryMuscle ?? '')}</p>
          {exercise.movementPattern && (
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface text-subtle border border-border">
              {exercise.movementPattern}
            </span>
          )}
          {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
            <p className="text-[10px] font-medium text-subtle/60 uppercase tracking-wider">
              + {exercise.secondaryMuscles.map((m) => toMuscleLabel(m)).join(', ')}
            </p>
          )}
        </div>
      </button>
    );
  };

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
          {loading ? (
            <p className="text-sm text-subtle">Loading exercise catalog…</p>
          ) : filteredLibrary.length === 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
              <p className="text-sm font-semibold text-strong">No matches found</p>
              <p className="text-xs text-subtle mt-1">Try a muscle group, movement pattern, or exercise name.</p>
            </div>
          ) : search.trim().length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Browse suggestions</p>
                <p className="text-xs text-subtle mt-1">Showing category groups with A–Z exercise names to guide your search.</p>
              </div>

              {categoryGroups.map(({ category, exercises }) => (
                <section key={category} className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-subtle">{category}</h4>
                  <div className="space-y-2">
                    {exercises.slice(0, 8).map((exercise) => renderExerciseOption(exercise))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            filteredLibrary.map((exercise) => renderExerciseOption(exercise))
          )}
        </div>
      </div>
    </div>
  );
}
