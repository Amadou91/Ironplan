export interface User {
  id: string;
  email: string;
  name?: string;
}

export type MuscleGroup = 
  | 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Full Body' | 'Cardio';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup | string;
  secondaryMuscles?: string[];
  equipment?: string;
  videoUrl?: string;
  instructions?: string[];
  // Plan specific fields
  sets?: number; 
  reps?: string; 
}

// Alias for components that might use strict naming
export type WorkoutExercise = Exercise;

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string; // e.g., "4 Day Split"
  goal: string;
  days: WorkoutDay[];
  createdAt: string;
}

export interface WorkoutDay {
  id: string;
  name: string; // e.g., "Upper Body A"
  exercises: Exercise[];
}

// --- TRACKING TYPES ---

export interface WorkoutSession {
  id: string;
  userId: string;
  planId?: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  exercises: SessionExercise[];
}

export interface SessionExercise {
  id: string; // UUID
  sessionId: string;
  exerciseId?: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  sets: WorkoutSet[];
  orderIndex: number;
}

export interface WorkoutSet {
  id: string; // UUID
  setNumber: number;
  reps: number | '' | null;
  weight: number | '' | null;
  rpe?: number | '' | null;
  completed: boolean;
}