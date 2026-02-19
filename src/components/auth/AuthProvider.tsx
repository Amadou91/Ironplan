'use client'

import { useEffect, type ReactNode } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import { toAuthUser, useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { normalizePreferences } from '@/lib/preferences'

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const supabase = useSupabase()
  const setUser = useAuthStore((state) => state.setUser)
  const setHydrated = useAuthStore((state) => state.setHydrated)
  const setDisplayUnit = useUIStore((state) => state.setDisplayUnit)

  useEffect(() => {
    let active = true

    const syncPreferences = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .maybeSingle()

      if (!active || !data?.preferences) return
      const prefs = normalizePreferences(data.preferences)
      if (prefs.settings?.units) {
        setDisplayUnit(prefs.settings.units)
      }
    }

    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      const authUser = toAuthUser(session?.user ?? null)
      setUser(authUser)
      setHydrated(true)
      if (authUser) {
        void syncPreferences(authUser.id)
      }
    }

    hydrate()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = toAuthUser(session?.user ?? null)
      setUser(authUser)
      setHydrated(true)
      if (authUser) {
        void syncPreferences(authUser.id)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [setHydrated, setUser, setDisplayUnit, supabase])

  return children
}
