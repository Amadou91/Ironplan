'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { SetLogger } from './SetLogger';
import { Plus, Clock } from 'lucide-react';
import type { EquipmentInventory, SessionExercise, WorkoutImpact, WorkoutSession, WorkoutSet } from '@/types/domain';
import { enhanceExerciseData, toMuscleLabel } from '@/lib/muscle-utils';
import { EXERCISE_LIBRARY } from '@/lib/generator';
import { buildWeightOptions, equipmentPresets } from '@/lib/equipment';

type ActiveSessionProps = {
  sessionId?: string | null;
  equipmentInventory?: EquipmentInventory | null;
};

type SessionPayload = {
  id: string;
  user_id: string | null;
  name: string;
  template_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  impact?: WorkoutImpact | null;
  timezone?: string | null;
  session_notes?: string | null;
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
      completed: boolean | null;
      performed_at: string | null;
      weight_unit: string | null;
      failure: boolean | null;
    }>;
  }>;
};

type GeneratedExerciseTarget = {
  name?: string;
  restSeconds?: number;
};

type SessionNotes = {
  readiness?: 'low' | 'steady' | 'high';
  minutesAvailable?: number;
  source?: string;
};

const parseSessionNotes = (notes?: string | null): SessionNotes | null => {
  if (!notes) return null;
  try {
    return JSON.parse(notes) as SessionNotes;
  } catch {
    return null;
  }
};

const formatRestTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export default function ActiveSession({ sessionId, equipmentInventory }: ActiveSessionProps) {
  const { activeSession, addSet, removeSet, updateSet, startSession } = useWorkoutStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null);
  const [restTargets, setRestTargets] = useState<Record<string, number>>({});
  const [restTimer, setRestTimer] = useState<{ remaining: number; total: number; label: string } | null>(null);
  const restIntervalRef = useRef<number | null>(null);
  const supabase = createClient();
  const isLoading = Boolean(sessionId) && !activeSession && !errorMessage;

  const exerciseLibrary = useMemo(() => EXERCISE_LIBRARY.map((exercise) => enhanceExerciseData(exercise)), []);
  const exerciseLibraryByName = useMemo(
    () => new Map(exerciseLibrary.map((exercise) => [exercise.name.toLowerCase(), exercise])),
    [exerciseLibrary]
  );
  const exerciseNameKey = useMemo(
    () => activeSession?.exercises.map((exercise) => exercise.name).join('|') ?? '',
    [activeSession?.exercises]
  );
  const resolvedInventory = useMemo(
    () => equipmentInventory ?? equipmentPresets.full_gym,
    [equipmentInventory]
  );


  const mapSession = useCallback((payload: SessionPayload): WorkoutSession => {
    return {
      id: payload.id,
      userId: payload.user_id ?? '',
      templateId: payload.template_id ?? undefined,
      name: payload.name,
      startedAt: payload.started_at,
      endedAt: payload.ended_at ?? undefined,
      status: (payload.status as WorkoutSession['status']) ?? 'in_progress',
      impact: payload.impact ?? undefined,
      timezone: payload.timezone ?? undefined,
      sessionNotes: payload.session_notes ?? undefined,
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
              performedAt: set.performed_at ?? undefined,
              completed: set.completed ?? false,
              weightUnit: set.weight_unit ?? 'lb',
              failure: set.failure ?? false
            }))
        }))
    };
  }, []);

  useEffect(() => {
    if (activeSession || !sessionId) return;
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(
          'id, user_id, name, template_id, started_at, ended_at, status, impact, timezone, session_notes, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, failure))'
        )
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Failed to load session', error);
        setErrorMessage('Unable to load the active session. Please try again.');
      } else if (data) {
        if (data.status && data.status !== 'in_progress') {
          setErrorMessage('This session is no longer active.');
          return;
        }
        startSession(mapSession(data as SessionPayload));
      }
    };
    fetchSession();
  }, [activeSession, mapSession, sessionId, startSession, supabase]);

  useEffect(() => {
    if (!activeSession?.userId) return;
    const loadProfileWeight = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('weight_lb')
        .eq('id', activeSession.userId)
        .maybeSingle();
      if (error) {
        console.error('Failed to load profile weight', error);
        return;
      }
      setProfileWeightLb(typeof data?.weight_lb === 'number' ? data.weight_lb : null);
    };
    loadProfileWeight();
  }, [activeSession?.userId, supabase]);

  useEffect(() => {
    if (!activeSession?.id) return;
    let isMounted = true;

    const loadRestTargets = async () => {
      const exerciseNames = activeSession.exercises.map((exercise) => exercise.name);
      if (!exerciseNames.length) {
        if (isMounted) setRestTargets({});
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('generated_exercises')
        .eq('id', activeSession.id)
        .maybeSingle();
      if (sessionError) {
        console.error('Failed to load session targets', sessionError);
      }

      const generated = Array.isArray(sessionData?.generated_exercises)
        ? (sessionData?.generated_exercises as GeneratedExerciseTarget[])
        : [];
      const generatedByName = new Map(
        generated
          .filter((exercise) => exercise.name)
          .map((exercise) => [exercise.name?.toLowerCase() ?? '', exercise])
          .filter(([key]) => Boolean(key))
      );

      const nextTargets: Record<string, number> = {};
      activeSession.exercises.forEach((exercise) => {
        const key = exercise.name.toLowerCase();
        const generatedExercise = generatedByName.get(key);
        const libraryMatch = exerciseLibraryByName.get(key);
        const restSeconds =
          typeof generatedExercise?.restSeconds === 'number'
            ? generatedExercise.restSeconds
            : typeof libraryMatch?.restSeconds === 'number'
              ? libraryMatch.restSeconds
              : 90;
        nextTargets[key] = restSeconds;
      });

      if (isMounted) {
        setRestTargets(nextTargets);
      }
    };

    loadRestTargets();
    return () => {
      isMounted = false;
    };
  }, [activeSession?.id, exerciseNameKey, exerciseLibraryByName, supabase]);

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
        completed: set.completed,
        performed_at: set.performedAt ?? new Date().toISOString(),
        weight_unit: set.weightUnit ?? 'lb',
        failure: Boolean(set.failure)
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

  const handleSetUpdate = async (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => {
    if (!activeSession) return;
    const exercise = activeSession.exercises[exIdx];
    const currentSet = exercise.sets[setIdx];

    const normalizedValue = (() => {
      if (typeof value === 'number') {
        if (Number.isNaN(value)) return 0;
        if (value < 0) return 0;
        if (field === 'rpe' || field === 'rir' || field === 'painScore') return Math.min(10, value);
      }
      return value;
    })();

    updateSet(exIdx, setIdx, field, normalizedValue);

    if (field === 'completed' && normalizedValue === true) {
      startRestTimer(getRestSeconds(exercise), exercise.name);
    }

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

  const heading = useMemo(() => {
    if (!activeSession) return 'Session Active';
    return activeSession.name;
  }, [activeSession]);

  const sessionNotes = useMemo(() => parseSessionNotes(activeSession?.sessionNotes ?? null), [activeSession?.sessionNotes]);
  const readinessLabel = sessionNotes?.readiness
    ? `${sessionNotes.readiness.charAt(0).toUpperCase()}${sessionNotes.readiness.slice(1)}`
    : null;

  const progressSummary = useMemo(() => {
    if (!activeSession) return null;
    const totalExercises = activeSession.exercises.length;
    const totalSets = activeSession.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const completedSets = activeSession.exercises.reduce(
      (sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length,
      0
    );
    const completedExercises = activeSession.exercises.filter((exercise) =>
      exercise.sets.some((set) => set.completed)
    ).length;
    return {
      totalExercises,
      totalSets,
      completedSets,
      completedExercises
    };
  }, [activeSession]);

  const restProgress = restTimer ? Math.round((restTimer.remaining / restTimer.total) * 100) : 0;

  const clearRestTimer = useCallback(() => {
    if (restIntervalRef.current) {
      window.clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setRestTimer(null);
  }, []);

  const startRestTimer = useCallback(
    (seconds: number, label: string) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      if (restIntervalRef.current) {
        window.clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
      setRestTimer({ remaining: seconds, total: seconds, label });
      restIntervalRef.current = window.setInterval(() => {
        setRestTimer((prev) => {
          if (!prev) return prev;
          if (prev.remaining <= 1) {
            if (restIntervalRef.current) {
              window.clearInterval(restIntervalRef.current);
              restIntervalRef.current = null;
            }
            return null;
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (restIntervalRef.current) {
        window.clearInterval(restIntervalRef.current);
      }
    };
  }, []);

  const getWeightOptions = useCallback(
    (exercise: SessionExercise) => {
      const match = exerciseLibraryByName.get(exercise.name.toLowerCase());
      if (!match?.equipment?.length) return [];
      return buildWeightOptions(resolvedInventory, match.equipment, profileWeightLb);
    },
    [exerciseLibraryByName, profileWeightLb, resolvedInventory]
  );

  const getRestSeconds = (exercise: SessionExercise) => {
    const key = exercise.name.toLowerCase();
    const restFromTarget = restTargets[key];
    if (typeof restFromTarget === 'number') return restFromTarget;
    const libraryMatch = exerciseLibraryByName.get(key);
    return typeof libraryMatch?.restSeconds === 'number' ? libraryMatch.restSeconds : 90;
  };

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
            {(readinessLabel || sessionNotes?.minutesAvailable) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                {readinessLabel && <span className="badge-neutral">Readiness: {readinessLabel}</span>}
                {sessionNotes?.minutesAvailable && (
                  <span className="badge-neutral">{sessionNotes.minutesAvailable} min plan</span>
                )}
              </div>
            )}
            {progressSummary && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
                <span>
                  {progressSummary.completedSets}/{progressSummary.totalSets} sets
                </span>
                <span>•</span>
                <span>
                  {progressSummary.completedExercises}/{progressSummary.totalExercises} exercises
                </span>
              </div>
            )}
          </div>
        </div>
        {restTimer && (
          <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-muted">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-strong">Rest · {restTimer.label}</span>
              <button type="button" onClick={clearRestTimer} className="text-xs font-semibold text-accent">
                Skip
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold text-strong">{formatRestTime(restTimer.remaining)}</span>
              <span className="text-xs text-subtle">{restTimer.total}s</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-[var(--color-surface-muted)]">
              <div
                className="h-1 rounded-full bg-[var(--color-primary)]"
                style={{ width: `${restProgress}%` }}
              />
            </div>
          </div>
        )}
        {errorMessage && (
          <div className="mt-3 alert-error px-3 py-2 text-xs">{errorMessage}</div>
        )}
      </div>

      <div className="space-y-6">
        {activeSession.exercises.map((exercise: SessionExercise, exIdx: number) => (
          <div key={`${exercise.name}-${exIdx}`} className="surface-card-muted p-4 md:p-6">
            <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
              <div className="min-w-[220px] flex-1">
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
                  weightOptions={getWeightOptions(exercise)}
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
