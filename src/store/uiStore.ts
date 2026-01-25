import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WeightUnit } from '@/types/domain';

interface UIState {
  displayUnit: WeightUnit;
  setDisplayUnit: (unit: WeightUnit) => void;
  toggleDisplayUnit: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      displayUnit: 'lb',
      setDisplayUnit: (unit) => set({ displayUnit: unit }),
      toggleDisplayUnit: () => set((state) => ({ 
        displayUnit: state.displayUnit === 'lb' ? 'kg' : 'lb' 
      })),
    }),
    {
      name: 'ironplan-ui-settings',
    }
  )
);
