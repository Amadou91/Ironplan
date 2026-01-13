import { create } from 'zustand';
import { GeneratedWorkout } from '@/types/domain';

interface WorkoutState {
  currentWorkout: GeneratedWorkout | null;
  setWorkout: (workout: GeneratedWorkout) => void;
  clearWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutState>((set) => ({
  currentWorkout: null,
  setWorkout: (workout) => set({ currentWorkout: workout }),
  clearWorkout: () => set({ currentWorkout: null }),
}));