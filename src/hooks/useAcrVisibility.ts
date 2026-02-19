'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { useUser } from '@/hooks/useUser'
import { normalizePreferences, type AcrVisibility } from '@/lib/preferences'

/**
 * Returns the user's ACR card visibility preference.
 * Defaults to 'both' while loading so the card is visible on first paint.
 */
export function useAcrVisibility(): AcrVisibility {
  const supabase = useSupabase()
  const { user } = useUser()
  const [visibility, setVisibility] = useState<AcrVisibility>('both')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      const prefs = normalizePreferences(data?.preferences)
      setVisibility(prefs.settings?.acrVisibility ?? 'both')
    }

    void load()
    return () => { cancelled = true }
  }, [user, supabase])

  return visibility
}
