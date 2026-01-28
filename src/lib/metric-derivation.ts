import { ExerciseCategory, Goal, MetricProfile } from '@/types/domain';

// Expanded definition to support "virtual" profiles that map to a backend profile + extra flags
export type MetricProfileOption = {
  value: string; // Changed from MetricProfile to string to allow 'strength_interval' etc.
  label: string;
  description?: string;
  backendProfile: MetricProfile; // The actual DB value
  isInterval?: boolean; // Flag to set isInterval=true
};

export const METRIC_PROFILE_OPTIONS: MetricProfileOption[] = [
  // Standard Strength (Covers reps_weight, reps_only, duration)
  { 
    value: 'strength', 
    label: 'Reps & Weight', 
    description: 'Standard sets & reps tracking',
    backendProfile: 'reps_weight',
    isInterval: false
  },
  // Timed Strength (Isometrics)
  { 
    value: 'timed_strength', 
    label: 'Duration / Isometric', 
    description: 'Planks, holds, carries',
    backendProfile: 'timed_strength',
    isInterval: false
  },
  // Cardio (Distance/Duration)
  { 
    value: 'cardio_session', 
    label: 'Cardio Session', 
    description: 'Distance & Time tracking',
    backendProfile: 'cardio_session',
    isInterval: false
  },
  // Mobility
  { 
    value: 'mobility_session', 
    label: 'Mobility / Yoga', 
    description: 'Time-based recovery',
    backendProfile: 'mobility_session',
    isInterval: false
  }
];

/**
 * Derives the appropriate MetricProfile based on Category and potentially Goal.
 * Returns the derived profile option (virtual).
 */
export function deriveMetricProfile(
  category: ExerciseCategory | undefined,
  goal: Goal | undefined
): { option: MetricProfileOption; isAmbiguous: boolean; alternatives?: MetricProfileOption[] } {
  
  // Helper to find option
  const findOpt = (val: string) => METRIC_PROFILE_OPTIONS.find(o => o.value === val) || METRIC_PROFILE_OPTIONS[0];

  if (!category) {
    return { option: findOpt('strength'), isAmbiguous: false };
  }

  // 1. Deterministic Cases
  if (category === 'Cardio') {
    return { option: findOpt('cardio_session'), isAmbiguous: false };
  }

  if (category === 'Mobility') {
    return { option: findOpt('mobility_session'), isAmbiguous: false };
  }

  // 2. Strength Category Logic
  if (category === 'Strength') {
    
    // Ambiguity: Endurance goal could be high reps OR intervals OR isometrics
    if (goal === 'endurance') {
       return { 
         option: findOpt('strength'), // Default to standard reps
         isAmbiguous: true,
         alternatives: [
           findOpt('strength'),
           findOpt('timed_strength')
         ]
       };
    }

    // Default Strength
    return { option: findOpt('strength'), isAmbiguous: false };
  }

  // Fallback
  return { option: findOpt('strength'), isAmbiguous: false };
}