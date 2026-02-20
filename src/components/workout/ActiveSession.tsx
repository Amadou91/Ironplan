'use client';

import React, { useCallback, useRef, useState } from 'react';
import { SessionHeader } from '@/components/workout/session/SessionHeader';
import { SessionControls } from '@/components/workout/session/SessionControls';
import { ExerciseSessionCard } from '@/components/workout/ExerciseSessionCard';
import { AddExerciseModal } from '@/components/workout/modals/AddExerciseModal';
import { SwapExerciseModal } from '@/components/workout/modals/SwapExerciseModal';
import { ReorderExercisesModal } from '@/components/workout/modals/ReorderExercisesModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EditFieldModal } from '@/components/workout/EditFieldModal';
import { useActiveSessionManager } from '@/hooks/useActiveSessionManager';
import { toMuscleLabel, toMuscleSlug, getMetricProfile } from '@/lib/muscle-utils';
import { buildWeightOptions } from '@/lib/equipment';
import type { EquipmentInventory, SessionExercise, Exercise, FocusArea, Goal } from '@/types/domain';

/** Format rest time in seconds to a human-readable string */
const formatRestTime = (seconds: number): string => {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}

type ActiveSessionProps = {
  sessionId?: string | null;
  equipmentInventory?: EquipmentInventory | null;
  onFinish?: () => void;
  isFinishing?: boolean;
  focus?: FocusArea | FocusArea[] | null;
  style?: Goal | null;
  /** Callback when start time is changed (for logging past workouts) */
  onStartTimeChange?: (newStartTime: string) => void;
};

export function ActiveSession({
  sessionId, equipmentInventory, onFinish, isFinishing, focus, style, onStartTimeChange
}: ActiveSessionProps) {
  const {
    activeSession, errorMessage, setErrorMessage, preferredUnit, profileWeightLb,
    exerciseTargets, handleSetUpdate, addSet, handleRemoveSet, replaceSessionExercise,
    handleRemoveExercise, addSessionExercise, handleReorderExercises,
    resolvedInventory, exerciseLibrary, exerciseLibraryByName, isUpdating,
    supabase, handleBodyWeightUpdate
  } = useActiveSessionManager(sessionId, equipmentInventory);

  const [swappingExIdx, setSwappingExIdx] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [exerciseToRemove, setExerciseToRemove] = useState<number | null>(null);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [editWeightValue, setEditWeightValue] = useState('');
  const [isEditingStartTime, setIsEditingStartTime] = useState(false);
  const [editStartTimeValue, setEditStartTimeValue] = useState('');
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleWeightEditClick = useCallback(() => {
    setEditWeightValue(activeSession?.bodyWeightLb?.toString() ?? '');
    setIsEditingWeight(true);
  }, [activeSession?.bodyWeightLb]);

  const handleWeightEditConfirm = useCallback(async () => {
    const parsed = parseFloat(editWeightValue);
    if (!isNaN(parsed) && parsed > 0) {
      await handleBodyWeightUpdate(parsed);
    }
    setIsEditingWeight(false);
  }, [editWeightValue, handleBodyWeightUpdate]);

  const handleStartTimeEditClick = useCallback(() => {
    if (!activeSession?.startedAt) return;
    const date = new Date(activeSession.startedAt);
    const localIso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditStartTimeValue(localIso);
    setIsEditingStartTime(true);
  }, [activeSession]);

  const handleStartTimeEditConfirm = useCallback(() => {
    if (editStartTimeValue && onStartTimeChange) {
      const newDate = new Date(editStartTimeValue);
      onStartTimeChange(newDate.toISOString());
    }
    setIsEditingStartTime(false);
  }, [editStartTimeValue, onStartTimeChange]);

  const handleAddExercise = useCallback(async (newExercise: Exercise) => {
    if (!activeSession) return;
    try {
      const metricProfile = getMetricProfile(newExercise);
      const { data, error } = await supabase
        .from('session_exercises')
        .insert({
          session_id: activeSession.id,
          exercise_name: newExercise.name,
          primary_muscle: toMuscleSlug(newExercise.primaryMuscle ?? 'full_body'),
          secondary_muscles: newExercise.secondaryMuscles?.map(m => toMuscleSlug(m)) ?? [],
          metric_profile: metricProfile,
          order_index: activeSession.exercises.length
        })
        .select('id').single();
      if (error) throw error;
      addSessionExercise({
        id: data.id,
        sessionId: activeSession.id,
        name: newExercise.name,
        primaryMuscle: toMuscleLabel(newExercise.primaryMuscle ?? 'Full Body'),
        secondaryMuscles: (newExercise.secondaryMuscles ?? []).map(m => toMuscleLabel(m)),
        metricProfile: metricProfile,
        sets: [],
        orderIndex: activeSession.exercises.length
      });
      setIsAddingExercise(false);
    } catch {
      setErrorMessage('Unable to add exercise.');
    }
  }, [activeSession, supabase, addSessionExercise, setErrorMessage]);

  const handleSwapExercise = useCallback(async (exIdx: number, newExercise: Exercise) => {
    if (!activeSession) return;
    const oldExercise = activeSession.exercises[exIdx];
    try {
      const metricProfile = getMetricProfile(newExercise);
      await supabase.from('session_exercises').update({
        exercise_id: newExercise.id,
        exercise_name: newExercise.name,
        primary_muscle: toMuscleSlug(newExercise.primaryMuscle ?? 'full_body'),
        secondary_muscles: newExercise.secondaryMuscles?.map(m => toMuscleSlug(m)) ?? [],
        metric_profile: metricProfile
      }).eq('id', oldExercise.id);
      replaceSessionExercise(exIdx, {
        exerciseId: newExercise.id,
        name: newExercise.name,
        primaryMuscle: toMuscleLabel(newExercise.primaryMuscle ?? 'Full Body'),
        secondaryMuscles: (newExercise.secondaryMuscles ?? []).map(m => toMuscleLabel(m)),
        metricProfile: metricProfile
      });
      setSwappingExIdx(null);
    } catch {
      setErrorMessage('Unable to swap exercise.');
    }
  }, [activeSession, supabase, replaceSessionExercise, setErrorMessage]);

  const handleRemoveConfirm = useCallback(async () => {
    if (exerciseToRemove !== null) {
      await handleRemoveExercise(exerciseToRemove);
      setExerciseToRemove(null);
    }
  }, [exerciseToRemove, handleRemoveExercise]);

  const handleSaveReorder = useCallback(async (reorderedExercises: SessionExercise[]) => {
    const updates = reorderedExercises.map((ex, idx) => ({ id: ex.id, orderIndex: idx }));
    const result = await handleReorderExercises(updates);
    if (result.success) setIsReordering(false);
  }, [handleReorderExercises]);

  const effectiveBodyWeightLb = activeSession?.bodyWeightLb ?? profileWeightLb;

  const getWeightOptions = useCallback((exercise: SessionExercise) => {
    const match = exerciseLibraryByName.get(exercise.name.toLowerCase());
    if (!match?.equipment?.length) return [];
    return buildWeightOptions(resolvedInventory, match.equipment, effectiveBodyWeightLb, preferredUnit);
  }, [exerciseLibraryByName, resolvedInventory, effectiveBodyWeightLb, preferredUnit]);

  const isDumbbellExercise = useCallback((exercise: SessionExercise) =>
    Boolean(exerciseLibraryByName.get(exercise.name.toLowerCase())?.equipment?.some(option => option.kind === 'dumbbell')),
  [exerciseLibraryByName]);

  const getExerciseTargetSummary = useCallback((exercise: SessionExercise) => {
    const target = exerciseTargets[exercise.name.toLowerCase()];
    if (!target) return null;
    const parts: string[] = [];
    if (typeof target.sets === 'number') parts.push(`${target.sets} sets`);
    if (target.reps) parts.push(`${target.reps} reps`);
    if (target.restSeconds) parts.push(`${formatRestTime(target.restSeconds)} rest`);
    return parts.join(' · ');
  }, [exerciseTargets]);

  if (!activeSession && !errorMessage) return <div className="p-6 text-center text-muted">Loading session...</div>;
  if (!activeSession) return null;

  return (
    <div className="space-y-2 pb-32">
      <SessionHeader
        name={activeSession.name}
        startedAt={activeSession.startedAt}
        progressSummary={{
          totalExercises: activeSession.exercises.length,
          totalSets: activeSession.exercises.reduce((s, e) => s + e.sets.length, 0),
          completedSets: activeSession.exercises.reduce((s, e) => s + e.sets.filter(st => st.completed).length, 0),
          completedExercises: activeSession.exercises.filter(e => e.sets.some(st => st.completed)).length
        }}
        sessionBodyWeight={activeSession.bodyWeightLb}
        preferredUnit={preferredUnit}
        errorMessage={errorMessage}
        onStartTimeClick={onStartTimeChange ? handleStartTimeEditClick : undefined}
        onWeightClick={handleWeightEditClick}
      />
      <div className="space-y-6 !mt-6">
        {activeSession.exercises.map((exercise, exIdx) => {
          const isCollapsed = collapsedExercises.has(exIdx);
          const toggleCollapse = () => {
            setCollapsedExercises(prev => {
              const next = new Set(prev);
              if (next.has(exIdx)) next.delete(exIdx);
              else next.add(exIdx);
              return next;
            });
          };

          return (
            <div key={exIdx} ref={el => { exerciseRefs.current[exIdx] = el; }}>
              <ExerciseSessionCard
                exercise={exercise}
                exIdx={exIdx}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggleCollapse}
                onSwap={() => setSwappingExIdx(exIdx)}
                onRemove={() => setExerciseToRemove(exIdx)}
                onSetUpdate={(setIdx, field, value) => handleSetUpdate(exIdx, setIdx, field, value)}
                onRemoveSet={(setIdx) => handleRemoveSet(exIdx, setIdx)}
                onAddSet={() => addSet(exIdx, preferredUnit, null, isDumbbellExercise(exercise) ? { loadType: 'per_implement', implementCount: 2 } : undefined)}
                onCopyLastSet={() => {
                  const lastSet = exercise.sets[exercise.sets.length - 1];
                  if (!lastSet) return;
                  addSet(exIdx, preferredUnit, null, {
                    loadType: lastSet.loadType || (isDumbbellExercise(exercise) ? 'per_implement' : undefined),
                    implementCount: typeof lastSet.implementCount === 'number' ? lastSet.implementCount : (isDumbbellExercise(exercise) ? 2 : undefined),
                    initialValues: {
                      reps: lastSet.reps, weight: lastSet.weight, rpe: lastSet.rpe,
                      rir: lastSet.rir, restSecondsActual: lastSet.restSecondsActual,
                      loadType: lastSet.loadType, implementCount: lastSet.implementCount,
                      extraMetrics: lastSet.extraMetrics,
                      durationSeconds: lastSet.durationSeconds,
                      distance: lastSet.distance,
                      distanceUnit: lastSet.distanceUnit
                    }
                  });
                }}
                weightOptions={getWeightOptions(exercise)}
                exerciseTargetSummary={getExerciseTargetSummary(exercise)}
                movementPattern={exerciseLibraryByName.get(exercise.name.toLowerCase())?.movementPattern}
                exerciseTargets={exerciseTargets}
                preferredUnit={preferredUnit}
                hasSets={exercise.sets.length > 0}
              />
            </div>
          );
        })}
      </div>

      <SessionControls onFinish={onFinish} onAddExercise={() => setIsAddingExercise(true)} onReorder={() => setIsReordering(true)} isFinishing={isFinishing} />
      {isReordering && activeSession && (
        <ReorderExercisesModal exercises={activeSession.exercises} onClose={() => setIsReordering(false)} onSave={handleSaveReorder} isSaving={isUpdating} />
      )}
      {isAddingExercise && <AddExerciseModal onClose={() => setIsAddingExercise(false)} onAdd={handleAddExercise} focus={focus} style={style} inventory={resolvedInventory} />}
      {swappingExIdx !== null && (
        <SwapExerciseModal
          exercise={activeSession.exercises[swappingExIdx]}
          onClose={() => setSwappingExIdx(null)}
          onSwap={ex => handleSwapExercise(swappingExIdx, ex)}
          inventory={resolvedInventory}
          exerciseLibrary={exerciseLibrary}
          exerciseLibraryByName={exerciseLibraryByName}
          sessionExercises={activeSession.exercises}
        />
      )}
      <ConfirmDialog
        isOpen={exerciseToRemove !== null}
        onClose={() => setExerciseToRemove(null)}
        onConfirm={handleRemoveConfirm}
        title="Remove Exercise"
        description="Are you sure you want to remove this exercise from the session? All logged sets for this exercise will be lost."
        confirmText="Remove"
        variant="danger"
      />
      <EditFieldModal
        isOpen={isEditingWeight}
        onClose={() => setIsEditingWeight(false)}
        onConfirm={handleWeightEditConfirm}
        title="Edit Body Weight"
        label={`Weight (${preferredUnit})`}
        value={editWeightValue}
        onChange={setEditWeightValue}
        inputType="number"
        inputMode="decimal"
        min={0}
        step={0.1}
      />
      <EditFieldModal
        isOpen={isEditingStartTime}
        onClose={() => setIsEditingStartTime(false)}
        onConfirm={handleStartTimeEditConfirm}
        title="Edit Start Time"
        label="Date & Time"
        value={editStartTimeValue}
        onChange={setEditStartTimeValue}
        inputType="datetime-local"
      />
    </div>
  );
}
