import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SessionExercise, WorkoutSession, WorkoutSet } from '@/types/domain';

interface WorkoutState {
  activeSession: WorkoutSession | null;
  startSession: (session: WorkoutSession) => void;
  endSession: () => void;
  updateSession: (updates: Partial<WorkoutSession>) => void;
  replaceSessionExercise: (exerciseIndex: number, updates: Partial<SessionExercise>) => void;
  addSessionExercise: (exercise: SessionExercise) => void;
  removeSessionExercise: (exerciseIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: WorkoutSet[keyof WorkoutSet]) => void;
  addSet: (exerciseIndex: number) => WorkoutSet | null;
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
        return { activeSession: { ...state.activeSession, exercises } };
      }),

      addSet: (exerciseIndex) => {
        let createdSet: WorkoutSet | null = null;
        set((state) => {
        if (!state.activeSession) return state;
        const exercises = [...state.activeSession.exercises];
        const exercise = exercises[exerciseIndex];
        
        const newSet: WorkoutSet = {
          id: `temp-${crypto.randomUUID()}`,
          setNumber: exercise.sets.length + 1,
          reps: '',
          weight: '',
          rpe: '',
          rir: '',
          performedAt: new Date().toISOString(),
          completed: false,
          weightUnit: 'lb',
          failure: false
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
    }
  )
);
