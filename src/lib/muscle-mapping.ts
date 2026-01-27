import { MuscleGroup } from '@/types/domain';

export type BodyRegion = 'Upper Body' | 'Lower Body' | 'Full Body & Core';

export interface MuscleMapping {
  region: BodyRegion;
  label: string;
  order: number;
}

export const MUSCLE_MAPPING: Record<MuscleGroup | string, MuscleMapping> = {
  // Upper Body
  chest: { region: 'Upper Body', label: 'Chest', order: 1 },
  back: { region: 'Upper Body', label: 'Back', order: 2 },
  shoulders: { region: 'Upper Body', label: 'Shoulders', order: 3 },
  biceps: { region: 'Upper Body', label: 'Biceps', order: 4 },
  triceps: { region: 'Upper Body', label: 'Triceps', order: 5 },
  forearms: { region: 'Upper Body', label: 'Forearms', order: 6 },

  // Lower Body
  glutes: { region: 'Lower Body', label: 'Glutes', order: 1 },
  hip_flexors: { region: 'Lower Body', label: 'Hip Flexors', order: 2 },
  quads: { region: 'Lower Body', label: 'Quads', order: 3 },
  hamstrings: { region: 'Lower Body', label: 'Hamstrings', order: 4 },
  calves: { region: 'Lower Body', label: 'Calves', order: 5 },
  adductors: { region: 'Lower Body', label: 'Adductors', order: 6 },
  abductors: { region: 'Lower Body', label: 'Abductors', order: 7 },

  // Full Body / Core / Other
  core: { region: 'Full Body & Core', label: 'Core', order: 1 },
  full_body: { region: 'Full Body & Core', label: 'Full Body', order: 2 },
  cardio: { region: 'Full Body & Core', label: 'Cardio', order: 3 },
  mobility: { region: 'Full Body & Core', label: 'Yoga', order: 4 },
  
  // Catch-alls
  upper_body: { region: 'Upper Body', label: 'General Upper', order: 99 },
  lower_body: { region: 'Lower Body', label: 'General Lower', order: 99 },
};

export const REGION_ORDER: BodyRegion[] = ['Upper Body', 'Lower Body', 'Full Body & Core'];
