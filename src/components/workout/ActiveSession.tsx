'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { SetLogger } from './SetLogger';
import { Plus, Clock, Shuffle, Trash2 } from 'lucide-react';
import type { EquipmentInventory, Exercise, SessionExercise, WorkoutImpact, WorkoutSession, WorkoutSet } from '@/types/domain';
import { enhanceExerciseData, toMuscleLabel, toMuscleSlug } from '@/lib/muscle-utils';
import { EXERCISE_LIBRARY } from '@/lib/generator';
import { getSwapSuggestions } from '@/lib/exercise-swap';
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
  session_exercises: Array<{
    id: string;
    exercise_name: string;
    primary_muscle: string | null;
    secondary_muscles: string[] | null;
    order_index: number | null;
    variation: Record<string, string | null> | null;
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
  sets?: number;
  reps?: string | number;
};

type SmartTarget = {
  sets: number | null;
  reps: string | null;
  note: string | null;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const parseRepRange = (reps?: string | number | null) => {
  if (typeof reps === 'number' && Number.isFinite(reps)) {
    return { min: reps, max: reps, avg: reps, label: String(reps) };
  }
  if (typeof reps !== 'string') return { min: null, max: null, avg: null, label: null };
  const matches = reps.match(/\d+/g)?.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite) ?? [];
  if (!matches.length) return { min: null, max: null, avg: null, label: reps };
  const min = Math.min(...matches);
  const max = Math.max(...matches);
  const avg = Math.round(matches.reduce((sum, value) => sum + value, 0) / matches.length);
  return { min, max, avg, label: reps };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function ActiveSession({ sessionId, equipmentInventory }: ActiveSessionProps) {
  const { activeSession, addSet, removeSet, updateSet, startSession, replaceSessionExercise, addSessionExercise, removeSessionExercise } = useWorkoutStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openSwapIndex, setOpenSwapIndex] = useState<number | null>(null);
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null);
  const [exerciseTargets, setExerciseTargets] = useState<Record<string, SmartTarget>>({});
  const [addingWorkout, setAddingWorkout] = useState(false);
  const [selectedWorkoutName, setSelectedWorkoutName] = useState('');
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

  const buildSwapExercise = useCallback(
    (exercise: SessionExercise): Exercise => {
      const match = exerciseLibraryByName.get(exercise.name.toLowerCase());
      if (match) return match;
      return enhanceExerciseData({
        name: exercise.name,
        focus: 'full_body',
        sets: Math.max(exercise.sets.length, 1),
        reps: '8-12',
        rpe: 7,
        equipment: [{ kind: 'bodyweight' }],
        durationMinutes: 8,
        restSeconds: 60,
        primaryMuscle: exercise.primaryMuscle,
        secondaryMuscles: exercise.secondaryMuscles
      });
    },
    [exerciseLibraryByName]
  );

  const swapSuggestions = useMemo(() => {
    if (!activeSession) return [];
    const sessionExercises = activeSession.exercises.map(buildSwapExercise);
    return activeSession.exercises.map((exercise, index) =>
      getSwapSuggestions({
        current: sessionExercises[index],
        sessionExercises,
        inventory: resolvedInventory,
        library: exerciseLibrary,
        limit: 4
      })
    );
  }, [activeSession, buildSwapExercise, exerciseLibrary, resolvedInventory]);

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
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, idx) => ({
          id: exercise.id,
          sessionId: payload.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
          secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
          orderIndex: exercise.order_index ?? idx,
          variation: exercise.variation ?? {},
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
          'id, user_id, name, template_id, started_at, ended_at, status, impact, timezone, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, variation, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, failure))'
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

    const loadSmartTargets = async () => {
      const exerciseNames = activeSession.exercises.map((exercise) => exercise.name);
      if (!exerciseNames.length) {
        if (isMounted) setExerciseTargets({});
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

      const { data: historyRows, error: historyError } = await supabase
        .from('sets')
        .select('reps, completed, session_exercises!inner(exercise_name, session_id, sessions!inner(user_id))')
        .eq('session_exercises.sessions.user_id', activeSession.userId)
        .neq('session_exercises.session_id', activeSession.id)
        .in('session_exercises.exercise_name', exerciseNames)
        .order('performed_at', { ascending: false })
        .limit(200);

      if (historyError) {
        console.error('Failed to load recent set history', historyError);
      }

      const historyMap = new Map<string, { reps: number[]; sessionCounts: Map<string, number> }>();
      (historyRows ?? []).forEach((row) => {
        const exerciseName = row.session_exercises?.exercise_name;
        const sessionKey = row.session_exercises?.session_id;
        if (!exerciseName || !sessionKey) return;
        if (typeof row.reps !== 'number' || Number.isNaN(row.reps)) return;
        const key = exerciseName.toLowerCase();
        const entry = historyMap.get(key) ?? { reps: [], sessionCounts: new Map<string, number>() };
        entry.reps.push(row.reps);
        entry.sessionCounts.set(sessionKey, (entry.sessionCounts.get(sessionKey) ?? 0) + 1);
        historyMap.set(key, entry);
      });

      const nextTargets: Record<string, SmartTarget> = {};
      activeSession.exercises.forEach((exercise) => {
        const key = exercise.name.toLowerCase();
        const generatedExercise = generatedByName.get(key);
        const history = historyMap.get(key);
        const baseSets = typeof generatedExercise?.sets === 'number' ? generatedExercise.sets : null;
        const baseReps = generatedExercise?.reps ?? null;
        const baseRange = parseRepRange(baseReps);
        const historyAvgReps = history ? average(history.reps) : null;
        const historyAvgSets = history ? average(Array.from(history.sessionCounts.values())) : null;

        let targetSets = baseSets ?? (historyAvgSets ? Math.round(historyAvgSets) : null);
        if (baseSets && historyAvgSets) {
          targetSets = Math.round(baseSets * 0.6 + historyAvgSets * 0.4);
        }
        if (typeof targetSets === 'number') {
          targetSets = clamp(targetSets, 1, 8);
        }

        const libraryMatch = exerciseLibraryByName.get(key);
        const isBodyweight = Boolean(libraryMatch?.equipment?.some((item) => item.kind === 'bodyweight'));
        const bodyweightAdjust = isBodyweight && typeof profileWeightLb === 'number'
          ? profileWeightLb > 220
            ? -1
            : profileWeightLb < 140
              ? 1
              : 0
          : 0;

        let repsLabel: string | null = baseRange.label ?? null;
        if (historyAvgReps || baseRange.avg) {
          const tuned = Math.round(((historyAvgReps ?? baseRange.avg ?? 0) + (baseRange.avg ?? historyAvgReps ?? 0)) / 2);
          const adjusted = tuned ? Math.max(1, tuned + bodyweightAdjust) : tuned;
          if (baseRange.min !== null && baseRange.max !== null && baseRange.min !== baseRange.max) {
            repsLabel = `${baseRange.min}-${baseRange.max}${adjusted ? ` (aim ${adjusted})` : ''}`;
          } else if (adjusted) {
            repsLabel = String(adjusted);
          }
        }

        if (!targetSets && !repsLabel) return;

        const historySessions = history?.sessionCounts.size ?? 0;
        const noteParts = [];
        if (historySessions > 0) {
          noteParts.push(`last ${historySessions} session${historySessions === 1 ? '' : 's'}`);
        }
        if (bodyweightAdjust !== 0) {
          noteParts.push('profile weight');
        }
        const note = noteParts.length ? `Tuned from ${noteParts.join(' + ')}` : 'Based on your template';

        nextTargets[key] = {
          sets: targetSets ?? null,
          reps: repsLabel ?? null,
          note
        };
      });

      if (isMounted) {
        setExerciseTargets(nextTargets);
      }
    };

    loadSmartTargets();
    return () => {
      isMounted = false;
    };
  }, [activeSession?.id, activeSession?.userId, exerciseNameKey, exerciseLibraryByName, profileWeightLb, supabase]);

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

  const getWeightOptions = useCallback(
    (exercise: SessionExercise) => {
      const match = exerciseLibraryByName.get(exercise.name.toLowerCase());
      if (!match?.equipment?.length) return [];
      return buildWeightOptions(resolvedInventory, match.equipment, profileWeightLb);
    },
    [exerciseLibraryByName, profileWeightLb, resolvedInventory]
  );

  const handleVariationChange = (exIdx: number, field: 'grip' | 'stance' | 'equipment', value: string) => {
    if (!activeSession) return;
    const exercise = activeSession.exercises[exIdx];
    const nextVariation = { ...(exercise.variation ?? {}), [field]: value };
    replaceSessionExercise(exIdx, { variation: nextVariation });
  };

  const persistVariation = async (exerciseId: string, variation?: SessionExercise['variation']) => {
    if (!exerciseId) return;
    const payload = {
      variation: variation ?? {}
    };
    const { error } = await supabase.from('session_exercises').update(payload).eq('id', exerciseId);
    if (error) throw error;
  };

  const handleVariationBlur = async (exerciseId: string, variation?: SessionExercise['variation']) => {
    try {
      await persistVariation(exerciseId, variation);
    } catch (error) {
      console.error('Failed to save exercise variation', error);
      setErrorMessage('Unable to save exercise variations. Please retry.');
    }
  };

  const handleSwapExercise = async (exIdx: number, candidate: Exercise) => {
    if (!activeSession) return;
    const exercise = activeSession.exercises[exIdx];
    if (!exercise?.id) return;
    const enriched = enhanceExerciseData(candidate);
    const primaryMuscle = enriched.primaryMuscle ?? 'Full Body';
    const secondaryMuscles = enriched.secondaryMuscles ?? [];
    const secondarySlugs = secondaryMuscles
      .map((muscle) => toMuscleSlug(muscle, null))
      .filter((muscle): muscle is string => Boolean(muscle));

    try {
      const payload = {
        exercise_name: enriched.name,
        primary_muscle: toMuscleSlug(primaryMuscle, 'full_body'),
        secondary_muscles: secondarySlugs.length ? secondarySlugs : null,
        variation: {}
      };
      const { error } = await supabase.from('session_exercises').update(payload).eq('id', exercise.id);
      if (error) throw error;
      replaceSessionExercise(exIdx, {
        name: enriched.name,
        primaryMuscle,
        secondaryMuscles,
        variation: {}
      });
      setOpenSwapIndex(null);
    } catch (error) {
      console.error('Failed to swap exercise', error);
      setErrorMessage('Unable to swap this exercise. Please try again.');
    }
  };

  const handleAddWorkout = async () => {
    if (!activeSession) return;
    const trimmed = selectedWorkoutName.trim();
    if (!trimmed) return;
    setAddingWorkout(true);
    setErrorMessage(null);

    try {
      const match = exerciseLibraryByName.get(trimmed.toLowerCase());
      const resolvedName = match?.name ?? trimmed;
      const primaryMuscle = match?.primaryMuscle ?? 'Full Body';
      const secondaryMuscles = match?.secondaryMuscles ?? [];
      const primarySlug = toMuscleSlug(primaryMuscle, 'full_body');
      const secondarySlugs = secondaryMuscles
        .map((muscle) => toMuscleSlug(muscle, null))
        .filter((muscle): muscle is string => Boolean(muscle));
      const orderIndex = activeSession.exercises.reduce((max, exercise) => Math.max(max, exercise.orderIndex ?? 0), -1) + 1;

      const { data, error } = await supabase
        .from('session_exercises')
        .insert({
          session_id: activeSession.id,
          exercise_name: resolvedName,
          primary_muscle: primarySlug,
          secondary_muscles: secondarySlugs,
          order_index: orderIndex,
          variation: {}
        })
        .select('id')
        .single();

      if (error) throw error;

      addSessionExercise({
        id: data?.id ?? `temp-${crypto.randomUUID()}`,
        sessionId: activeSession.id,
        name: resolvedName,
        primaryMuscle,
        secondaryMuscles,
        orderIndex,
        variation: {},
        sets: []
      });
      setSelectedWorkoutName('');
    } catch (error) {
      console.error('Failed to add workout', error);
      setErrorMessage('Unable to add workout. Please try again.');
    } finally {
      setAddingWorkout(false);
    }
  };

  const handleDeleteWorkout = async (exerciseId: string, exerciseIndex: number) => {
    if (!activeSession) return;
    if (!confirm('Delete this workout and its sets?')) return;
    try {
      const { error } = await supabase.from('session_exercises').delete().eq('id', exerciseId);
      if (error) throw error;
      removeSessionExercise(exerciseIndex);
      setOpenSwapIndex((prev) => {
        if (prev === null) return prev;
        if (prev === exerciseIndex) return null;
        if (prev > exerciseIndex) return prev - 1;
        return prev;
      });
    } catch (error) {
      console.error('Failed to delete workout', error);
      setErrorMessage('Unable to delete workout. Please try again.');
    }
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
          </div>
        </div>
        {errorMessage && (
          <div className="mt-3 alert-error px-3 py-2 text-xs">{errorMessage}</div>
        )}
      </div>

      <div className="space-y-6">
        {activeSession.exercises.map((exercise: SessionExercise, exIdx: number) => {
          const target = exerciseTargets[exercise.name.toLowerCase()];
          return (
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
                  {target && (
                    <div className="mt-3 text-xs text-muted">
                      <span className="text-subtle">Smart target:</span>{' '}
                      {target.sets && target.reps
                        ? `${target.sets} sets × ${target.reps} reps`
                        : target.sets
                          ? `${target.sets} sets`
                          : target.reps
                            ? `${target.reps} reps`
                            : null}
                      {target.note ? (
                        <span className="ml-2 text-[10px] text-subtle">{target.note}</span>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase tracking-wider text-subtle">Grip</label>
                      <input
                        type="text"
                        value={exercise.variation?.grip ?? ''}
                        onChange={(event) => handleVariationChange(exIdx, 'grip', event.target.value)}
                        onBlur={() => handleVariationBlur(exercise.id, exercise.variation)}
                        className="input-base mt-1"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase tracking-wider text-subtle">Stance</label>
                      <input
                        type="text"
                        value={exercise.variation?.stance ?? ''}
                        onChange={(event) => handleVariationChange(exIdx, 'stance', event.target.value)}
                        onBlur={() => handleVariationBlur(exercise.id, exercise.variation)}
                        className="input-base mt-1"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] uppercase tracking-wider text-subtle">Equipment</label>
                      <input
                        type="text"
                        value={exercise.variation?.equipment ?? ''}
                        onChange={(event) => handleVariationChange(exIdx, 'equipment', event.target.value)}
                        onBlur={() => handleVariationBlur(exercise.id, exercise.variation)}
                        className="input-base mt-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setOpenSwapIndex((prev) => (prev === exIdx ? null : exIdx))}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle transition-colors hover:text-accent"
                >
                  <Shuffle size={12} />
                  Swap
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteWorkout(exercise.id, exIdx)}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-danger-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
                {openSwapIndex === exIdx && (
                  <div className="mt-3 w-full sm:w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-muted shadow-sm">
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">Swap options</div>
                    {swapSuggestions[exIdx]?.suggestions?.length ? (
                      <div className="space-y-2">
                        {swapSuggestions[exIdx].suggestions.map(({ exercise: candidate }) => (
                          <button
                            key={candidate.name}
                            type="button"
                            onClick={() => handleSwapExercise(exIdx, candidate)}
                            className="flex w-full flex-col rounded-lg border border-[var(--color-border)] px-3 py-2 text-left transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                          >
                            <span className="text-sm font-semibold text-strong">{candidate.name}</span>
                            <span className="text-[10px] text-subtle">
                              {candidate.primaryMuscle ?? 'Full Body'}
                              {candidate.secondaryMuscles?.length ? ` · ${candidate.secondaryMuscles.join(', ')}` : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-subtle">No similar swaps available.</p>
                    )}
                    {swapSuggestions[exIdx]?.usedFallback ? (
                      <p className="mt-2 text-[10px] text-subtle">Equipment match is limited with the current setup.</p>
                    ) : null}
                  </div>
                )}
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
        );
      })}

        <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-[var(--color-border-strong)] p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-subtle">Add workout</label>
            <select
              value={selectedWorkoutName}
              onChange={(event) => setSelectedWorkoutName(event.target.value)}
              className="input-base mt-2"
            >
              <option value="">Choose exercise</option>
              {exerciseLibrary.map((exercise) => (
                <option key={exercise.name} value={exercise.name}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddWorkout}
            disabled={addingWorkout || !selectedWorkoutName}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-4 py-3 text-sm font-medium text-muted transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Plus size={18} /> {addingWorkout ? 'Adding workout...' : 'Add Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}
