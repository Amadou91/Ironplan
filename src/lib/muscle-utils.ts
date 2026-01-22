import { Exercise } from '@/types/domain';

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const MUSCLE_GROUP_SLUGS = new Set([
  'chest',
  'back',
  'shoulders',
  'arms',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'hip_flexors',
  'adductors',
  'abductors',
  'upper_body',
  'lower_body',
  'full_body',
  'cardio'
]);

const resolveByKeyword = (label: string) => {
  if (label.includes('bench') || label.includes('push up') || label.includes('press')) {
    return { primary: 'Chest', secondary: ['Triceps', 'Shoulders'] };
  }
  if (label.includes('pull up') || label.includes('row') || label.includes('deadlift') || label.includes('lat')) {
    return { primary: 'Back', secondary: ['Biceps', 'Shoulders'] };
  }
  if (label.includes('squat') || label.includes('lunge') || label.includes('leg press') || label.includes('split squat')) {
    return { primary: 'Quads', secondary: ['Glutes', 'Core'] };
  }
  if (label.includes('hinge') || label.includes('rdl') || label.includes('hamstring') || label.includes('good morning')) {
    return { primary: 'Hamstrings', secondary: ['Glutes', 'Back'] };
  }
  if (label.includes('calf')) {
    return { primary: 'Calves', secondary: ['Lower Body'] };
  }
  if (label.includes('shoulder') || label.includes('overhead') || label.includes('raise')) {
    return { primary: 'Shoulders', secondary: ['Triceps'] };
  }
  if (label.includes('curl')) {
    return { primary: 'Biceps', secondary: ['Forearms'] };
  }
  if (label.includes('extension') || label.includes('dip') || label.includes('pushdown')) {
    return { primary: 'Triceps', secondary: ['Chest'] };
  }
  if (label.includes('plank') || label.includes('crunch') || label.includes('core')) {
    return { primary: 'Core', secondary: [] };
  }
  if (label.includes('run') || label.includes('rower') || label.includes('bike') || label.includes('cardio')) {
    return { primary: 'Cardio', secondary: [] };
  }
  return null;
};

export const PRESET_MAPPINGS: Record<string, string[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'adductors', 'abductors'],
  arms: ['arms', 'biceps', 'triceps', 'forearms'],
  core: ['core']
};

export const isMuscleMatch = (targetPreset: string, primary?: string | null, secondary?: string[] | null): boolean => {
  if (targetPreset === 'all') return true;
  const targetMuscles = PRESET_MAPPINGS[targetPreset] || [targetPreset];
  const p = primary?.toLowerCase();
  const s = secondary?.map(m => m.toLowerCase()) ?? [];
  return targetMuscles.some(m => m === p || s.includes(m));
};

export const normalizeMuscleGroup = (input: string): { primary: string; secondary: string[] } => {
  const lower = normalizeLabel(input);
  const keywordMatch = resolveByKeyword(lower);
  if (keywordMatch) return keywordMatch;

  if (lower.includes('upper body') || lower.includes('upper')) {
    return { primary: 'Shoulders', secondary: ['Chest', 'Back', 'Arms'] };
  }

  if (lower.includes('lower body') || lower.includes('lower')) {
    return { primary: 'Quads', secondary: ['Glutes', 'Hamstrings', 'Calves'] };
  }

  return { primary: input || 'Full Body', secondary: [] };
};

export const enhanceExerciseData = (ex: Exercise): Exercise => {
  const currentPrimary = typeof ex.primaryMuscle === 'string' ? ex.primaryMuscle : '';
  const rawLabel = `${ex.name} ${currentPrimary}`.trim();
  const { primary, secondary } = normalizeMuscleGroup(rawLabel);
  return {
    ...ex,
    primaryMuscle: primary,
    secondaryMuscles: secondary
  };
};

export const toMuscleSlug = (value: string, fallback: string | null = 'full_body') => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '_');

  if (!slug) return fallback;
  return MUSCLE_GROUP_SLUGS.has(slug) ? slug : fallback;
};

export const toMuscleLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));

export const isTimeBasedExercise = (exerciseName: string, targetReps?: string | number) => {
  const name = exerciseName.toLowerCase();
  if (
    name.includes('plank') ||
    name.includes('hold') ||
    name.includes('stretch') ||
    name.includes('ride') ||
    name.includes('run') ||
    name.includes('rower') ||
    name.includes('bike') ||
    name.includes('cycling') ||
    name.includes('flow')
  ) {
    return true;
  }
  if (typeof targetReps === 'string') {
    const lower = targetReps.toLowerCase();
    if (lower.includes('sec') || lower.includes('min')) {
      return true;
    }
  }
  return false;
};
