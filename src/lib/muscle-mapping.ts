import { MuscleGroup } from '@/types/domain';

export type BodyRegion = 'Upper Body' | 'Lower Body' | 'Full Body & Core';
export type LimbGroup = 'Arms' | 'Legs' | 'Torso' | 'General'; // Torso/General for consistency, though prompt said "Arms/Legs only when applicable"

export interface MuscleMapping {
  region: BodyRegion;
  limb?: LimbGroup;
  label: string;
  order: number;
}

export const MUSCLE_MAPPING: Record<MuscleGroup | string, MuscleMapping> = {
  // Upper Body - Torso
  chest: { region: 'Upper Body', label: 'Chest', order: 1 },
  back: { region: 'Upper Body', label: 'Back', order: 2 },
  shoulders: { region: 'Upper Body', label: 'Shoulders', order: 3 },
  
  // Upper Body - Arms
  biceps: { region: 'Upper Body', limb: 'Arms', label: 'Biceps', order: 1 },
  triceps: { region: 'Upper Body', limb: 'Arms', label: 'Triceps', order: 2 },
  forearms: { region: 'Upper Body', limb: 'Arms', label: 'Forearms', order: 3 },

  // Lower Body - Hips/Glutes
  glutes: { region: 'Lower Body', label: 'Glutes', order: 1 },
  hip_flexors: { region: 'Lower Body', label: 'Hip Flexors', order: 2 },

  // Lower Body - Legs
  quads: { region: 'Lower Body', limb: 'Legs', label: 'Quads', order: 1 },
  hamstrings: { region: 'Lower Body', limb: 'Legs', label: 'Hamstrings', order: 2 },
  calves: { region: 'Lower Body', limb: 'Legs', label: 'Calves', order: 3 },
  adductors: { region: 'Lower Body', limb: 'Legs', label: 'Adductors', order: 4 },
  abductors: { region: 'Lower Body', limb: 'Legs', label: 'Abductors', order: 5 },

  // Full Body / Core / Other
  core: { region: 'Full Body & Core', label: 'Core', order: 1 },
  full_body: { region: 'Full Body & Core', label: 'Full Body', order: 2 },
  cardio: { region: 'Full Body & Core', label: 'Cardio', order: 3 },
  yoga: { region: 'Full Body & Core', label: 'Yoga', order: 4 },
  
  // Catch-alls
  upper_body: { region: 'Upper Body', label: 'General Upper', order: 99 },
  lower_body: { region: 'Lower Body', label: 'General Lower', order: 99 },
};

export const REGION_ORDER: BodyRegion[] = ['Upper Body', 'Lower Body', 'Full Body & Core'];
