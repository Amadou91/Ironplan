'use client'

import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Memoized Supabase client hook.
 * Prevents re-creating the client on every render.
 */
export function useSupabase() {
  return useMemo(() => createClient(), [])
}
