'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { equipmentPresets } from '@/lib/equipment';
import { normalizePreferences } from '@/lib/preferences';
import { convertWeight, roundWeight } from '@/lib/units';
import { useExerciseCatalog } from '@/hooks/useExerciseCatalog';
import { useSetPersistence } from '@/hooks/useSetPersistence';
import { enhanceExerciseData, toMuscleLabel } from '@/lib/muscle-utils';
import { fetchExerciseHistory, type ExerciseHistoryPoint } from '@/lib/session-history';
import { sessionQueryResultSchema, safeParseSingle } from '@/lib/validation/schemas';
import { adaptPrescription } from '@/lib/generator/adaptation';
import type { 
  WeightUnit, 
  WorkoutSession, 
  WorkoutSet, 
  EquipmentInventory,
  MetricProfile,
  LoadType,
  Goal,
  Intensity,
  PlanInput,
  SessionExercise
} from '@/types/domain';

type SessionPayload = {
  id: string;
  user_id: string | null;
  name: string;
  template_id: string | null;
  session_focus?: string | null;
  session_goal?: string | null;
  session_intensity?: string | null;
  started_at: string;
  ended_at: string | null;
  status: string | null;
  body_weight_lb?: number | null;
  session_notes?: string | null;
  session_exercises: Array<{
    id: string;
    exercise_name: string;
    primary_muscle: string | null;
    secondary_muscles: string[] | null;
    metric_profile: string | null;
    order_index: number | null;
    sets: Array<{
      id: string;
      set_number: number | null;
      reps: number | null;
      weight: number | null;
      implement_count: number | null;
      load_type: string | null;
      rpe: number | null;
      rir: number | null;
      completed: boolean | null;
      performed_at: string | null;
      weight_unit: string | null;
      duration_seconds: number | null;
      distance: number | null;
      distance_unit: string | null;
      rest_seconds_actual: number | null;
      extras: Record<string, unknown> | null;
      extra_metrics: Record<string, unknown> | null;
    }>;
  }>;
};

type GeneratedExerciseTarget = {
  name?: string;
  sets?: number;
  reps?: string | number;
  rpe?: number;
  restSeconds?: number;
};

const EXPERIENCE_LEVELS: PlanInput['experienceLevel'][] = ['beginner', 'intermediate', 'advanced'];

const EXPERIENCE_DELTA_BY_INTENSITY: Record<Intensity, -1 | 0 | 1> = {
  low: -1,
  moderate: 0,
  high: 1
};

const shiftExperienceLevel = (base: PlanInput['experienceLevel'], delta: -1 | 0 | 1) => {
  const index = EXPERIENCE_LEVELS.indexOf(base);
  if (index === -1) return base;
  const nextIndex = Math.max(0, Math.min(EXPERIENCE_LEVELS.length - 1, index + delta));
  return EXPERIENCE_LEVELS[nextIndex];
};

/**
 * Manages active workout session state, persistence, and synchronization.
 * Uses extracted hooks for separation of concerns.
 */
export function useActiveSessionManager(sessionId?: string | null, equipmentInventory?: EquipmentInventory | null) {
  const { 
    activeSession, 
    addSet, 
    removeSet, 
    updateSet, 
    startSession, 
    updateSession,
    replaceSessionExercise, 
    removeSessionExercise, 
    addSessionExercise,
    reorderExercises
  } = useWorkoutStore();

  // State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profileWeightLb, setProfileWeightLb] = useState<number | null>(null);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryPoint[]>([]);
  const [sessionBodyWeight, setSessionBodyWeight] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [templateExperienceLevel, setTemplateExperienceLevel] = useState<PlanInput['experienceLevel'] | null>(null);
  
  // Hooks
  const supabase = createClient();
  const { catalog } = useExerciseCatalog();
  const { persistSet, persistSessionBodyWeight, isPersisting } = useSetPersistence();
  
  const preferredUnit = activeSession?.weightUnit ?? 'lb';

  // Exercise library with memoization
  const exerciseLibrary = useMemo(
    () => catalog.map((exercise) => enhanceExerciseData(exercise)), 
    [catalog]
  );
  
  const exerciseLibraryByName = useMemo(
    () => new Map(exerciseLibrary.map((exercise) => [exercise.name.toLowerCase(), exercise])),
    [exerciseLibrary]
  );

  const targetExperienceLevel = useMemo(() => {
    const baseExperience = templateExperienceLevel ?? 'intermediate';
    const intensityKey = (activeSession?.sessionIntensity || 'moderate') as Intensity;
    const delta = EXPERIENCE_DELTA_BY_INTENSITY[intensityKey] ?? 0;
    return shiftExperienceLevel(baseExperience, delta);
  }, [activeSession?.sessionIntensity, templateExperienceLevel]);

  // Compute exercise targets dynamically based on session goal/intensity and catalog metadata
  const exerciseTargets = useMemo(() => {
    if (!activeSession || !exerciseLibraryByName.size) return {} as Record<string, GeneratedExerciseTarget>;

    const targets: Record<string, GeneratedExerciseTarget> = {};
    const goal = (activeSession.sessionGoal || 'strength') as Goal;
    const intensity = (activeSession.sessionIntensity || 'moderate') as Intensity;

    activeSession.exercises.forEach(exercise => {
      const match = exerciseLibraryByName.get(exercise.name.toLowerCase());
      if (match) {
        const prescription = adaptPrescription(match, goal, intensity, targetExperienceLevel, {});
        targets[exercise.name.toLowerCase()] = {
          name: exercise.name,
          sets: prescription.sets,
          reps: prescription.reps,
          rpe: prescription.rpe,
          restSeconds: prescription.restSeconds
        };
      }
    });

    return targets;
  }, [activeSession, exerciseLibraryByName, targetExperienceLevel]);

  const resolvedInventory = useMemo(
    () => equipmentInventory ?? equipmentPresets.custom,
    [equipmentInventory]
  );

  // Map database payload to domain model
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
      sessionFocus: (payload.session_focus as WorkoutSession['sessionFocus']) ?? null,
      sessionGoal: (payload.session_goal as WorkoutSession['sessionGoal']) ?? null,
      sessionIntensity: (payload.session_intensity as WorkoutSession['sessionIntensity']) ?? null,
      startedAt: payload.started_at,
      endedAt: payload.ended_at ?? undefined,
      status: (payload.status as WorkoutSession['status']) ?? 'in_progress',
      sessionNotes: payload.session_notes ?? undefined,
      bodyWeightLb: payload.body_weight_lb ?? null,
      exercises: (() => {
        // First, map all raw exercises
        const rawExercises = payload.session_exercises
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((exercise, idx) => ({
            id: exercise.id,
            sessionId: payload.id,
            name: exercise.exercise_name,
            primaryMuscle: exercise.primary_muscle ? toMuscleLabel(exercise.primary_muscle) : 'Full Body',
            secondaryMuscles: (exercise.secondary_muscles ?? []).map((muscle) => toMuscleLabel(muscle)),
            metricProfile: (exercise.metric_profile as MetricProfile) ?? undefined,
            orderIndex: exercise.order_index ?? idx,
            sets: (exercise.sets ?? [])
              .sort((a, b) => (a.set_number ?? 0) - (b.set_number ?? 0))
              .map((set, setIdx) => ({
                id: set.id,
                setNumber: set.set_number ?? setIdx + 1,
                reps: set.reps ?? '',
                weight: set.weight ?? '',
                implementCount: set.implement_count ?? '',
                loadType: (set.load_type as LoadType | null) ?? '',
                rpe: set.rpe ?? '',
                rir: set.rir ?? '',
                performedAt: set.performed_at ?? undefined,
                completed: set.completed ?? false,
                weightUnit: (set.weight_unit as WeightUnit) ?? 'lb',
                durationSeconds: set.duration_seconds ?? undefined,
                distance: set.distance ?? undefined,
                distanceUnit: set.distance_unit ?? undefined,
                restSecondsActual: set.rest_seconds_actual ?? undefined,
                extras: set.extras as Record<string, string | null> ?? undefined,
                extraMetrics: set.extra_metrics ?? undefined
              })) as WorkoutSet[]
          })) as SessionExercise[];

        // Deduplicate exercises by name
        const exerciseMap = new Map<string, typeof rawExercises[0]>();
        
        for (const ex of rawExercises) {
          const key = ex.name.toLowerCase();
          if (exerciseMap.has(key)) {
            // Merge sets
            const existing = exerciseMap.get(key)!;
            const combinedSets = [...existing.sets, ...ex.sets];
            // Sort merged sets by set number (or id if set number missing)
            combinedSets.sort((a, b) => a.setNumber - b.setNumber);
            // Renumber
            combinedSets.forEach((s, i) => s.setNumber = i + 1);
            existing.sets = combinedSets;
          } else {
            exerciseMap.set(key, ex);
          }
        }

        return Array.from(exerciseMap.values())
          .sort((a, b) => a.orderIndex - b.orderIndex);
      })()
    };
  }, [preferredUnit]);

  // Fetch session on mount
  useEffect(() => {
    if (activeSession || !sessionId) return;
    
    const fetchSession = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, user_id, name, template_id, session_focus, session_goal, session_intensity, started_at, ended_at, status, 
          body_weight_lb, session_notes, 
          session_exercises(
            id, exercise_name, primary_muscle, secondary_muscles, 
            metric_profile, order_index, 
            sets(
              id, set_number, reps, weight, implement_count, load_type, 
              rpe, rir, completed, performed_at, weight_unit, 
              duration_seconds, distance, distance_unit, rest_seconds_actual, 
              extras, extra_metrics
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error) {
        setErrorMessage('Unable to load the active session.');
        return;
      }

      // Validate response schema
      const validated = safeParseSingle(sessionQueryResultSchema, data, 'session fetch');
      if (!validated) {
        setErrorMessage('Session data format is invalid.');
        return;
      }

      if (validated.status && validated.status !== 'in_progress') {
        setErrorMessage('This session is no longer active.');
        return;
      }
      
      startSession(mapSession(validated as SessionPayload));
    };
    
    fetchSession();
  }, [activeSession, mapSession, sessionId, startSession, supabase]);

  // Load template experience level (used to align targets with generation logic)
  useEffect(() => {
    if (!activeSession?.templateId) {
      setTemplateExperienceLevel(null);
      return;
    }

    const loadTemplate = async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('experience_level, template_inputs')
        .eq('id', activeSession.templateId)
        .maybeSingle();

      if (error || !data) {
        return;
      }

      const templateInputs = data.template_inputs as Partial<PlanInput> | null;
      const baseExperience =
        templateInputs?.experienceLevel ??
        (data.experience_level as PlanInput['experienceLevel'] | null) ??
        null;
      setTemplateExperienceLevel(baseExperience);
    };

    loadTemplate();
  }, [activeSession?.templateId, supabase]);

  // Load profile preferences
  useEffect(() => {
    if (!activeSession?.userId) return;
    
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('weight_lb, preferences')
        .eq('id', activeSession.userId)
        .maybeSingle();
      
      setProfileWeightLb(data?.weight_lb ?? null);
      
      if (!activeSession?.weightUnit) {
        const normalized = normalizePreferences(data?.preferences);
        updateSession({ weightUnit: normalized.settings?.units ?? 'lb' });
      }
    };
    
    loadProfile();
  }, [activeSession?.userId, activeSession?.weightUnit, updateSession, supabase]);

  // Load exercise history
  useEffect(() => {
    if (!activeSession?.userId) return;
    
    const loadHistory = async () => {
      const history = await fetchExerciseHistory(supabase, activeSession.userId);
      setExerciseHistory(history);
    };
    
    loadHistory();
  }, [activeSession?.userId, supabase]);

  /**
   * Update a set field with optimistic update and rollback on failure.
   * This is the key fix for issue #4 - proper rollback on persistence failure.
   */
  const handleSetUpdate = useCallback(async (
    exIdx: number, 
    setIdx: number, 
    field: keyof WorkoutSet, 
    value: WorkoutSet[keyof WorkoutSet]
  ) => {
    if (!activeSession) return;
    
    const exercise = activeSession.exercises[exIdx];
    if (!exercise) return;
    
    const currentSet = exercise.sets[setIdx];
    if (!currentSet) return;
    
    // Store previous value for potential rollback
    const previousValue = currentSet[field];
    
    // Optimistic update
    updateSet(exIdx, setIdx, field, value);
    setIsUpdating(true);

    try {
      const nextSet = { ...currentSet, [field]: value };
      const result = await persistSet(exercise, nextSet);
      
      if (!result.success) {
        // Rollback on failure
        updateSet(exIdx, setIdx, field, previousValue);
        setErrorMessage(result.error ?? 'Failed to save changes. Please try again.');
        return;
      }
      
      // Update with server-generated values if this was a new set
      if (result.id && currentSet.id.startsWith('temp-')) {
        updateSet(exIdx, setIdx, 'id', result.id);
      }
      if (result.performedAt) {
        updateSet(exIdx, setIdx, 'performedAt', result.performedAt);
      }
    } catch (error) {
      // Rollback on unexpected error
      updateSet(exIdx, setIdx, field, previousValue);
      setErrorMessage('An unexpected error occurred. Please try again.');
      console.error('handleSetUpdate error:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [activeSession, persistSet, updateSet]);

  /**
   * Toggle preferred weight unit with body weight conversion.
   */
  const togglePreferredUnit = useCallback(() => {
    const nextUnit = preferredUnit === 'lb' ? 'kg' : 'lb';
    updateSession({ weightUnit: nextUnit });

    if (sessionBodyWeight) {
      const val = parseFloat(sessionBodyWeight);
      if (!isNaN(val)) {
        const converted = roundWeight(convertWeight(val, preferredUnit, nextUnit));
        setSessionBodyWeight(String(converted));
      }
    }
  }, [preferredUnit, sessionBodyWeight, updateSession]);

  /**
   * Update session body weight with proper error handling.
   * This is the fix for issue #3 - fire-and-forget mutations.
   */
  const handleBodyWeightUpdate = useCallback(async (weightValue: number | null) => {
    if (!activeSession) return;
    
    const result = await persistSessionBodyWeight(activeSession.id, weightValue);
    
    if (!result.success) {
      setErrorMessage(result.error ?? 'Failed to update body weight.');
    }
  }, [activeSession, persistSessionBodyWeight]);

  /**
   * Persist exercise order to database and update local state.
   * Updates order_index for all exercises in the session.
   */
  const handleReorderExercises = useCallback(async (reorderedExercises: { id: string; orderIndex: number }[]) => {
    if (!activeSession) return { success: false, error: 'No active session' };
    
    setIsUpdating(true);
    try {
      // Batch update all exercise order_index values
      const updates = reorderedExercises.map(({ id, orderIndex }) => 
        supabase
          .from('session_exercises')
          .update({ order_index: orderIndex })
          .eq('id', id)
          .eq('session_id', activeSession.id)
      );
      
      const results = await Promise.all(updates);
      const hasError = results.some(r => r.error);
      
      if (hasError) {
        setErrorMessage('Failed to save exercise order. Please try again.');
        return { success: false, error: 'Database update failed' };
      }
      
      // Apply reorder to local state
      // Find the new positions based on the reordered array
      for (let i = 0; i < reorderedExercises.length; i++) {
        const targetExercise = reorderedExercises[i];
        const currentIndex = activeSession.exercises.findIndex(e => e.id === targetExercise.id);
        if (currentIndex !== i && currentIndex !== -1) {
          reorderExercises(currentIndex, i);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('handleReorderExercises error:', error);
      setErrorMessage('An unexpected error occurred. Please try again.');
      return { success: false, error: 'Unexpected error' };
    } finally {
      setIsUpdating(false);
    }
  }, [activeSession, supabase, reorderExercises]);

  return {
    // Session state
    activeSession,
    errorMessage,
    setErrorMessage,
    sessionBodyWeight,
    setSessionBodyWeight,
    preferredUnit,
    togglePreferredUnit,
    profileWeightLb,
    exerciseHistory,
    exerciseTargets,
    
    // Set operations with proper persistence
    handleSetUpdate,
    handleBodyWeightUpdate,
    addSet,
    removeSet,
    updateSet,
    
    // Exercise operations
    replaceSessionExercise,
    removeSessionExercise,
    addSessionExercise,
    handleReorderExercises,
    
    // Exercise library
    resolvedInventory,
    exerciseLibrary,
    exerciseLibraryByName,
    
    // Loading states
    isUpdating: isUpdating || isPersisting,
    
    // Supabase client (for components that need direct access)
    supabase
  };
}
