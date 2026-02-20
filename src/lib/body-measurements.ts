import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDateInET, getUTCDateRangeFromET } from './date-utils'

/**
 * Records a body weight measurement for a user, ensuring only one entry exists per day.
 * If an entry already exists for the given date (in Eastern Time), it will be updated.
 * 
 * @param supabase - Supabase client
 * @param userId - ID of the user
 * @param weightLb - Body weight in pounds
 * @param date - Date of the measurement (defaults to now)
 * @param source - Source of the measurement (e.g., 'user', 'session')
 * @param sessionId - Optional session ID to associate with the measurement
 */
export async function recordBodyWeight({
  supabase,
  userId,
  weightLb,
  date = new Date(),
  source = 'user',
  sessionId
}: {
  supabase: SupabaseClient
  userId: string
  weightLb: number
  date?: Date | string
  source?: string
  sessionId?: string | null
}) {
  if (!userId || !weightLb) return { success: false, error: 'User ID and weight are required' }

  const measurementDate = typeof date === 'string' ? new Date(date) : date
  const dateStr = formatDateInET(measurementDate)
  const { start, end } = getUTCDateRangeFromET(dateStr)

  try {
    // 1. Check for existing measurement on the same day (ET)
    const { data: existing } = await supabase
      .from('body_measurements')
      .select('id')
      .eq('user_id', userId)
      .gte('recorded_at', start)
      .lte('recorded_at', end)
      .maybeSingle()

    let result
    if (existing) {
      // 2. Update existing entry
      result = await supabase
        .from('body_measurements')
        .update({
          weight_lb: weightLb,
          source,
          session_id: sessionId || null 
        })
        .eq('id', existing.id)
    } else {
      // 3. Insert new entry
      result = await supabase
        .from('body_measurements')
        .insert({
          user_id: userId,
          weight_lb: weightLb,
          recorded_at: measurementDate.toISOString(),
          source,
          session_id: sessionId || null
        })
    }

    if (result.error) throw result.error

    // 4. Also keep user profile in sync IF it's a manual entry from the user profile page.
    // Session-based weight updates should not update the profile until the session is completed.
    if (source === 'user') {
      await supabase
        .from('profiles')
        .update({ weight_lb: weightLb })
        .eq('id', userId)
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to record body weight:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Deletes body measurements associated with a specific date range (one day).
 */
export async function deleteDailyBodyMeasurement(supabase: SupabaseClient, userId: string, date: Date | string) {
  const measurementDate = typeof date === 'string' ? new Date(date) : date
  const dateStr = formatDateInET(measurementDate)
  const { start, end } = getUTCDateRangeFromET(dateStr)

  return supabase
    .from('body_measurements')
    .delete()
    .eq('user_id', userId)
    .gte('recorded_at', start)
    .lte('recorded_at', end)
}
