import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionExercise, WorkoutSession, WorkoutSet, WeightUnit, LoadType } from '@/types/domain';
import { DEFAULT_REST_SECONDS } from '@/constants/training';

interface WorkoutState {
  activeSession: WorkoutSession | null;
  startSession: (session: WorkoutSession) => void;
  endSession: () => void;
  updateSession: (updates: Partial<WorkoutSession>) => void;
  replaceSessionExercise: (exerciseIndex: number, updates: Partial<SessionExercise>) => void;
  addSessionExercise: (exercise: SessionExercise) => void;
  removeSessionExercise: (exerciseIndex: number) => void;
  reorderExercises: (fromIndex: number, toIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  addSet: (
    exerciseIndex: number,
    weightUnit?: WeightUnit,
    defaultWeight?: number | null,
    options?: { loadType?: LoadType; implementCount?: number | null; initialValues?: Partial<WorkoutSet> }
  ) => WorkoutSet | null;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set) => ({
      activeSession: null,
      
      startSession: (session) => set({ activeSession: session }),
      
      endSession: () => set({ activeSession: null }),

      updateSession: (updates) => set((state) => {
        if (!state.activeSession) return state;
        return { activeSession: { ...state.activeSession, ...updates } };
      }),

      replaceSessionExercise: (exerciseIndex, updates) => set((state) => {
        if (!state.activeSession) return state;
        const exercises = [...state.activeSession.exercises];
        if (!exercises[exerciseIndex]) return state;
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], ...updates };
        return { activeSession: { ...state.activeSession, exercises } };
      }),

      addSessionExercise: (exercise) => set((state) => {
        if (!state.activeSession) return state;
        return {
          activeSession: {
            ...state.activeSession,
            exercises: [...state.activeSession.exercises, exercise]
          }
        };
      }),

      removeSessionExercise: (exerciseIndex) => set((state) => {
        if (!state.activeSession) return state;
        const exercises = state.activeSession.exercises.filter((_, index) => index !== exerciseIndex);
        // Re-assign orderIndex after removal
        const reindexed = exercises.map((ex, idx) => ({ ...ex, orderIndex: idx }));
        return { activeSession: { ...state.activeSession, exercises: reindexed } };
      }),

      reorderExercises: (fromIndex, toIndex) => set((state) => {
        if (!state.activeSession) return state;
        if (fromIndex === toIndex) return state;
        const exercises = [...state.activeSession.exercises];
        if (fromIndex < 0 || fromIndex >= exercises.length || toIndex < 0 || toIndex >= exercises.length) return state;
        
        // Remove from old position and insert at new position
        const [movedExercise] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, movedExercise);
        
        // Re-assign orderIndex to match new positions
        const reindexed = exercises.map((ex, idx) => ({ ...ex, orderIndex: idx }));
        
        return { activeSession: { ...state.activeSession, exercises: reindexed } };
      }),

      addSet: (exerciseIndex, weightUnit, defaultWeight, options) => {
        let createdSet: WorkoutSet | null = null;
        set((state) => {
        if (!state.activeSession) return state;
        const exercises = [...state.activeSession.exercises];
        const exercise = exercises[exerciseIndex];
        
        const initial = options?.initialValues ?? {};
        const newSet: WorkoutSet = {
          id: crypto.randomUUID(),
          setNumber: exercise.sets.length + 1,
          reps: initial.reps ?? '',
          weight: initial.weight ?? (typeof defaultWeight === 'number' ? defaultWeight : ''),
          implementCount: initial.implementCount ?? (typeof options?.implementCount === 'number' ? options.implementCount : ''),
          loadType: initial.loadType ?? options?.loadType ?? '',
          rpe: initial.rpe ?? '',
          rir: initial.rir ?? '',
          extraMetrics: initial.extraMetrics ?? null,
          durationSeconds: initial.durationSeconds ?? '',
          distance: initial.distance ?? '',
          distanceUnit: initial.distanceUnit ?? null,
          restSecondsActual: initial.restSecondsActual ?? DEFAULT_REST_SECONDS,
          performedAt: new Date().toISOString(),
          completed: false,
          weightUnit: weightUnit ?? state.activeSession.weightUnit ?? 'lb'
        };
        createdSet = newSet;

        exercises[exerciseIndex] = {
          ...exercise,
          sets: [...exercise.sets, newSet]
        };

        return { activeSession: { ...state.activeSession, exercises } };
      });
      return createdSet;
      },

      removeSet: (exerciseIdx, setIdx) => set((state) => {
        if (!state.activeSession) return state;
        const exercises = [...state.activeSession.exercises];
        const exercise = exercises[exerciseIdx];
        
        // Remove set
        const updatedSets = exercise.sets.filter((_, idx: number) => idx !== setIdx);
        
        // Renumber remaining sets
        const renumberedSets = updatedSets.map((s: WorkoutSet, i: number) => ({ ...s, setNumber: i + 1 }));

        exercises[exerciseIdx] = { ...exercise, sets: renumberedSets };
        return { activeSession: { ...state.activeSession, exercises } };
      }),

      updateSet: (exIdx, setIdx, field, value) => set((state) => {
        if (!state.activeSession) return state;
        const exercises = [...state.activeSession.exercises];
        
        // Safety check
        if (!exercises[exIdx] || !exercises[exIdx].sets[setIdx]) return state;

        const sets = [...exercises[exIdx].sets];
        const currentSet = sets[setIdx];
        
        // Cast to WorkoutSet to satisfy TS dynamic key access
        sets[setIdx] = { ...currentSet, [field]: value } as WorkoutSet;
        
        if (field === 'completed' && value === true) {
            // Optional trigger
        }

        exercises[exIdx] = { ...exercises[exIdx], sets };
        return { activeSession: { ...state.activeSession, exercises } };
      }),

    }),
    {
      name: 'ironplan-active-session',
      version: 1,
      migrate: (persistedState: unknown) => persistedState as WorkoutState,
    }
  )
);
