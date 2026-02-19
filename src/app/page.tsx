'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useSupabase } from '@/hooks/useSupabase'
import {
  validateProfileCompletion,
  type ProfileSnapshot,
} from '@/lib/profile-validation'
import { normalizePreferences } from '@/lib/preferences'

export default function Home() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state.hydrated)
  const supabase = useSupabase()
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!hydrated) return
    if (!user) {
      router.replace('/auth/login')
      return
    }
    if (checkingRef.current) return
    checkingRef.current = true

    const checkProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('weight_lb, height_in, birthdate, sex, preferences')
          .eq('id', user.id)
          .maybeSingle()

        if (!data) {
          router.replace('/profile')
          return
        }

        const prefs = normalizePreferences(data.preferences)
        const inventory = prefs.equipment?.inventory
        const hasEquipment = inventory
          ? Object.entries(inventory).some(([key, v]) => {
              if (key === 'machines') return Object.values(v as Record<string, boolean>).some(Boolean)
              if (Array.isArray(v)) return v.length > 0
              if (key === 'barbell') return (v as { available: boolean }).available
              return Boolean(v)
            })
          : false

        const snapshot: ProfileSnapshot = {
          weight_lb: data.weight_lb,
          height_in: data.height_in,
          birthdate: data.birthdate,
          sex: data.sex,
          hasEquipment,
        }

        const result = validateProfileCompletion(snapshot)
        router.replace(result.isComplete ? '/dashboard' : '/profile')
      } catch {
        router.replace('/dashboard')
      }
    }

    void checkProfile()
  }, [hydrated, user, router, supabase])

  return (
    <div className="page-shell flex min-h-screen items-center justify-center text-sm text-muted">
      Redirecting…
    </div>
  )
}
