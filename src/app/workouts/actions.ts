'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_EXERCISES } from '@/lib/data/defaultExercises'
import { revalidatePath } from 'next/cache'
import type { Exercise } from '@/types/domain'
import { SupabaseClient } from '@supabase/supabase-js'

import { MUSCLE_MAPPING } from '@/lib/muscle-mapping'

const ALL_MUSCLE_SLUGS = Object.keys(MUSCLE_MAPPING).filter(slug => slug !== 'full_body')

// Helper to clear catalog
async function clearCatalog(supabase: SupabaseClient) {
  // RLS policy for DELETE must be enabled.
  return await supabase
    .from('exercise_catalog')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
}

// Helper to insert exercises
async function insertExercises(supabase: SupabaseClient, exercises: Partial<Exercise>[]) {
  const toInsert = exercises.map(ex => {
    let secondaryMuscles = ex.secondaryMuscles || []
    
    // Auto-expand Full Body to all muscles if not already done
    if (ex.primaryMuscle === 'full_body' && secondaryMuscles.length === 0) {
      secondaryMuscles = ALL_MUSCLE_SLUGS
    }

    return {
      ...(ex.id ? { id: ex.id } : {}),
      name: ex.name,
      category: ex.category ?? 'Strength',
      metric_profile: ex.metricProfile,
      equipment: ex.equipment,
      movement_pattern: ex.movementPattern,
      primary_muscle: ex.primaryMuscle,
      secondary_muscles: secondaryMuscles,
      is_interval: ex.isInterval ?? false
    }
  })

  return await supabase
    .from('exercise_catalog')
    .insert(toInsert)
    .select()
}

export async function resetToDefaultsAction() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error: deleteError } = await clearCatalog(supabase)
  if (deleteError) {
    return { success: false, error: `Delete failed: ${deleteError.message}` }
  }

  const { error: insertError, data: inserted } = await insertExercises(supabase, DEFAULT_EXERCISES)

  if (insertError) {
    return { success: false, error: `Insert failed: ${insertError.message}` }
  }

  revalidatePath('/workouts')
  return { success: true, count: inserted.length }
}

export async function deleteExerciseAction(id: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('exercise_catalog')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/workouts')
  return { success: true }
}

export async function getExerciseBackupAction() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Unauthorized' }

  // Map DB columns back to domain model if needed, or just dump raw?
  // "Export workouts to a JSON file so that I can restore custom exercises."
  // It's safer to map to the Domain type so import uses the same structure as DEFAULT_EXERCISES.
  
  const { data, error } = await supabase
    .from('exercise_catalog')
    .select('*')
  
  if (error) return { success: false, error: error.message }
  
  // Transform to camelCase domain objects
  const exercises = data.map((row: {
    id: string;
    name: string;
    category: string;
    metric_profile: string;
    equipment: any;
    movement_pattern: string;
    primary_muscle: string;
    secondary_muscles: string[];
    is_interval: boolean;
  }) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    metricProfile: row.metric_profile,
    equipment: row.equipment,
    movementPattern: row.movement_pattern,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles,
    isInterval: row.is_interval
  }))

  return { success: true, data: exercises }
}

export async function importExercisesAction(exercises: Partial<Exercise>[]) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Unauthorized' }

  if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
    return { success: false, error: 'Invalid data' }
  }

  const { error: deleteError } = await clearCatalog(supabase)
  if (deleteError) return { success: false, error: `Delete failed: ${deleteError.message}` }

  const { error: insertError, data: inserted } = await insertExercises(supabase, exercises)

  if (insertError) return { success: false, error: `Insert failed: ${insertError.message}` }

  revalidatePath('/workouts')
  return { success: true, count: inserted.length }
}
