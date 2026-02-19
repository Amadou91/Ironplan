'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, AlertTriangle, Search } from 'lucide-react';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { toMuscleLabel } from '@/lib/muscle-utils';
import { isExerciseEquipmentAvailable } from '@/lib/equipment';
import type { Exercise, EquipmentInventory } from '@/types/domain';

interface AddExerciseModalProps {
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
  focus?: string | string[] | null;
  style?: string | null;
  inventory?: EquipmentInventory | null;
}

/** Lightweight fuzzy match: all words in the query must appear (in order) in the target. */
function fuzzyMatch(target: string, query: string): boolean {
  let i = 0;
  for (const char of query) {
    const idx = target.indexOf(char, i);
    if (idx === -1) return false;
    i = idx + 1;
  }
  return true;
}

function scoreExercise(exercise: Exercise, query: string): number {
  const name = exercise.name.toLowerCase();
  const muscle = (exercise.primaryMuscle ?? '').toLowerCase();
  const pattern = (exercise.movementPattern ?? '').toLowerCase();
  const category = (exercise.category ?? '').toLowerCase();

  if (name.startsWith(query)) return 100;
  if (name.includes(query)) return 80;
  if (muscle.includes(query) || pattern.includes(query) || category.includes(query)) return 60;
  if (fuzzyMatch(name, query)) return 40;
  if (fuzzyMatch(muscle + ' ' + pattern, query)) return 20;
  return 0;
}

export function AddExerciseModal({ onClose, onAdd, focus, style, inventory }: AddExerciseModalProps) {
  const [search, setSearch] = useState('');
  const { catalog, loading } = useExerciseCatalog();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const checkEquipmentAvailable = (exercise: Exercise): boolean => {
    if (!inventory || !exercise.equipment?.length) return true;
    return isExerciseEquipmentAvailable(inventory, exercise.equipment);
  };

  const sortedBase = useMemo(() => {
    const unique = Array.from(new Map(catalog.map((ex) => [ex.name.toLowerCase(), ex])).values());

    let base = unique;
    if (style === 'cardio' || focus === 'cardio') {
      base = unique.filter((ex) => ex.focus === 'cardio' || ex.primaryMuscle === 'cardio');
    } else if (focus && focus !== 'full_body') {
      const focusArray = Array.isArray(focus) ? focus : [focus];
      const focusLowers = focusArray.map((f) => f.toLowerCase());
      const focused = unique.filter((ex) => {
        const primary = ex.primaryMuscle?.toLowerCase() ?? '';
        return focusLowers.some((f) => primary.includes(f));
      });
      base = focused.length > 0 ? focused : unique;
    }

    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, focus, style]);

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedBase;

    return sortedBase
      .map((ex) => ({ ex, score: scoreExercise(ex, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ ex }) => ex);
  }, [search, sortedBase]);

  const renderExerciseRow = (exercise: Exercise) => {
    const hasEquipment = checkEquipmentAvailable(exercise);

    return (
      <button
        key={exercise.name}
        onClick={() => onAdd(exercise)}
        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all active:scale-[0.99] ${
          hasEquipment
            ? 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30'
            : 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm text-strong leading-snug">{exercise.name}</p>
          {!hasEquipment ? (
            <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded">
              <AlertTriangle size={9} />
              Missing gear
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
            {toMuscleLabel(exercise.primaryMuscle ?? '')}
          </span>
          {exercise.movementPattern ? (
            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--color-surface-subtle)] text-subtle border border-[var(--color-border)]">
              {exercise.movementPattern}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  const hasSearch = search.trim().length > 0;
  const resultCount = filteredLibrary.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="surface-elevated w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[80vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
          <div>
            <h3 className="font-semibold text-strong">Add Exercise</h3>
            <p className="text-xs text-subtle">
              {loading ? 'Loading…' : hasSearch ? `${resultCount} result${resultCount !== 1 ? 's' : ''}` : `${sortedBase.length} exercises — scroll or search`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 -mr-1 text-muted hover:text-strong rounded-lg hover:bg-[var(--color-surface-subtle)]">
            <X size={20} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Filter by name, muscle, or movement…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-9"
            />
            {hasSearch ? (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-strong"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,_0px))] space-y-1.5">
          {loading ? (
            <p className="text-sm text-subtle px-1 py-3">Loading exercise catalog…</p>
          ) : filteredLibrary.length === 0 ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-5 text-center">
              <p className="text-sm font-semibold text-strong">No matches for &ldquo;{search}&rdquo;</p>
              <p className="text-xs text-subtle mt-1">Try a different name, muscle group, or movement pattern.</p>
              <button onClick={() => setSearch('')} className="mt-3 text-xs text-accent underline underline-offset-2">
                Clear search
              </button>
            </div>
          ) : (
            filteredLibrary.map((exercise) => renderExerciseRow(exercise))
          )}
        </div>
      </div>
    </div>
  );
}
