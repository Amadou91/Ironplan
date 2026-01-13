import { create } from 'zustand';
import type { GeneratedPlan } from '@/types/domain';

interface WorkoutState {
  currentWorkout: GeneratedPlan | null;
  setWorkout: (workout: GeneratedPlan) => void;
  clearWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  currentWorkout: null,
  setWorkout: (workout) => set({ currentWorkout: workout }),
  clearWorkout: () => set({ currentWorkout: null }),
}));
