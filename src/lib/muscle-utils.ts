import { Exercise } from '@/types/domain';

export const normalizeMuscleGroup = (input: string): { primary: string, secondary: string[] } => {
  const lower = input.toLowerCase();
  
  if (lower.includes('bench') || lower.includes('push up') || lower.includes('chest')) {
    return { primary: 'Chest', secondary: ['Triceps', 'Front Delts'] };
  }
  if (lower.includes('pull up') || lower.includes('row') || lower.includes('deadlift')) {
    return { primary: 'Back', secondary: ['Biceps', 'Rear Delts'] };
  }
  if (lower.includes('squat') || lower.includes('lunge') || lower.includes('leg press')) {
    return { primary: 'Legs', secondary: ['Glutes', 'Core'] };
  }
  if (lower.includes('shoulder') || lower.includes('overhead') || lower.includes('raise')) {
    return { primary: 'Shoulders', secondary: ['Triceps'] };
  }
  if (lower.includes('curl')) {
    return { primary: 'Biceps', secondary: ['Forearms'] };
  }
  if (lower.includes('extension') || lower.includes('dip')) {
    return { primary: 'Triceps', secondary: ['Chest'] };
  }

  return { primary: input || 'Full Body', secondary: [] };
};

export const enhanceExerciseData = (ex: Exercise): Exercise => {
  // Ensure we fallback gracefully if primaryMuscle is undefined
  const currentPrimary = typeof ex.primaryMuscle === 'string' ? ex.primaryMuscle : '';
  
  const { primary, secondary } = normalizeMuscleGroup(ex.name + ' ' + currentPrimary);
  return {
    ...ex,
    primaryMuscle: primary,
    secondaryMuscles: secondary
  };
};