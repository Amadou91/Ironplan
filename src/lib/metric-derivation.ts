import { ExerciseCategory, Goal, MetricProfile } from '@/types/domain';

export type MetricProfileOption = {
  value: MetricProfile;
  label: string;
  description?: string;
};

export const METRIC_PROFILE_OPTIONS: MetricProfileOption[] = [
  { value: 'reps_weight', label: 'Reps & Weight', description: 'Standard strength tracking' },
  { value: 'strength', label: 'Reps & Weight', description: 'Standard strength tracking' }, // Alias for UI if needed, or normalized
  { value: 'timed_strength', label: 'Timed Strength', description: 'Isometrics, carries, planks' },
  { value: 'cardio_session', label: 'Cardio', description: 'Time-based endurance' },
  { value: 'mobility_session', label: 'Mobility', description: 'Time-based recovery' },
  { value: 'duration', label: 'Duration Only', description: 'Time tracking only' },
];

/**
 * Derives the appropriate MetricProfile based on Category and potentially Goal.
 * Returns the derived profile and a flag indicating if user input is needed (ambiguity).
 */
export function deriveMetricProfile(
  category: ExerciseCategory | undefined,
  goal: Goal | undefined
): { profile: MetricProfile; isAmbiguous: boolean; options?: MetricProfileOption[] } {
  
  if (!category) {
    return { profile: 'strength', isAmbiguous: false };
  }

  // 1. Deterministic Cases
  if (category === 'Cardio') {
    return { profile: 'cardio_session', isAmbiguous: false };
  }

  if (category === 'Mobility') {
    // Usually mobility is mobility_session, but if goal is specifically 'strength' (e.g. weighted stretch?), 
    // it might be debatable. But for now, Mobility -> mobility_session.
    return { profile: 'mobility_session', isAmbiguous: false };
  }

  // 2. Strength Category Logic
  if (category === 'Strength') {
    // If goal implies holding or time-under-tension without reps (e.g. Plank)
    // But "Endurance" goal can be high reps OR long hold.
    // So if Goal is Endurance, it IS ambiguous.
    
    if (goal === 'endurance') {
       return { 
         profile: 'strength', // Default to reps
         isAmbiguous: true,
         options: [
           { value: 'strength', label: 'Reps & Sets', description: 'High reps endurance' },
           { value: 'timed_strength', label: 'Duration / Isometric', description: 'Planks, holds, carries' }
         ]
       };
    }

    // Default Strength
    return { profile: 'strength', isAmbiguous: false };
  }

  // Fallback
  return { profile: 'strength', isAmbiguous: false };
}

/**
 * Returns available profiles for a manually overridden scenario or advanced mode.
 */
export function getAvailableMetricProfiles(category: ExerciseCategory): MetricProfileOption[] {
  switch (category) {
    case 'Cardio':
      return [
        { value: 'cardio_session', label: 'Cardio Session' },
        { value: 'duration', label: 'Duration Only' }
      ];
    case 'Mobility':
      return [
        { value: 'mobility_session', label: 'Mobility Session' },
        { value: 'duration', label: 'Duration Only' }
      ];
    case 'Strength':
    default:
      return [
        { value: 'strength', label: 'Reps & Weight' },
        { value: 'timed_strength', label: 'Timed / Isometric' },
        { value: 'reps_only', label: 'Reps Only' },
        { value: 'reps_weight', label: 'Reps & Weight (Legacy)' }
      ];
  }
}
