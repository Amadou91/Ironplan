import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import { getSuggestedSessionId as computeSuggestedSessionId } from '@/lib/workout-metrics';
import { PlanStatus, SessionExercise, WorkoutLog, WorkoutPlan, WorkoutSession, WorkoutSet } from '@/types/domain';

interface PlanActivationConflict {
  workoutId: string;
  title: string | null;
  scheduledDates: string[];
}

interface WorkoutState {
  activeSession: WorkoutSession | null;
  startSession: (session: WorkoutSession) => void;
  endSession: () => void;
  replaceSessionExercise: (exerciseIndex: number, updates: Partial<SessionExercise>) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: keyof WorkoutSet, value: string | number | boolean) => void;
  addSet: (exerciseIndex: number) => WorkoutSet | null;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  getSuggestedSessionId: (plan: WorkoutPlan, history: WorkoutLog[]) => string | null;
  activatePlan: (
    planId: string,
    options?: { force?: boolean }
  ) => Promise<{ activated: boolean; conflicts: PlanActivationConflict[]; error?: string }>;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set) => ({
      activeSession: null,
      
      startSession: (session) => set({ activeSession: session }),
      
      endSession: () => set({ activeSession: null }),

      replaceSessionExercise: (exerciseIndex, updates) => set((state) => {
        if (!state.activeSession) return state;
        const exercises = [...state.activeSession.exercises];
        if (!exercises[exerciseIndex]) return state;
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], ...updates };
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
          notes: '',
          performedAt: new Date().toISOString(),
          completed: false
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

      getSuggestedSessionId: (plan, history) => computeSuggestedSessionId(plan, history),

      activatePlan: async (planId, options = {}) => {
        const supabase = createClient();
        const { data: scheduleRows, error: scheduleError } = await supabase
          .from('scheduled_sessions')
          .select('user_id, week_start_date, day_of_week')
          .eq('workout_id', planId);

        if (scheduleError) {
          return { activated: false, conflicts: [], error: scheduleError.message };
        }

        if (!scheduleRows || scheduleRows.length === 0) {
          return { activated: false, conflicts: [], error: 'No scheduled sessions found for this plan.' };
        }

        const userId = scheduleRows[0].user_id as string;
        const scheduleFilters = scheduleRows
          .map((row) => `and(week_start_date.eq.${row.week_start_date},day_of_week.eq.${row.day_of_week})`)
          .join(',');

        const { data: conflictRows, error: conflictError } = await supabase
          .from('scheduled_sessions')
          .select('workout_id, week_start_date, day_of_week, workout:workouts(id, title)')
          .eq('user_id', userId)
          .eq('status', 'ACTIVE' as PlanStatus)
          .neq('workout_id', planId)
          .or(scheduleFilters);

        if (conflictError) {
          return { activated: false, conflicts: [], error: conflictError.message };
        }

        const conflictsMap = new Map<string, PlanActivationConflict>();
        (conflictRows ?? []).forEach((row) => {
          const workoutId = row.workout_id as string;
          const workout = Array.isArray(row.workout) ? row.workout[0] : row.workout;
          const title = workout?.title ?? null;
          const startDate = new Date(`${row.week_start_date}T00:00:00Z`);
          startDate.setUTCDate(startDate.getUTCDate() + Number(row.day_of_week));
          const scheduledDate = startDate.toISOString().split('T')[0];

          const existing = conflictsMap.get(workoutId);
          if (existing) {
            existing.scheduledDates.push(scheduledDate);
          } else {
            conflictsMap.set(workoutId, { workoutId, title, scheduledDates: [scheduledDate] });
          }
        });

        const conflicts = Array.from(conflictsMap.values());
        if (conflicts.length > 0 && !options.force) {
          return { activated: false, conflicts };
        }

        if (conflicts.length > 0) {
          const conflictIds = conflicts.map((conflict) => conflict.workoutId);
          const { error: archiveError } = await supabase
            .from('scheduled_sessions')
            .update({ status: 'ARCHIVED', is_active: false })
            .eq('user_id', userId)
            .in('workout_id', conflictIds);

          if (archiveError) {
            return { activated: false, conflicts, error: archiveError.message };
          }

          const { error: workoutArchiveError } = await supabase
            .from('workouts')
            .update({ status: 'ARCHIVED' })
            .eq('user_id', userId)
            .in('id', conflictIds);

          if (workoutArchiveError) {
            return { activated: false, conflicts, error: workoutArchiveError.message };
          }
        }

        const { error: activateError } = await supabase
          .from('scheduled_sessions')
          .update({ status: 'ACTIVE', is_active: true })
          .eq('user_id', userId)
          .eq('workout_id', planId);

        if (activateError) {
          return { activated: false, conflicts, error: activateError.message };
        }

        const { error: workoutActivateError } = await supabase
          .from('workouts')
          .update({ status: 'ACTIVE' })
          .eq('user_id', userId)
          .eq('id', planId);

        if (workoutActivateError) {
          return { activated: false, conflicts, error: workoutActivateError.message };
        }

        return { activated: true, conflicts };
      },
    }),
    {
      name: 'ironplan-active-session',
    }
  )
);
