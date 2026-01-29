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

export type MetricProfileResult = {
  option: MetricProfileOption;
  isAmbiguous: boolean;
  isHybrid: boolean;
  compatibleProfiles: MetricProfileOption[];
  alternatives?: MetricProfileOption[];
};

/**
 * Derives the appropriate MetricProfile based on Category and potentially Goal.
 * Returns the derived profile option with hybrid support for flexible validation.
 */
export function deriveMetricProfile(
  category: ExerciseCategory | undefined,
  goal: Goal | undefined
): MetricProfileResult {
  
  // Helper to find option
  const findOpt = (val: string) => METRIC_PROFILE_OPTIONS.find(o => o.value === val) || METRIC_PROFILE_OPTIONS[0];

  if (!category) {
    const opt = findOpt('strength');
    return { 
      option: opt, 
      isAmbiguous: false, 
      isHybrid: false,
      compatibleProfiles: [opt]
    };
  }

  // 1. Deterministic Cases
  if (category === 'Cardio') {
    const opt = findOpt('cardio_session');
    return { 
      option: opt, 
      isAmbiguous: false, 
      isHybrid: false,
      compatibleProfiles: [opt]
    };
  }

  if (category === 'Mobility') {
    const opt = findOpt('mobility_session');
    return { 
      option: opt, 
      isAmbiguous: false, 
      isHybrid: false,
      compatibleProfiles: [opt]
    };
  }

  // 2. Strength Category Logic
  if (category === 'Strength') {
    const strengthOpt = findOpt('strength');
    const timedStrengthOpt = findOpt('timed_strength');
    
    // Ambiguity: Endurance goal could be high reps OR intervals OR isometrics
    if (goal === 'endurance') {
       return { 
         option: strengthOpt,
         isAmbiguous: true,
         isHybrid: true,
         compatibleProfiles: [strengthOpt, timedStrengthOpt],
         alternatives: [strengthOpt, timedStrengthOpt]
       };
    }
    
    // Strength goal can also support timed_strength (isometrics, etc.)
    if (goal === 'strength') {
      return {
        option: strengthOpt,
        isAmbiguous: false,
        isHybrid: true,
        compatibleProfiles: [strengthOpt, timedStrengthOpt]
      };
    }

    // Default Strength (hypertrophy, etc.)
    return { 
      option: strengthOpt, 
      isAmbiguous: false, 
      isHybrid: false,
      compatibleProfiles: [strengthOpt]
    };
  }

  // Fallback
  const fallbackOpt = findOpt('strength');
  return { 
    option: fallbackOpt, 
    isAmbiguous: false, 
    isHybrid: false,
    compatibleProfiles: [fallbackOpt]
  };
}