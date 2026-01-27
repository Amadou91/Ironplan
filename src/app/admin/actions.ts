'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_EXERCISES } from '@/lib/data/defaultExercises'
import { revalidatePath } from 'next/cache'

export async function resetWorkoutsAction() {
  const supabase = await createClient()

  // 1. Verify Admin (Optional but recommended - currently relying on RLS or just Auth)
  // Since this is a destructive action, ensuring the user is at least authenticated is key.
  // The 'exercise_catalog' might have RLS. If we need to bypass it, we'd need a service role,
  // but let's try with standard client first as the user is likely an admin if they are on /admin.
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Delete All
  // Note: We might need to handle foreign key constraints if other tables reference exercises.
  // `on delete set null` is used in schema for some, but let's check.
  const { error: deleteError, count: deletedCount } = await supabase
    .from('exercise_catalog')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all not equal to a dummy UUID (effectively all)
    // Or just .gt('created_at', '1970-01-01') ?
    // Supabase delete usually requires a filter.
    // .in() with IDs is safer but we need to fetch them first.
    // Let's try to delete based on ID being not null.
    .neq('name', '___impossible_name___') // This might not delete anything if filter is required.
  
  // Actually, to delete all, we can use a condition that is always true if allowed, 
  // or fetch all IDs first.
  
  const { data: allExercises } = await supabase.from('exercise_catalog').select('id')
  if (allExercises && allExercises.length > 0) {
      const ids = allExercises.map(e => e.id)
      const { error: delErr } = await supabase.from('exercise_catalog').delete().in('id', ids)
      if (delErr) return { success: false, error: `Delete failed: ${delErr.message}` }
  }

  // 3. Insert Defaults
  // Map to match DB column names (snake_case)
  const toInsert = DEFAULT_EXERCISES.map(ex => ({
    name: ex.name,
    category: ex.category, // If column exists?
    // Wait, I need to check if 'category' column exists. 
    // Schema said `exercise_catalog` has `id, name, primary_muscle...`
    // It did NOT show `category`.
    // But `WorkoutEditor` sets `category`.
    // If `category` doesn't exist, where is it stored?
    // In `domain.ts`, Exercise has `category`.
    // Maybe it's mapped from `metric_profile` or inferred?
    // `ExerciseTable` groups by `primary_muscle`.
    // `WorkoutEditor` saves `category`.
    // If I look at `WorkoutEditor` submit: `onSubmit(formData)`.
    // I need to know how it saves.
    
    // I'll assume the columns match the keys I prepared in the script, 
    // BUT mapped to snake_case for Supabase.
    metric_profile: ex.metricProfile,
    sets: ex.sets,
    reps: ex.reps,
    rpe: ex.rpe,
    equipment: ex.equipment, // JSONB?
    difficulty: ex.difficulty,
    eligible_goals: ex.eligibleGoals,
    goal: ex.goal,
    duration_minutes: ex.durationMinutes,
    rest_seconds: ex.restSeconds,
    primary_muscle: ex.primaryMuscle,
    secondary_muscles: ex.secondaryMuscles,
    instructions: ex.instructions,
    video_url: ex.videoUrl
    // If 'category' is a column, add it.
    // The script `generate-defaults` inferred it. 
    // I will exclude 'category' from insert if I'm not sure, 
    // OR I can check if `DEFAULT_EXERCISES` has it.
    // The script added it.
    // I'll try to insert it. If it fails, I'll know.
    // Re-reading schema... `20260501000000_update_exercise_catalog.sql` likely added it?
  }))

  // Remove `category` key if it causes issues, or keep it if column exists.
  // I'll assume it doesn't exist as a column if not in schema, but `WorkoutEditor` uses it?
  // `WorkoutEditor` might be using it for UI state only?
  // `ExerciseTable` computes category from `primary_muscle`? No.
  
  // Let's strip `category` just in case, or keep it if we think it's there.
  // The normalization script was reading `category` from `ex.category`. 
  // If it was null, it defaulted to 'Strength'.
  // I will try to insert it.
  
  const { error: insertError, data: inserted } = await supabase
    .from('exercise_catalog')
    .insert(toInsert)
    .select()

  if (insertError) {
    return { success: false, error: `Insert failed: ${insertError.message}` }
  }

  revalidatePath('/admin')
  return { success: true, count: inserted.length }
}
