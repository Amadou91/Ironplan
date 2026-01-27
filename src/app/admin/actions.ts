'use server'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_EXERCISES } from '@/lib/data/defaultExercises'
import { revalidatePath } from 'next/cache'

export async function resetWorkoutsAction() {
  const supabase = await createClient()

  // 1. Verify Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Delete All Existing Exercises
  // We use a condition that matches all rows. 
  // RLS policy for DELETE must be enabled for this to work (added in migration 20260516...).
  const { error: deleteError, count: deletedCount } = await supabase
    .from('exercise_catalog')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Efficiently matches all UUIDs

  if (deleteError) {
    return { success: false, error: `Delete failed: ${deleteError.message}` }
  }

  // 3. Insert Defaults
  const toInsert = DEFAULT_EXERCISES.map(ex => ({
    name: ex.name,
    category: ex.category ?? 'Strength',
    metric_profile: ex.metricProfile,
    sets: ex.sets,
    reps: ex.reps,
    rpe: ex.rpe,
    equipment: ex.equipment,
    difficulty: ex.difficulty,
    eligible_goals: ex.eligibleGoals,
    goal: ex.goal,
    duration_minutes: ex.durationMinutes,
    rest_seconds: ex.restSeconds,
    primary_muscle: ex.primaryMuscle,
    secondary_muscles: ex.secondaryMuscles,
    instructions: ex.instructions,
    video_url: ex.videoUrl,
    is_interval: ex.isInterval ?? false,
    interval_duration: ex.intervalDuration,
    interval_rest: ex.intervalRest
  }))

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
