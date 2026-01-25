'use client';

import React, { useRef, useState } from 'react';
import { Trash2, RefreshCcw } from 'lucide-react';
import { SetLogger } from './SetLogger';
import { SessionHeader } from './session/SessionHeader';
import { SessionControls } from './session/SessionControls';
import { ExerciseNavigator } from './session/ExerciseNavigator';
import { AddExerciseModal } from './modals/AddExerciseModal';
import { SwapExerciseModal } from './modals/SwapExerciseModal';
import { useActiveSessionManager } from '@/hooks/useActiveSessionManager';
import { isTimeBasedExercise, toMuscleLabel, toMuscleSlug, getMetricProfile } from '@/lib/muscle-utils';
import { buildWeightOptions } from '@/lib/equipment';
import { convertWeight } from '@/lib/units';
import type { 
  EquipmentInventory, 
  SessionExercise, 
  Exercise, 
  FocusArea, 
  Goal 
} from '@/types/domain';

type ActiveSessionProps = {
  sessionId?: string | null;
  equipmentInventory?: EquipmentInventory | null;
  onBodyWeightChange?: (weight: number | null) => void;
  onFinish?: () => void;
  onCancel?: () => void;
  isFinishing?: boolean;
  focus?: FocusArea | null;
  style?: Goal | null;
};

const formatRestTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export default function ActiveSession({ 
  sessionId, 
  equipmentInventory, 
  onBodyWeightChange, 
  onFinish, 
  onCancel, 
  isFinishing, 
  focus, 
  style 
}: ActiveSessionProps) {
  const {
    activeSession,
    errorMessage,
    setErrorMessage,
    sessionBodyWeight,
    setSessionBodyWeight,
    preferredUnit,
    togglePreferredUnit,
    profileWeightLb,
    exerciseTargets,
    restTimer,
    clearRestTimer,
    handleSetUpdate,
    addSet,
    removeSet,
    replaceSessionExercise,
    removeSessionExercise,
    addSessionExercise,
    resolvedInventory,
    exerciseLibrary,
    exerciseLibraryByName,
    supabase
  } = useActiveSessionManager(sessionId, equipmentInventory);

  const [swappingExIdx, setSwappingExIdx] = useState<number | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleExerciseSelect = (index: number) => {
    setCurrentIndex(index);
    const element = exerciseRefs.current[index];
    if (element) {
      const yOffset = -220;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleBodyWeightUpdate = (value: string) => {
    setSessionBodyWeight(value);
    if (!activeSession) return;
    const weightVal = parseFloat(value);
    const validWeight = !isNaN(weightVal) ? weightVal : null;
    const lbWeight = (validWeight !== null && preferredUnit === 'kg') 
      ? convertWeight(validWeight, 'kg', 'lb') 
      : validWeight;
    onBodyWeightChange?.(lbWeight);
    if (validWeight !== null) {
      supabase.from('sessions').update({ body_weight_lb: lbWeight }).eq('id', activeSession.id).then();
    }
  };

  const handleAddExercise = async (newExercise: Exercise) => {
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
  };

  const handleSwapExercise = async (exIdx: number, newExercise: Exercise) => {
    if (!activeSession) return;
    const oldExercise = activeSession.exercises[exIdx];
    try {
      const metricProfile = getMetricProfile(newExercise);
      await supabase.from('session_exercises').update({
        exercise_name: newExercise.name,
        primary_muscle: toMuscleSlug(newExercise.primaryMuscle ?? 'full_body'),
        secondary_muscles: newExercise.secondaryMuscles?.map(m => toMuscleSlug(m)) ?? [],
        metric_profile: metricProfile
      }).eq('id', oldExercise.id);

      replaceSessionExercise(exIdx, {
        name: newExercise.name,
        primaryMuscle: toMuscleLabel(newExercise.primaryMuscle ?? 'Full Body'),
        secondaryMuscles: (newExercise.secondaryMuscles ?? []).map(m => toMuscleLabel(m)),
        metricProfile: metricProfile
      });
      setSwappingExIdx(null);
    } catch {
      setErrorMessage('Unable to swap exercise.');
    }
  };

  const getWeightOptions = (exercise: SessionExercise) => {
    const match = exerciseLibraryByName.get(exercise.name.toLowerCase());
    if (!match?.equipment?.length) return [];
    return buildWeightOptions(resolvedInventory, match.equipment, profileWeightLb, preferredUnit);
  };

  const getExerciseTargetSummary = (exercise: SessionExercise) => {
    const target = exerciseTargets[exercise.name.toLowerCase()];
    if (!target) return null;
    const parts: string[] = [];
    if (typeof target.sets === 'number') parts.push(`${target.sets} sets`);
    if (target.reps) parts.push(`${target.reps} reps`);
    if (target.restSeconds) parts.push(`${formatRestTime(target.restSeconds)} rest`);
    return parts.join(' · ');
  };

  if (!activeSession && !errorMessage) return <div className="p-6 text-center text-muted">Loading session...</div>;
  if (!activeSession) return null;

  return (
    <div className="space-y-8 pb-32">
      <SessionHeader
        name={activeSession.name}
        startedAt={activeSession.startedAt}
        progressSummary={{
          totalExercises: activeSession.exercises.length,
          totalSets: activeSession.exercises.reduce((s, e) => s + e.sets.length, 0),
          completedSets: activeSession.exercises.reduce((s, e) => s + e.sets.filter(st => st.completed).length, 0),
          completedExercises: activeSession.exercises.filter(e => e.sets.some(st => st.completed)).length
        }}
        sessionBodyWeight={sessionBodyWeight}
        preferredUnit={preferredUnit}
        onBodyWeightUpdate={handleBodyWeightUpdate}
        onToggleUnit={togglePreferredUnit}
        onCancel={onCancel}
        errorMessage={errorMessage}
        restTimer={restTimer}
        onClearRestTimer={clearRestTimer}
      />

      <ExerciseNavigator exercises={activeSession.exercises} currentIndex={currentIndex} onSelect={handleExerciseSelect} />

      <div className="space-y-6">
        {activeSession.exercises.map((exercise, exIdx) => (
          <div key={exIdx} ref={el => { exerciseRefs.current[exIdx] = el; }} className="surface-card-muted p-4 md:p-6 scroll-mt-[220px]">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-strong">{exercise.name}</h3>
                <div className="flex gap-2 mt-1">
                  <span className="badge-accent">{exercise.primaryMuscle}</span>
                </div>
                {getExerciseTargetSummary(exercise) && <p className="mt-2 text-xs text-muted">Target: {getExerciseTargetSummary(exercise)}</p>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSwappingExIdx(exIdx)} className="text-accent hover:text-accent/80 transition-colors"><RefreshCcw size={14} /></button>
                <button onClick={() => { if (confirm('Remove?')) removeSessionExercise(exIdx); }} className="text-subtle hover:text-[var(--color-danger)] transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>

            <div className="space-y-2">
              {exercise.sets.map((set, setIdx) => (
                <SetLogger
                  key={set.id}
                  set={set}
                  weightOptions={getWeightOptions(exercise)}
                  onUpdate={(f, v) => handleSetUpdate(exIdx, setIdx, f, v)}
                  onDelete={() => removeSet(exIdx, setIdx)}
                  onToggleComplete={() => handleSetUpdate(exIdx, setIdx, 'completed', !set.completed)}
                  metricProfile={exercise.metricProfile}
                  isTimeBased={isTimeBasedExercise(exercise.name, exerciseTargets[exercise.name.toLowerCase()]?.reps)}
                />
              ))}
            </div>
            <button onClick={() => addSet(exIdx, preferredUnit, profileWeightLb)} className="mt-4 w-full py-2 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-medium text-muted hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)]">
              + Add Set
            </button>
          </div>
        ))}
      </div>

      <SessionControls onFinish={onFinish} onAddExercise={() => setIsAddingExercise(true)} onReorder={() => {}} isFinishing={isFinishing} />

      {isAddingExercise && <AddExerciseModal onClose={() => setIsAddingExercise(false)} onAdd={handleAddExercise} focus={focus} style={style} />}
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
    </div>
  );
}