'use client'

import { useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toAuthUser, useAuthStore } from '@/store/authStore'

type AuthProviderProps = {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const supabase = createClient()
  const setUser = useAuthStore((state) => state.setUser)
  const setHydrated = useAuthStore((state) => state.setHydrated)

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      setUser(toAuthUser(session?.user ?? null))
      setHydrated(true)
    }

    hydrate()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user ?? null))
      setHydrated(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [setHydrated, setUser, supabase])

  return children
}
