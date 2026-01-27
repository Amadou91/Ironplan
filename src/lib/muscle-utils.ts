import { Exercise, MetricProfile } from '@/types/domain';

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
  'cardio',
  'mobility'
]);

const resolveByKeyword = (label: string) => {
  // Specific compound movements first
  if (label.includes('squat') || label.includes('lunge') || label.includes('leg press') || label.includes('split squat')) {
    return { primary: 'quads', secondary: ['glutes', 'core'] };
  }
  if (label.includes('deadlift') || label.includes('rdl') || label.includes('good morning') || label.includes('hinge')) {
    return { primary: 'hamstrings', secondary: ['glutes', 'back'] };
  }
  if (label.includes('overhead') || label.includes('shoulder press') || label.includes('military') || label.includes('raise') || label.includes('face pull')) {
    return { primary: 'shoulders', secondary: ['triceps'] };
  }
  if (label.includes('hip thrust') || label.includes('glute bridge')) {
    return { primary: 'glutes', secondary: ['hamstrings'] };
  }
  if (label.includes('calf') || label.includes('calves')) {
    return { primary: 'calves', secondary: ['lower_body'] };
  }

  // Upper body compounds
  if (label.includes('bench') || label.includes('push up') || label.includes('chest press') || label.includes('floor press') || label.includes('dip') || label.includes('fly') || label.includes('pec deck')) {
    return { primary: 'chest', secondary: ['triceps', 'shoulders'] };
  }
  if (label.includes('pull up') || label.includes('chin up') || label.includes('row') || label.includes('lat') || label.includes('pull down')) {
    return { primary: 'back', secondary: ['biceps', 'shoulders'] };
  }
  
  // Isolations
  if (label.includes('curl')) {
    return { primary: 'biceps', secondary: ['forearms'] };
  }
  if (label.includes('extension') || label.includes('pushdown') || label.includes('skull crusher')) {
    return { primary: 'triceps', secondary: ['chest'] };
  }
  
  // Core & Cardio
  if (label.includes('plank') || label.includes('crunch') || label.includes('core') || label.includes('sit up')) {
    return { primary: 'core', secondary: [] };
  }
  if (label.includes('run') || label.includes('rower') || label.includes('bike') || label.includes('cardio') || label.includes('cycle') || label.includes('elliptical')) {
    return { primary: 'cardio', secondary: [] };
  }
  
  // Fallback for generic 'press' if not caught above (likely shoulders or chest, defaulting to Shoulders if it's just 'press', or Chest if context implies)
  // But usually 'press' is too vague. Let's assume if it hasn't matched 'leg press', 'bench', 'overhead', it might be a machine press.
  if (label.includes('press')) {
    // Check for 'shoulder' again just in case
    if (label.includes('shoulder')) return { primary: 'shoulders', secondary: ['triceps'] };
    // Default to Chest for generic "Press" if not qualified, as it's often Chest Press
    return { primary: 'chest', secondary: ['triceps', 'shoulders'] };
  }

  return null;
};

export const PRESET_MAPPINGS: Record<string, string[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'adductors', 'abductors'],
  arms: ['arms', 'biceps', 'triceps', 'forearms'],
  core: ['core'],
  cardio: ['cardio'],
  mobility: ['mobility']
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
    return { primary: 'shoulders', secondary: ['chest', 'back', 'arms'] };
  }

  if (lower.includes('lower body') || lower.includes('lower')) {
    return { primary: 'quads', secondary: ['glutes', 'hamstrings', 'calves'] };
  }

  return { primary: input || 'full_body', secondary: [] };
};

export function enhanceExerciseData<T extends Partial<Exercise>>(ex: T): T {
  const currentPrimary = typeof ex.primaryMuscle === 'string' ? ex.primaryMuscle : '';
  const rawLabel = `${ex.name} ${currentPrimary}`.trim();
  const { primary, secondary } = normalizeMuscleGroup(rawLabel);
  return {
    ...ex,
    primaryMuscle: primary,
    secondaryMuscles: secondary
  };
}

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

export const getMetricProfile = (exercise: Partial<Exercise>): MetricProfile => {
  if (exercise.metricProfile) return exercise.metricProfile;
  
  const name = (exercise.name ?? '').toLowerCase();
  
  if (name.includes('yoga') || name.includes('flow')) return 'mobility_session';
  
  if (
    name.includes('run') || 
    name.includes('bike') || 
    name.includes('row') || 
    name.includes('elliptical') || 
    name.includes('cycling') || 
    name.includes('cardio') || 
    name.includes('skipping')
  ) return 'cardio_session';
  
  if (name.includes('stretch') || name.includes('mobility')) return 'mobility_session';
  
  if (
    name.includes('plank') || 
    name.includes('wall sit') || 
    name.includes('hold') || 
    name.includes('carry')
  ) return 'timed_strength';
  
  return 'strength';
};
