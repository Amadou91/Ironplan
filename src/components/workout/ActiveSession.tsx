'use client';

import React, { useRef, useState } from 'react';

import { Trash2, RefreshCcw, Copy } from 'lucide-react';

import { SetLogger } from './SetLogger';

import { SessionHeader } from './session/SessionHeader';

import { SessionControls } from './session/SessionControls';

import { ExerciseNavigator } from './session/ExerciseNavigator';

import { AddExerciseModal } from './modals/AddExerciseModal';

import { SwapExerciseModal } from './modals/SwapExerciseModal';

import { ReorderExercisesModal } from './modals/ReorderExercisesModal';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

import { useActiveSessionManager } from '@/hooks/useActiveSessionManager';

import { isTimeBasedExercise, toMuscleLabel, toMuscleSlug, getMetricProfile } from '@/lib/muscle-utils';

import { buildWeightOptions } from '@/lib/equipment';

import type { 

  EquipmentInventory, 

  SessionExercise, 

  Exercise, 

  FocusArea, 

  Goal 

} from '@/types/domain';

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

  onCancel?: () => void;

  isFinishing?: boolean;

  focus?: FocusArea | null;

  style?: Goal | null;

  /** Callback when start time is changed (for logging past workouts) */
  onStartTimeChange?: (newStartTime: string) => void;

};



export default function ActiveSession({ 

  sessionId, 

  equipmentInventory, 

  onFinish, 

  onCancel, 

  isFinishing, 

  focus, 

  style,

  onStartTimeChange 

}: ActiveSessionProps) {

  const {

    activeSession,

    errorMessage,

    setErrorMessage,

    preferredUnit,

    profileWeightLb,

    exerciseTargets,

    handleSetUpdate,

    addSet,

    removeSet,

    replaceSessionExercise,

    removeSessionExercise,

    addSessionExercise,

    handleReorderExercises,

    resolvedInventory,

    exerciseLibrary,

    exerciseLibraryByName,

    isUpdating,

    supabase,

    handleBodyWeightUpdate

  } = useActiveSessionManager(sessionId, equipmentInventory);



  const [swappingExIdx, setSwappingExIdx] = useState<number | null>(null);

  const [isAddingExercise, setIsAddingExercise] = useState(false);

  const [isReordering, setIsReordering] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [exerciseToRemove, setExerciseToRemove] = useState<number | null>(null);

  const [isEditingWeight, setIsEditingWeight] = useState(false);

  const [editWeightValue, setEditWeightValue] = useState('');

  const [isEditingStartTime, setIsEditingStartTime] = useState(false);

  const [editStartTimeValue, setEditStartTimeValue] = useState('');

  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleWeightEditClick = () => {
    setEditWeightValue(activeSession?.bodyWeightLb?.toString() ?? '');
    setIsEditingWeight(true);
  };

  const handleWeightEditConfirm = async () => {
    const parsed = parseFloat(editWeightValue);
    if (!isNaN(parsed) && parsed > 0) {
      await handleBodyWeightUpdate(parsed);
    }
    setIsEditingWeight(false);
  };

  const handleStartTimeEditClick = () => {
    if (!activeSession?.startedAt) return;
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const date = new Date(activeSession.startedAt);
    const localIso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditStartTimeValue(localIso);
    setIsEditingStartTime(true);
  };

  const handleStartTimeEditConfirm = () => {
    if (editStartTimeValue && onStartTimeChange) {
      const newDate = new Date(editStartTimeValue);
      onStartTimeChange(newDate.toISOString());
    }
    setIsEditingStartTime(false);
  };

  const handleExerciseSelect = (index: number) => {

    setCurrentIndex(index);

    const element = exerciseRefs.current[index];

    if (element) {

      const yOffset = -220;

      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

      window.scrollTo({ top: y, behavior: 'smooth' });

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



    };



  



  const handleRemoveConfirm = () => {

    if (exerciseToRemove !== null) {

      removeSessionExercise(exerciseToRemove);

      setExerciseToRemove(null);

    }

  };

  const handleSaveReorder = async (reorderedExercises: SessionExercise[]) => {
    const updates = reorderedExercises.map((ex, idx) => ({
      id: ex.id,
      orderIndex: idx
    }));
    const result = await handleReorderExercises(updates);
    if (result.success) {
      setIsReordering(false);
    }
  };

  // Use session bodyweight (from readiness check) as primary source, fall back to profile weight
  const effectiveBodyWeightLb = activeSession?.bodyWeightLb ?? profileWeightLb;

  const getWeightOptions = (exercise: SessionExercise) => {

    const match = exerciseLibraryByName.get(exercise.name.toLowerCase());

    if (!match?.equipment?.length) return [];

    return buildWeightOptions(resolvedInventory, match.equipment, effectiveBodyWeightLb, preferredUnit);

  };

  const isDumbbellExercise = (exercise: SessionExercise) =>
    Boolean(exerciseLibraryByName.get(exercise.name.toLowerCase())?.equipment?.some(option => option.kind === 'dumbbell'));



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

        sessionBodyWeight={activeSession.bodyWeightLb}

        preferredUnit={preferredUnit}

        onCancel={onCancel}

        errorMessage={errorMessage}

        onStartTimeClick={onStartTimeChange ? handleStartTimeEditClick : undefined}

        onWeightClick={handleWeightEditClick}

      />



      <ExerciseNavigator exercises={activeSession.exercises} currentIndex={currentIndex} onSelect={handleExerciseSelect} />



      <div className="space-y-6">

        {activeSession.exercises.map((exercise, exIdx) => (

          <div key={exIdx} ref={el => { exerciseRefs.current[exIdx] = el; }} className="surface-card-muted p-4 md:p-6 scroll-mt-[220px]">

            <div className="flex justify-between items-start mb-4">

              <div>

                <div className="flex items-center gap-3">

                  <h3 className="text-lg font-semibold text-strong">{exercise.name}</h3>

                  {(exerciseLibraryByName.get(exercise.name.toLowerCase())?.movementPattern) && (

                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-surface text-subtle border border-border">

                      {exerciseLibraryByName.get(exercise.name.toLowerCase())?.movementPattern}

                    </span>

                  )}

                </div>

                <div className="flex flex-wrap gap-2 mt-1">

                  <span className="badge-accent">{exercise.primaryMuscle}</span>

                  {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (

                    <div className="flex flex-wrap gap-2">

                      {exercise.secondaryMuscles.map((muscle, idx) => (

                        <span key={idx} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border/50">

                          {muscle}

                        </span>

                      ))}

                    </div>

                  )}

                </div>

                {getExerciseTargetSummary(exercise) && <p className="mt-2 text-xs text-muted">Target: {getExerciseTargetSummary(exercise)}</p>}

              </div>

              <div className="flex gap-3">

                <button onClick={() => setSwappingExIdx(exIdx)} className="text-accent hover:text-accent/80 transition-colors"><RefreshCcw size={14} /></button>

                <button onClick={() => setExerciseToRemove(exIdx)} className="text-subtle hover:text-[var(--color-danger)] transition-colors"><Trash2 size={14} /></button>

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

                  isDumbbell={isDumbbellExercise(exercise)}

                />

              ))}

            </div>

            <div className="flex gap-2 mt-4">
              {exercise.sets.length > 0 && (
                <button 
                  onClick={() => {
                    const lastSet = exercise.sets[exercise.sets.length - 1];
                    addSet(exIdx, preferredUnit, null, {
                      loadType: lastSet.loadType || (isDumbbellExercise(exercise) ? 'per_implement' : undefined),
                      implementCount: typeof lastSet.implementCount === 'number' ? lastSet.implementCount : (isDumbbellExercise(exercise) ? 2 : undefined),
                      initialValues: {
                        reps: lastSet.reps,
                        weight: lastSet.weight,
                        rpe: lastSet.rpe,
                        rir: lastSet.rir,
                        restSecondsActual: lastSet.restSecondsActual,
                        loadType: lastSet.loadType,
                        implementCount: lastSet.implementCount
                      }
                    });
                  }} 
                  className="flex-1 py-2 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-medium text-muted hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] flex items-center justify-center gap-2"
                >
                  <Copy size={14} /> Copy Last
                </button>
              )}
              <button 
                onClick={() => addSet(exIdx, preferredUnit, null, isDumbbellExercise(exercise) ? { loadType: 'per_implement', implementCount: 2 } : undefined)} 
                className="flex-1 py-2 border-2 border-dashed border-[var(--color-border-strong)] rounded-xl text-sm font-medium text-muted hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)]"
              >
                + Add Set
              </button>
            </div>

          </div>

        ))}

      </div>



      <SessionControls onFinish={onFinish} onAddExercise={() => setIsAddingExercise(true)} onReorder={() => setIsReordering(true)} isFinishing={isFinishing} />

      {isReordering && activeSession && (
        <ReorderExercisesModal
          exercises={activeSession.exercises}
          onClose={() => setIsReordering(false)}
          onSave={handleSaveReorder}
          isSaving={isUpdating}
        />
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

      {/* Weight Edit Modal */}
      {isEditingWeight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-xl border border-[var(--color-border)] w-80">
            <h3 className="text-lg font-semibold text-strong mb-4">Edit Body Weight</h3>
            <div className="mb-4">
              <label className="text-sm text-muted mb-2 block">Weight ({preferredUnit})</label>
              <input
                type="number"
                value={editWeightValue}
                onChange={(e) => setEditWeightValue(e.target.value)}
                className="input-base w-full"
                autoFocus
                min={0}
                step={0.1}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditingWeight(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-muted hover:bg-[var(--color-surface-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWeightEditConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-strong)] transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Time Edit Modal */}
      {isEditingStartTime && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-xl border border-[var(--color-border)] w-80">
            <h3 className="text-lg font-semibold text-strong mb-4">Edit Start Time</h3>
            <div className="mb-4">
              <label className="text-sm text-muted mb-2 block">Date & Time</label>
              <input
                type="datetime-local"
                value={editStartTimeValue}
                onChange={(e) => setEditStartTimeValue(e.target.value)}
                className="input-base w-full"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsEditingStartTime(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-muted hover:bg-[var(--color-surface-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartTimeEditConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium hover:bg-[var(--color-primary-strong)] transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

  );

}
