'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkoutStore } from '@/store/useWorkoutStore';
import { createClient } from '@/lib/supabase/client';
import { SetLogger } from './SetLogger';
import { Plus, Clock } from 'lucide-react';
import { SessionExercise, WorkoutImpact, WorkoutSession, WorkoutSet } from '@/types/domain';
import { toMuscleLabel } from '@/lib/muscle-utils';

type ActiveSessionProps = {
  sessionId?: string | null;
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
    variation: Record<string, string | null> | null;
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
      set_type: string | null;
      weight_unit: string | null;
      rest_seconds_actual: number | null;
      failure: boolean | null;
      tempo: string | null;
      rom_cue: string | null;
      pain_score: number | null;
      pain_area: string | null;
      group_id: string | null;
      group_type: string | null;
      extras: Record<string, string | null> | null;
    }>;
  }>;
};

export default function ActiveSession({ sessionId }: ActiveSessionProps) {
  const { activeSession, addSet, removeSet, updateSet, startSession, replaceSessionExercise, updateSession } = useWorkoutStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = createClient();
  const isLoading = Boolean(sessionId) && !activeSession && !errorMessage;

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
              notes: set.notes ?? '',
              performedAt: set.performed_at ?? undefined,
              completed: set.completed ?? false,
              setType: set.set_type ?? 'working',
              weightUnit: set.weight_unit ?? 'lb',
              restSecondsActual: set.rest_seconds_actual ?? '',
              failure: set.failure ?? false,
              tempo: set.tempo ?? '',
              romCue: set.rom_cue ?? '',
              painScore: set.pain_score ?? '',
              painArea: set.pain_area ?? '',
              groupId: set.group_id ?? '',
              groupType: set.group_type ?? '',
              extras: set.extras ?? {}
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
          'id, user_id, name, template_id, started_at, ended_at, status, impact, timezone, session_notes, session_exercises(id, exercise_name, primary_muscle, secondary_muscles, order_index, variation, sets(id, set_number, reps, weight, rpe, rir, notes, completed, performed_at, set_type, weight_unit, rest_seconds_actual, failure, tempo, rom_cue, pain_score, pain_area, group_id, group_type, extras))'
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

  const normalizeExtras = (extras?: WorkoutSet['extras']) => {
    if (!extras) return {};
    const entries = Object.entries(extras).filter(([, value]) => typeof value === 'string' && value.trim().length > 0);
    return entries.length ? Object.fromEntries(entries) : {};
  };

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
        performed_at: set.performedAt ?? new Date().toISOString(),
        set_type: set.setType ?? 'working',
        weight_unit: set.weightUnit ?? 'lb',
        rest_seconds_actual: typeof set.restSecondsActual === 'number' ? set.restSecondsActual : null,
        failure: Boolean(set.failure),
        tempo: set.tempo ? set.tempo.trim() : null,
        rom_cue: set.romCue ? set.romCue.trim() : null,
        pain_score: typeof set.painScore === 'number' ? set.painScore : null,
        pain_area: typeof set.painArea === 'string' && set.painArea.trim() ? set.painArea : null,
        group_id: typeof set.groupId === 'string' && set.groupId.trim() ? set.groupId : null,
        group_type: typeof set.groupType === 'string' && set.groupType.trim() ? set.groupType : null,
        extras: normalizeExtras(set.extras)
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

  const handleNotesBlur = async () => {
    if (!activeSession) return;
    const trimmed = (activeSession.sessionNotes ?? '').trim();
    updateSession({ sessionNotes: trimmed });
    const { error } = await supabase.from('sessions').update({ session_notes: trimmed || null }).eq('id', activeSession.id);
    if (error) {
      console.error('Failed to save session notes', error);
      setErrorMessage('Unable to save session notes. Please try again.');
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
        <div className="surface-card-muted p-4 md:p-6 space-y-3">
          <div className="text-xs uppercase tracking-wider text-subtle">Session notes</div>
          <textarea
            rows={3}
            value={activeSession.sessionNotes ?? ''}
            onChange={(event) => updateSession({ sessionNotes: event.target.value })}
            onBlur={handleNotesBlur}
            className="input-base"
            placeholder="Add notes about today."
          />
          {activeSession.timezone ? (
            <p className="text-[10px] text-subtle">Timezone: {activeSession.timezone}</p>
          ) : null}
        </div>

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
