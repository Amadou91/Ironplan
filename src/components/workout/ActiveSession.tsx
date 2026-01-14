'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { SetLogger } from './SetLogger';
import { Plus, Save, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SessionExercise, WorkoutImpact, WorkoutSession, WorkoutSet } from '@/types/domain';
import { toMuscleLabel } from '@/lib/muscle-utils';
import { Button } from '@/components/ui/Button';

type ActiveSessionProps = {
  sessionId?: string | null;
};

type SessionPayload = {
  id: string;
  name: string;
  workout_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  impact?: WorkoutImpact | null;
  session_exercises: Array<{
    id: string;
    exercise_name: string;
    primary_muscle: string | null;
    secondary_muscles: string[] | null;
    order_index: number | null;
    sets: Array<{
      id: string;
      set_number: number | null;
      reps: number | null;
      weight: number | null;
      rpe: number | null;
      rir: number | null;
      notes: string | null;
      completed: boolean | null;
      performed_at: string | null;
    }>;
  }>;
};

export default function ActiveSession({ sessionId }: ActiveSessionProps) {
  const { activeSession, addSet, removeSet, updateSet, endSession, startSession } = useWorkoutStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const mapSession = useCallback((payload: SessionPayload): WorkoutSession => {
    return {
      id: payload.id,
      userId: '',
      workoutId: payload.workout_id ?? undefined,
      name: payload.name,
      startedAt: payload.started_at,
      endedAt: payload.ended_at ?? undefined,
      status: (payload.status as WorkoutSession['status']) ?? 'active',
      impact: payload.impact ?? undefined,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, idx) => ({
          id: exercise.id,
          sessionId: payload.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
          secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
          orderIndex: exercise.order_index ?? idx,
          sets: (exercise.sets ?? [])
            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set, setIdx) => ({
              id: set.id,
              setNumber: set.set_number ?? setIdx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              notes: set.notes ?? '',
              performedAt: set.performed_at ?? undefined,
              completed: set.completed ?? false
            }))
        }))
    };
  }, []);

  useEffect(() => {
    if (activeSession || !sessionId) return;
    setIsLoading(true);
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(
          'id, name, workout_id, started_at, ended_at, status, impact, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, notes, completed, performed_at))'
        )
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Failed to load session', error);
        setErrorMessage('Unable to load the active session. Please try again.');
      } else if (data) {
        startSession(mapSession(data as SessionPayload));
      }
      setIsLoading(false);
    };
    fetchSession();
  }, [activeSession, mapSession, sessionId, startSession, supabase]);

  const persistSet = useCallback(
    async (exercise: SessionExercise, set: WorkoutSet, exerciseIndex: number) => {
      if (!exercise.id) return;

      const payload = {
        session_exercise_id: exercise.id,
        set_number: set.setNumber,
        reps: typeof set.reps === 'number' ? set.reps : null,
        weight: typeof set.weight === 'number' ? set.weight : null,
        rpe: typeof set.rpe === 'number' ? set.rpe : null,
        rir: typeof set.rir === 'number' ? set.rir : null,
        notes: set.notes ?? null,
        completed: set.completed,
        performed_at: set.performedAt ?? new Date().toISOString()
      };

      if (set.id && !set.id.startsWith('temp-')) {
        const { error } = await supabase.from('sets').update(payload).eq('id', set.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('sets').insert(payload).select('id, performed_at').single();
        if (error) throw error;
        if (data?.id) {
          updateSet(exerciseIndex, set.setNumber - 1, 'id', data.id);
          updateSet(exerciseIndex, set.setNumber - 1, 'performedAt', data.performed_at ?? new Date().toISOString());
        }
      }
    },
    [supabase, updateSet]
  );

  const handleSetUpdate = async (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: string | number | boolean) => {
    if (!activeSession) return;
    const exercise = activeSession.exercises[exIdx];
    const currentSet = exercise.sets[setIdx];

    const normalizedValue = (() => {
      if (typeof value === 'number') {
        if (Number.isNaN(value)) return 0;
        if (value < 0) return 0;
        if (field === 'rpe' || field === 'rir') return Math.min(10, value);
      }
      return value;
    })();

    updateSet(exIdx, setIdx, field, normalizedValue);

    try {
      await persistSet(exercise, { ...currentSet, [field]: normalizedValue } as WorkoutSet, exIdx);
    } catch (error) {
      console.error('Failed to save set', error);
      setErrorMessage('Unable to save this set. Please retry.');
    }
  };

  const handleAddSet = async (exIdx: number) => {
    if (!activeSession) return;
    const newSet = addSet(exIdx);
    if (!newSet) return;
    const exercise = activeSession.exercises[exIdx];
    try {
      await persistSet(
        exercise,
        {
          ...newSet,
          performedAt: new Date().toISOString()
        },
        exIdx
      );
    } catch (error) {
      console.error('Failed to add set', error);
      setErrorMessage('Unable to add set. Please try again.');
    }
  };

  const handleDeleteSet = async (exIdx: number, setIdx: number) => {
    if (!activeSession) return;
    const set = activeSession.exercises[exIdx].sets[setIdx];
    removeSet(exIdx, setIdx);
    if (set.id && !set.id.startsWith('temp-')) {
      const { error } = await supabase.from('sets').delete().eq('id', set.id);
      if (error) {
        console.error('Failed to delete set', error);
        setErrorMessage('Unable to delete set. Please refresh and try again.');
      }
    }
  };

  const handleFinishWorkout = async () => {
    if (!activeSession) return;
    if (!confirm('Are you sure you want to finish this workout?')) return;
    setIsSaving(true);
    try {
      const sessionUpdate = {
        ended_at: new Date().toISOString(),
        status: 'completed',
        ...(activeSession.impact ? { impact: activeSession.impact } : {})
      };
      const { error } = await supabase
        .from('sessions')
        .update(sessionUpdate)
        .eq('id', activeSession.id);

      if (error) throw error;
      endSession();
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to finish workout:', error);
      setErrorMessage('Failed to finish workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const heading = useMemo(() => {
    if (!activeSession) return 'Session Active';
    return activeSession.name;
  }, [activeSession]);

  if (isLoading) {
    return <div className="surface-card-muted p-6 text-center text-muted">Loading active session...</div>;
  }

  if (!activeSession) return null;

  return (
    <div className="space-y-8 pb-24">
      <div className="sticky top-0 z-10 surface-elevated p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-strong">{heading}</h2>
            <div className="flex items-center gap-1 text-sm text-muted">
              <Clock size={14} />
              <span>Started at {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <Button onClick={handleFinishWorkout} disabled={isSaving} className="h-10 px-4">
            {isSaving ? 'Saving...' : (
              <>
                <Save size={18} /> Finish
              </>
            )}
          </Button>
        </div>
        {errorMessage && (
          <div className="mt-3 alert-error px-3 py-2 text-xs">{errorMessage}</div>
        )}
      </div>

      <div className="space-y-6">
        {activeSession.exercises.map((exercise: SessionExercise, exIdx: number) => (
          <div key={`${exercise.name}-${exIdx}`} className="surface-card-muted p-4 md:p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-strong">{exercise.name}</h3>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="badge-accent">
                    {exercise.primaryMuscle}
                  </span>
                  {exercise.secondaryMuscles?.map((m: string) => (
                    <span key={m} className="badge-neutral">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {exercise.sets.map((set: WorkoutSet, setIdx: number) => (
                <SetLogger
                  key={set.id}
                  set={set}
                  onUpdate={(field, val) => handleSetUpdate(exIdx, setIdx, field, val)}
                  onDelete={() => handleDeleteSet(exIdx, setIdx)}
                  onToggleComplete={() => handleSetUpdate(exIdx, setIdx, 'completed', !set.completed)}
                />
              ))}
            </div>

            <button
              onClick={() => handleAddSet(exIdx)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border-strong)] py-2 text-sm font-medium text-muted transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)]"
            >
              <Plus size={18} /> Add Set
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
