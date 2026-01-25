'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { equipmentPresets } from '@/lib/equipment';
import { normalizePreferences } from '@/lib/preferences';
import { convertWeight, roundWeight } from '@/lib/units';
import { fetchExerciseHistory, type ExerciseHistoryPoint } from '@/lib/session-history';
import { EXERCISE_LIBRARY } from '@/lib/generator';
import { enhanceExerciseData, toMuscleLabel, getMetricProfile } from '@/lib/muscle-utils';
import type { 
  WeightUnit, 
  WorkoutSession, 
  WorkoutSet, 
  EquipmentInventory, 
  Exercise, 
  SessionExercise 
} from '@/types/domain';

type SessionPayload = {
  id: string;
  user_id: string | null;
  name: string;
  template_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  body_weight_lb?: number | null;
  session_notes?: string | null;
  session_exercises: Array<any>;
};

type GeneratedExerciseTarget = {
  name?: string;
  sets?: number;
  reps?: string | number;
  rpe?: number;
  restSeconds?: number;
};

export function useActiveSessionManager(sessionId?: string | null, equipmentInventory?: EquipmentInventory | null) {
  const { 
    activeSession, 
    addSet, 
    removeSet, 
    updateSet, 
    startSession, 
    replaceSessionExercise, 
    removeSessionExercise, 
    addSessionExercise 
  } = useWorkoutStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null);
  const [preferredUnit, setPreferredUnit] = useState<WeightUnit>('lb');
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryPoint[]>([]);
  const [exerciseTargets, setExerciseTargets] = useState<Record<string, GeneratedExerciseTarget>>({});
  const [restTimer, setRestTimer] = useState<{ remaining: number; total: number; label: string } | null>(null);
  const [sessionBodyWeight, setSessionBodyWeight] = useState<string>('');
  
  const restIntervalRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  const exerciseLibrary = useMemo(() => EXERCISE_LIBRARY.map((exercise) => enhanceExerciseData(exercise)), []);
  const exerciseLibraryByName = useMemo(
    () => new Map(exerciseLibrary.map((exercise) => [exercise.name.toLowerCase(), exercise])),
    [exerciseLibrary]
  );

  const resolvedInventory = useMemo(
    () => equipmentInventory ?? equipmentPresets.full_gym,
    [equipmentInventory]
  );

  const mapSession = useCallback((payload: SessionPayload): WorkoutSession => {
    if (payload.body_weight_lb) {
      const displayWeight = preferredUnit === 'kg' 
        ? roundWeight(convertWeight(payload.body_weight_lb, 'lb', 'kg')) 
        : payload.body_weight_lb;
      setSessionBodyWeight(String(displayWeight));
    }
    return {
      id: payload.id,
      userId: payload.user_id ?? '',
      templateId: payload.template_id ?? undefined,
      name: payload.name,
      startedAt: payload.started_at,
      endedAt: payload.ended_at ?? undefined,
      status: (payload.status as WorkoutSession['status']) ?? 'in_progress',
      sessionNotes: payload.session_notes ?? undefined,
      exercises: payload.session_exercises
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((exercise, idx) => ({
          id: exercise.id,
          sessionId: payload.id,
          name: exercise.exercise_name,
          primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
          secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle: any) => toMuscleLabel(muscle)),
          metricProfile: exercise.metric_profile ?? undefined,
          orderIndex: exercise.order_index ?? idx,
          sets: (exercise.sets ?? [])
            .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
            .map((set: any, setIdx: number) => ({
              id: set.id,
              setNumber: set.set_number ?? setIdx + 1,
              reps: set.reps ?? '',
              weight: set.weight ?? '',
              rpe: set.rpe ?? '',
              rir: set.rir ?? '',
              performedAt: set.performed_at ?? undefined,
              completed: set.completed ?? false,
              weightUnit: set.weight_unit === 'kg' ? 'kg' : 'lb',
              durationSeconds: set.duration_seconds ?? undefined,
              distance: set.distance ?? undefined,
              distanceUnit: set.distance_unit ?? undefined,
              extras: set.extras ?? undefined,
              extra_metrics: set.extra_metrics ?? undefined
            }))
        }))
    };
  }, [preferredUnit]);

  useEffect(() => {
    if (activeSession || !sessionId) return;
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, user_id, name, template_id, started_at, ended_at, status, body_weight_lb, session_notes, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, metric_profile, order_index, sets(id, set_number, reps, weight, rpe, rir, completed, performed_at, weight_unit, duration_seconds, distance, distance_unit, extras, extra_metrics))')
        .eq('id', sessionId)
        .single();

      if (error) {
        setErrorMessage('Unable to load the active session.');
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
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('weight_lb, preferences')
        .eq('id', activeSession.userId)
        .maybeSingle();
      setProfileWeightLb(data?.weight_lb ?? null);
      const normalized = normalizePreferences(data?.preferences);
      setPreferredUnit(normalized.settings?.units ?? 'lb');
    };
    loadProfile();
  }, [activeSession?.userId, supabase]);

  useEffect(() => {
    if (!activeSession?.userId) return;
    const loadHistory = async () => {
      const history = await fetchExerciseHistory(supabase, activeSession.userId);
      setExerciseHistory(history);
    };
    loadHistory();
  }, [activeSession?.userId, supabase]);

  const clearRestTimer = useCallback(() => {
    if (restIntervalRef.current) {
      window.clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setRestTimer(null);
  }, []);

  const startRestTimer = useCallback((seconds: number, label: string) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    clearRestTimer();
    setRestTimer({ remaining: seconds, total: seconds, label });
    restIntervalRef.current = window.setInterval(() => {
      setRestTimer((prev) => {
        if (!prev) return prev;
        if (prev.remaining <= 1) {
          clearRestTimer();
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }, [clearRestTimer]);

  const persistSet = useCallback(async (exercise: SessionExercise, set: WorkoutSet, exerciseIndex: number) => {
    if (!exercise.id) return;
    const payload = {
      session_exercise_id: exercise.id,
      set_number: set.setNumber,
      reps: set.reps === '' ? null : Number(set.reps),
      weight: set.weight === '' ? null : Number(set.weight),
      rpe: set.rpe === '' ? null : Number(set.rpe),
      rir: set.rir === '' ? null : Number(set.rir),
      completed: set.completed,
      performed_at: set.performedAt ?? new Date().toISOString(),
      weight_unit: set.weightUnit ?? 'lb',
      duration_seconds: set.durationSeconds ?? null,
      distance: set.distance ?? null,
      distance_unit: set.distanceUnit ?? null,
      extras: set.extras ?? {},
      extra_metrics: set.extraMetrics ?? {}
    };

    if (set.id && !set.id.startsWith('temp-')) {
      await supabase.from('sets').update(payload).eq('id', set.id);
    } else {
      const { data } = await supabase.from('sets').insert(payload).select('id, performed_at').single();
      if (data?.id) {
        updateSet(exerciseIndex, set.setNumber - 1, 'id', data.id);
        updateSet(exerciseIndex, set.setNumber - 1, 'performedAt', data.performed_at);
      }
    }
  }, [supabase, updateSet]);

  const handleSetUpdate = async (exIdx: number, setIdx: number, field: keyof WorkoutSet, value: any) => {
    if (!activeSession) return;
    const exercise = activeSession.exercises[exIdx];
    const currentSet = exercise.sets[setIdx];
    
    updateSet(exIdx, setIdx, field, value);

    if (field === 'completed' && value === true) {
      const restSeconds = 90; // Default or from targets
      startRestTimer(restSeconds, exercise.name);
    }

    const nextSet = { ...currentSet, [field]: value };
    await persistSet(exercise, nextSet, exIdx);
  };

  return {
    activeSession,
    errorMessage,
    setErrorMessage,
    sessionBodyWeight,
    setSessionBodyWeight,
    preferredUnit,
    profileWeightLb,
    exerciseHistory,
    exerciseTargets,
    restTimer,
    clearRestTimer,
    handleSetUpdate,
    addSet,
    removeSet,
    updateSet,
    replaceSessionExercise,
    removeSessionExercise,
    addSessionExercise,
    resolvedInventory,
    exerciseLibrary,
    exerciseLibraryByName,
    supabase
  };
}
